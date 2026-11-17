const crypto = require('crypto');
const { storeRepository } = require('../repositories/storeRepository');
const {
  DEFAULT_COMMAND_BY_TYPE,
  DELIVERY_STATUS,
  ORDER_STATUS,
  ROLES,
  SIMULATED_RESULTS,
} = require('../utils/constants');
const HttpError = require('../utils/httpError');
const { validateCheckoutPayload } = require('../utils/validators');
const { logAudit } = require('./auditService');

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function buildDeliveryCommand(item, gamertag) {
  const template = item.comando || DEFAULT_COMMAND_BY_TYPE[item.tipo];
  return template.replace(/\{player\}/gi, gamertag);
}

/**
 * Executes an atomic ACID checkout over the user's persistent cart.
 * Computes totals exclusively on the server, supports Idempotency-Key,
 * rolls back stock on failure, and binds delivery commands to `currentUser.gamertag_minecraft`.
 * @param {object} currentUser - Authenticated user from JWT.
 * @param {object} payload - Payment simulation parameters.
 * @param {string|null} [idempotencyKey=null] - Optional Idempotency-Key header.
 * @param {object} [repo=storeRepository] - Repository dependency.
 */
async function checkoutCart(
  currentUser,
  payload = {},
  idempotencyKey = null,
  repo = storeRepository
) {
  const validation = validateCheckoutPayload(payload);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0], validation.errors);
  }

  const userId = Number(currentUser.id_usuario);
  const cleanKey = idempotencyKey ? String(idempotencyKey).trim().slice(0, 120) : null;

  if (cleanKey) {
    const existingRecord = await repo.findIdempotencyRecord(userId, cleanKey);
    if (existingRecord) {
      return {
        status: existingRecord.response_status,
        body: existingRecord.response_body,
        idempotentReplay: true,
      };
    }
  }

  const cartEntries = await repo.getCartItemsByUserId(userId);
  if (cartEntries.length === 0) {
    throw new HttpError(400, 'El carrito está vacío; agrega ítems antes de pagar');
  }

  const { metodo_pago, resultado_simulado } = validation.data;
  if (resultado_simulado === SIMULATED_RESULTS.RECHAZADO) {
    await logAudit(
      {
        id_usuario: userId,
        accion: 'CHECKOUT_REJECTED',
        entidad: 'orden',
        detalles: { metodo_pago, reason: 'Pasarela simulada rechazó la transacción' },
      },
      repo
    );
    throw new HttpError(402, 'Pago rechazado por la pasarela simulada; no se realizó ningún cobro');
  }

  const txResult = await repo.runTransaction(async (txRepo) => {
    const freshEntries = await txRepo.getCartItemsByUserId(userId);
    if (freshEntries.length === 0) {
      throw new HttpError(400, 'El carrito está vacío');
    }

    const detalles = [];
    const itemsForDelivery = [];
    let serverTotal = 0;

    for (const entry of freshEntries) {
      const item = await txRepo.findItemById(entry.id_item);
      if (!item || item.activo === false) {
        throw new HttpError(409, `El ítem #${entry.id_item} ya no se encuentra disponible`);
      }
      if (item.stock < entry.cantidad) {
        throw new HttpError(
          409,
          `Stock insuficiente para "${item.nombre}". Disponible: ${item.stock}, en carrito: ${entry.cantidad}`
        );
      }

      const decremented = await txRepo.decrementItemStock(item.id_item, entry.cantidad);
      if (!decremented) {
        throw new HttpError(409, `No hay stock suficiente para "${item.nombre}"`);
      }

      const subtotal = roundCurrency(item.precio * entry.cantidad);
      serverTotal += subtotal;
      detalles.push({
        id_item: item.id_item,
        nombre_snapshot: item.nombre,
        precio_unitario: item.precio,
        cantidad: entry.cantidad,
        subtotal,
      });
      itemsForDelivery.push(item);
    }

    const { order, detalles: savedDetails } = await txRepo.createOrder({
      codigo_uuid: crypto.randomUUID(),
      id_usuario: userId,
      total: roundCurrency(serverTotal),
      estado: ORDER_STATUS.PAGADO,
      metodo_pago,
      detalles,
    });

    const entregas = [];
    for (const item of itemsForDelivery) {
      const delivery = await txRepo.enqueueDelivery({
        id_orden: order.id_orden,
        id_item: item.id_item,
        gamertag_minecraft: currentUser.gamertag_minecraft,
        servidor: item.servidor,
        comando_a_ejecutar: buildDeliveryCommand(item, currentUser.gamertag_minecraft),
        estado_entrega: DELIVERY_STATUS.PENDIENTE,
      });
      entregas.push(delivery);
    }

    await txRepo.clearCart(userId);

    await logAudit(
      {
        id_usuario: userId,
        accion: 'ORDER_CHECKOUT_PAID',
        entidad: 'orden',
        entidad_id: order.id_orden,
        detalles: {
          codigo_uuid: order.codigo_uuid,
          total: order.total,
          items: savedDetails.length,
        },
      },
      txRepo
    );

    const responseBody = {
      orden: order,
      detalles: savedDetails,
      entregas,
    };

    if (cleanKey) {
      await txRepo.saveIdempotencyRecord(userId, cleanKey, 201, responseBody);
    }

    return {
      status: 201,
      body: responseBody,
      idempotentReplay: false,
    };
  });

  return txResult;
}

/**
 * Lists orders for the caller (or all orders for ADMIN).
 * @param {object} currentUser
 * @param {object} [repo=storeRepository]
 */
async function listOrders(currentUser, repo = storeRepository) {
  const isAdmin = currentUser.rol === ROLES.ADMIN;
  return repo.listOrdersWithDetails({ userId: isAdmin ? null : currentUser.id_usuario });
}

/**
 * Retrieves a single order with details and deliveries if owned by caller or ADMIN.
 * @param {number|string} orderId
 * @param {object} currentUser
 * @param {object} [repo=storeRepository]
 */
async function getOrderById(orderId, currentUser, repo = storeRepository) {
  const order = await repo.findOrderById(orderId);
  if (!order) {
    throw new HttpError(404, 'Orden no encontrada');
  }
  const isOwner = order.id_usuario === Number(currentUser.id_usuario);
  if (!isOwner && currentUser.rol !== ROLES.ADMIN) {
    throw new HttpError(403, 'No tienes permisos para ver esta orden');
  }
  return order;
}

/**
 * Marks a pending delivery entry as ENTREGADO by ADMIN or the item's seller.
 * @param {number|string} deliveryId
 * @param {object} currentUser
 * @param {object} [repo=storeRepository]
 */
async function dispatchDelivery(deliveryId, currentUser, repo = storeRepository) {
  const delivery = await repo.findDeliveryById(deliveryId);
  if (!delivery) {
    throw new HttpError(404, 'Entrega en cola no encontrada');
  }

  const item = await repo.findItemById(delivery.id_item);
  const isSellerOwner = item && item.id_vendedor === Number(currentUser.id_usuario);
  if (currentUser.rol !== ROLES.ADMIN && !isSellerOwner) {
    throw new HttpError(
      403,
      'Solo un administrador o el vendedor del ítem puede despachar esta entrega'
    );
  }

  if (delivery.estado_entrega === DELIVERY_STATUS.ENTREGADO) {
    throw new HttpError(409, 'Esta entrega ya fue marcada como ENTREGADO');
  }

  const updated = await repo.updateDeliveryStatus(deliveryId, DELIVERY_STATUS.ENTREGADO);
  await logAudit(
    {
      id_usuario: currentUser.id_usuario,
      accion: 'DELIVERY_DISPATCHED',
      entidad: 'entrega',
      entidad_id: deliveryId,
      detalles: { gamertag: updated.gamertag_minecraft, servidor: updated.servidor },
    },
    repo
  );
  return updated;
}

module.exports = {
  checkoutCart,
  listOrders,
  getOrderById,
  dispatchDelivery,
};

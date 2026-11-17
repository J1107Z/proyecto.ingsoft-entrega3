const crypto = require('crypto');
const { storeRepository } = require('../repositories/storeRepository');
const {
  DEFAULT_COMMAND_BY_TYPE,
  ITEM_TYPES,
  ORDER_STATUS,
  DELIVERY_STATUS,
  ROLES,
} = require('../utils/constants');
const HttpError = require('../utils/httpError');
const { validateItemPayload } = require('../utils/validators');
const { logAudit } = require('./auditService');

function ensureSellerOrAdminOwner(item, currentUser) {
  const isOwner = item.id_vendedor === Number(currentUser.id_usuario);
  const isAdmin = currentUser.rol === ROLES.ADMIN;
  return isOwner || isAdmin;
}

function matchesItemFilters(item, filters) {
  if (filters.tipo && item.tipo !== String(filters.tipo).trim().toUpperCase()) {
    return false;
  }
  if (filters.servidor) {
    const targetServer = String(filters.servidor).trim().toLowerCase();
    if (!item.servidor.toLowerCase().includes(targetServer)) return false;
  }
  if (filters.q) {
    const term = String(filters.q).trim().toLowerCase();
    const haystack = `${item.nombre} ${item.descripcion} ${item.servidor}`.toLowerCase();
    if (!haystack.includes(term)) return false;
  }
  if (filters.disponible === 'true' && item.stock <= 0) {
    return false;
  }
  const minPrice = filters.minPrice !== undefined ? Number(filters.minPrice) : null;
  if (minPrice !== null && Number.isFinite(minPrice) && item.precio < minPrice) {
    return false;
  }
  const maxPrice = filters.maxPrice !== undefined ? Number(filters.maxPrice) : null;
  if (maxPrice !== null && Number.isFinite(maxPrice) && item.precio > maxPrice) {
    return false;
  }
  if (filters.vendedorId !== undefined && item.id_vendedor !== Number(filters.vendedorId)) {
    return false;
  }
  return true;
}

/**
 * Lists active catalog items with search, type/server filtering, and pagination metadata.
 * @param {object} [filters={}]
 * @param {object} [repo=storeRepository]
 */
async function listItems(filters = {}, repo = storeRepository) {
  const allItems = await repo.listItems({ includeInactive: false });
  const filtered = allItems.filter((item) => matchesItemFilters(item, filters));

  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
  const total = filtered.length;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const offset = (page - 1) * limit;

  return {
    items: filtered.slice(offset, offset + limit),
    total,
    page,
    totalPages,
    tipos_disponibles: ITEM_TYPES,
  };
}

/**
 * Retrieves a single active catalog item or raises 404.
 * @param {number|string} id
 * @param {object} [repo=storeRepository]
 */
async function getItemById(id, repo = storeRepository) {
  const item = await repo.findItemById(id);
  if (!item || item.activo === false) {
    throw new HttpError(404, 'Ítem no encontrado');
  }
  return item;
}

/**
 * Publishes a new catalog item owned by the authenticated VENDEDOR or ADMIN.
 * @param {object} payload
 * @param {object} currentUser
 * @param {object} [repo=storeRepository]
 */
async function createItem(payload, currentUser, repo = storeRepository) {
  const validation = validateItemPayload(payload, { partial: false });
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0], validation.errors);
  }

  const data = validation.data;
  const created = await repo.createItem({
    ...data,
    id_vendedor: Number(currentUser.id_usuario),
    comando: data.comando || DEFAULT_COMMAND_BY_TYPE[data.tipo],
  });

  await logAudit(
    {
      id_usuario: currentUser.id_usuario,
      accion: 'ITEM_CREATE',
      entidad: 'item',
      entidad_id: created.id_item,
      detalles: { nombre: created.nombre, tipo: created.tipo, precio: created.precio },
    },
    repo
  );

  return created;
}

/**
 * Updates an existing catalog item owned by the caller (or any item for ADMIN).
 * @param {number|string} id
 * @param {object} payload
 * @param {object} currentUser
 * @param {object} [repo=storeRepository]
 */
async function updateItem(id, payload, currentUser, repo = storeRepository) {
  const existing = await repo.findItemById(id);
  if (!existing || existing.activo === false) {
    throw new HttpError(404, 'Ítem no encontrado');
  }

  if (!ensureSellerOrAdminOwner(existing, currentUser)) {
    await logAudit(
      {
        id_usuario: currentUser.id_usuario,
        accion: 'FORBIDDEN_ITEM_EDIT',
        entidad: 'item',
        entidad_id: existing.id_item,
        detalles: { rol: currentUser.rol },
      },
      repo
    );
    throw new HttpError(
      403,
      'Solo el vendedor propietario o un administrador puede modificar este ítem'
    );
  }

  const validation = validateItemPayload(payload, { partial: true });
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0], validation.errors);
  }

  if (Object.keys(validation.data).length === 0) {
    throw new HttpError(400, 'Debes enviar al menos un campo válido para actualizar');
  }

  const updated = await repo.updateItem(id, validation.data);
  await logAudit(
    {
      id_usuario: currentUser.id_usuario,
      accion: 'ITEM_UPDATE',
      entidad: 'item',
      entidad_id: updated.id_item,
      detalles: { cambios: Object.keys(validation.data) },
    },
    repo
  );

  return updated;
}

/**
 * Performs a logical deletion (`activo = false`) on an item so past orders stay intact.
 * @param {number|string} id
 * @param {object} currentUser
 * @param {object} [repo=storeRepository]
 */
async function deleteItem(id, currentUser, repo = storeRepository) {
  const existing = await repo.findItemById(id);
  if (!existing || existing.activo === false) {
    throw new HttpError(404, 'Ítem no encontrado');
  }

  if (!ensureSellerOrAdminOwner(existing, currentUser)) {
    throw new HttpError(
      403,
      'Solo el vendedor propietario o un administrador puede eliminar este ítem'
    );
  }

  const deleted = await repo.updateItem(id, { activo: false });
  await logAudit(
    {
      id_usuario: currentUser.id_usuario,
      accion: 'ITEM_DELETE',
      entidad: 'item',
      entidad_id: existing.id_item,
      detalles: { nombre: existing.nombre },
    },
    repo
  );

  return deleted;
}

/**
 * Direct single-item purchase/delivery endpoint that forces target gamertag to req.user.
 * @param {number|string} id
 * @param {object} currentUser
 * @param {object} [repo=storeRepository]
 */
async function deliverDirectItem(id, currentUser, repo = storeRepository) {
  return repo.runTransaction(async (txRepo) => {
    const item = await txRepo.findItemById(id);
    if (!item || item.activo === false) {
      throw new HttpError(404, 'Ítem no encontrado');
    }
    if (item.stock < 1) {
      throw new HttpError(409, 'No hay stock disponible para este ítem');
    }

    const decremented = await txRepo.decrementItemStock(item.id_item, 1);
    if (!decremented) {
      throw new HttpError(409, 'No se pudo reservar stock para el ítem');
    }

    const { order, detalles } = await txRepo.createOrder({
      codigo_uuid: crypto.randomUUID(),
      id_usuario: currentUser.id_usuario,
      total: item.precio,
      estado: ORDER_STATUS.PAGADO,
      metodo_pago: 'ENTREGA_DIRECTA',
      detalles: [
        {
          id_item: item.id_item,
          nombre_snapshot: item.nombre,
          precio_unitario: item.precio,
          cantidad: 1,
          subtotal: item.precio,
        },
      ],
    });

    const commandText = (item.comando || DEFAULT_COMMAND_BY_TYPE[item.tipo]).replace(
      /\{player\}/gi,
      currentUser.gamertag_minecraft
    );

    const delivery = await txRepo.enqueueDelivery({
      id_orden: order.id_orden,
      id_item: item.id_item,
      gamertag_minecraft: currentUser.gamertag_minecraft,
      servidor: item.servidor,
      comando_a_ejecutar: commandText,
      estado_entrega: DELIVERY_STATUS.PENDIENTE,
    });

    await logAudit(
      {
        id_usuario: currentUser.id_usuario,
        accion: 'DIRECT_ITEM_DELIVERY',
        entidad: 'entrega',
        entidad_id: delivery.id_entrega,
        detalles: { id_item: item.id_item, deliveredTo: currentUser.gamertag_minecraft },
      },
      txRepo
    );

    return {
      deliveredTo: currentUser.gamertag_minecraft,
      orden: order,
      detalles,
      entrega: delivery,
    };
  });
}

module.exports = {
  listItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  deliverDirectItem,
};

const { storeRepository } = require('../repositories/storeRepository');
const HttpError = require('../utils/httpError');
const { validateCartItemPayload } = require('../utils/validators');

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function buildCartResponse(rawEntries) {
  const items = [];
  let total = 0;
  let total_unidades = 0;

  for (const entry of rawEntries) {
    if (!entry.item || entry.item.activo === false) {
      continue;
    }
    const subtotal = roundCurrency(entry.item.precio * entry.cantidad);
    total += subtotal;
    total_unidades += entry.cantidad;
    items.push({
      id_item: entry.id_item,
      nombre: entry.item.nombre,
      tipo: entry.item.tipo,
      servidor: entry.item.servidor,
      imagen_url: entry.item.imagen_url,
      precio_unitario: entry.item.precio,
      cantidad: entry.cantidad,
      stock_disponible: entry.item.stock,
      stock_suficiente: entry.cantidad <= entry.item.stock,
      subtotal,
    });
  }

  return {
    items,
    total_items: items.length,
    total_unidades,
    total: roundCurrency(total),
  };
}

/**
 * Retrieves the persistent shopping cart summary for a user.
 * @param {number} userId
 * @param {object} [repo=storeRepository]
 */
async function getCart(userId, repo = storeRepository) {
  const entries = await repo.getCartItemsByUserId(userId);
  return buildCartResponse(entries);
}

/**
 * Adds an item (or increments quantity) in the user's persistent cart enforcing stock limits.
 * @param {number} userId
 * @param {object} payload
 * @param {object} [repo=storeRepository]
 */
async function addItemToCart(userId, payload, repo = storeRepository) {
  const validation = validateCartItemPayload(payload);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0], validation.errors);
  }

  const { id_item, cantidad } = validation.data;
  const item = await repo.findItemById(id_item);
  if (!item || item.activo === false) {
    throw new HttpError(404, 'Ítem no encontrado');
  }

  const existingEntries = await repo.getCartItemsByUserId(userId);
  const currentEntry = existingEntries.find((entry) => entry.id_item === id_item);
  const desiredTotal = (currentEntry ? currentEntry.cantidad : 0) + cantidad;

  if (desiredTotal > item.stock) {
    throw new HttpError(
      409,
      `Stock insuficiente para "${item.nombre}". Disponible: ${item.stock}, solicitado: ${desiredTotal}`
    );
  }

  await repo.addOrIncrementCartItem(userId, id_item, cantidad);
  return getCart(userId, repo);
}

/**
 * Updates the exact quantity of a cart line item.
 * @param {number} userId
 * @param {number|string} rawItemId
 * @param {object} payload
 * @param {object} [repo=storeRepository]
 */
async function updateCartItemQuantity(userId, rawItemId, payload, repo = storeRepository) {
  const id_item = Number(rawItemId);
  const cantidad = Number(payload?.cantidad);

  if (!Number.isInteger(id_item) || id_item <= 0) {
    throw new HttpError(400, 'ID de ítem inválido');
  }
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) {
    throw new HttpError(400, 'La cantidad debe ser un entero entre 1 y 99');
  }

  const item = await repo.findItemById(id_item);
  if (!item || item.activo === false) {
    throw new HttpError(404, 'Ítem no encontrado');
  }
  if (cantidad > item.stock) {
    throw new HttpError(
      409,
      `Stock insuficiente para "${item.nombre}". Disponible: ${item.stock}, solicitado: ${cantidad}`
    );
  }

  const updated = await repo.setCartItemQuantity(userId, id_item, cantidad);
  if (!updated) {
    throw new HttpError(404, 'El ítem no se encuentra en tu carrito');
  }

  return getCart(userId, repo);
}

/**
 * Removes a specific item from the user's cart.
 * @param {number} userId
 * @param {number|string} rawItemId
 * @param {object} [repo=storeRepository]
 */
async function removeItemFromCart(userId, rawItemId, repo = storeRepository) {
  const id_item = Number(rawItemId);
  if (!Number.isInteger(id_item) || id_item <= 0) {
    throw new HttpError(400, 'ID de ítem inválido');
  }

  const removed = await repo.removeCartItem(userId, id_item);
  if (!removed) {
    throw new HttpError(404, 'El ítem no se encuentra en tu carrito');
  }
  return getCart(userId, repo);
}

/**
 * Empties all items from the user's cart.
 * @param {number} userId
 * @param {object} [repo=storeRepository]
 */
async function clearUserCart(userId, repo = storeRepository) {
  await repo.clearCart(userId);
  return getCart(userId, repo);
}

module.exports = {
  getCart,
  addItemToCart,
  updateCartItemQuantity,
  removeItemFromCart,
  clearUserCart,
};

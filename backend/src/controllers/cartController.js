const cartService = require('../services/cartService');

function wrapAsync(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const getCart = wrapAsync(async (req, res) => {
  const carrito = await cartService.getCart(req.user.id_usuario);
  res.status(200).json({ carrito });
});

const addItem = wrapAsync(async (req, res) => {
  const carrito = await cartService.addItemToCart(req.user.id_usuario, req.body);
  res.status(200).json({ carrito });
});

const updateItem = wrapAsync(async (req, res) => {
  const carrito = await cartService.updateCartItemQuantity(
    req.user.id_usuario,
    req.params.id_item,
    req.body
  );
  res.status(200).json({ carrito });
});

const removeItem = wrapAsync(async (req, res) => {
  const carrito = await cartService.removeItemFromCart(req.user.id_usuario, req.params.id_item);
  res.status(200).json({ carrito });
});

const clearCart = wrapAsync(async (req, res) => {
  const carrito = await cartService.clearUserCart(req.user.id_usuario);
  res.status(200).json({ carrito });
});

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
};

const orderService = require('../services/orderService');
const auditService = require('../services/auditService');

function wrapAsync(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const checkout = wrapAsync(async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'] || null;
  const result = await orderService.checkoutCart(req.user, req.body, idempotencyKey);
  if (result.idempotentReplay) {
    res.setHeader('X-Idempotent-Replay', 'true');
  }
  res.status(result.status).json(result.body);
});

const list = wrapAsync(async (req, res) => {
  const ordenes = await orderService.listOrders(req.user);
  res.status(200).json({ ordenes });
});

const getById = wrapAsync(async (req, res) => {
  const orden = await orderService.getOrderById(req.params.id, req.user);
  res.status(200).json({ orden });
});

const dispatchDelivery = wrapAsync(async (req, res) => {
  const entrega = await orderService.dispatchDelivery(req.params.id, req.user);
  res.status(200).json({ entrega });
});

const listAudit = wrapAsync(async (req, res) => {
  const logs = await auditService.listAuditLogs(req.query.limit);
  res.status(200).json({ logs });
});

module.exports = {
  checkout,
  list,
  getById,
  dispatchDelivery,
  listAudit,
};

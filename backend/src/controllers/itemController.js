const itemService = require('../services/itemService');

function wrapAsync(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const list = wrapAsync(async (req, res) => {
  const result = await itemService.listItems(req.query);
  res.status(200).json(result);
});

const getById = wrapAsync(async (req, res) => {
  const item = await itemService.getItemById(req.params.id);
  res.status(200).json({ item });
});

const create = wrapAsync(async (req, res) => {
  const item = await itemService.createItem(req.body, req.user);
  res.status(201).json({ item });
});

const update = wrapAsync(async (req, res) => {
  const item = await itemService.updateItem(req.params.id, req.body, req.user);
  res.status(200).json({ item });
});

const remove = wrapAsync(async (req, res) => {
  const item = await itemService.deleteItem(req.params.id, req.user);
  res.status(200).json({ message: 'Ítem eliminado correctamente', item });
});

const deliver = wrapAsync(async (req, res) => {
  const result = await itemService.deliverDirectItem(req.params.id, req.user);
  res.status(200).json(result);
});

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  deliver,
};

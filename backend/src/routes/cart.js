const express = require('express');
const cartController = require('../controllers/cartController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.get('/', cartController.getCart);
router.post('/items', cartController.addItem);
router.put('/items/:id_item', cartController.updateItem);
router.delete('/items/:id_item', cartController.removeItem);
router.delete('/', cartController.clearCart);

module.exports = router;

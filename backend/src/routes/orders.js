const express = require('express');
const orderController = require('../controllers/orderController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.post('/checkout', orderController.checkout);
router.get('/', orderController.list);
router.get('/:id', orderController.getById);

module.exports = router;

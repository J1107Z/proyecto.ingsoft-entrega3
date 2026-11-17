const express = require('express');
const orderController = require('../controllers/orderController');
const { authenticateToken, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.patch(
  '/:id/dispatch',
  authenticateToken,
  authorize(ROLES.VENDEDOR, ROLES.ADMIN),
  orderController.dispatchDelivery
);

module.exports = router;

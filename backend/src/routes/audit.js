const express = require('express');
const orderController = require('../controllers/orderController');
const { authenticateToken, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.get('/', authenticateToken, authorize(ROLES.ADMIN), orderController.listAudit);

module.exports = router;

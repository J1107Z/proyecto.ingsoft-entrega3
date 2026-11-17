const express = require('express');
const itemController = require('../controllers/itemController');
const { authenticateToken, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.get('/', itemController.list);
router.get('/:id', itemController.getById);
router.post('/', authenticateToken, authorize(ROLES.VENDEDOR, ROLES.ADMIN), itemController.create);
router.put(
  '/:id',
  authenticateToken,
  authorize(ROLES.VENDEDOR, ROLES.ADMIN),
  itemController.update
);
router.delete(
  '/:id',
  authenticateToken,
  authorize(ROLES.VENDEDOR, ROLES.ADMIN),
  itemController.remove
);
router.post('/:id/deliver', authenticateToken, itemController.deliver);

module.exports = router;

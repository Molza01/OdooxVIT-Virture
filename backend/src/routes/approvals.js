const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const approvalController = require('../controllers/approvalController');

const router = Router();

router.use(authenticate);

router.get('/pending', authorize('MANAGER', 'FINANCE', 'DIRECTOR', 'ADMIN'), approvalController.getPendingApprovals);
router.post('/:id/approve', authorize('MANAGER', 'FINANCE', 'DIRECTOR', 'ADMIN'), approvalController.approveExpense);
router.post('/:id/reject', authorize('MANAGER', 'FINANCE', 'DIRECTOR', 'ADMIN'), approvalController.rejectExpense);

router.post(
  '/:id/override',
  authorize('ADMIN'),
  [
    body('action').isIn(['APPROVED', 'REJECTED']).withMessage('Action must be APPROVED or REJECTED'),
  ],
  validate,
  approvalController.overrideApproval
);

module.exports = router;

const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const upload = require('../config/multer');
const expenseController = require('../controllers/expenseController');

const router = Router();

router.use(authenticate);

router.get('/categories', expenseController.getCategories);

router.post(
  '/',
  upload.single('receipt'),
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
    body('category').notEmpty().withMessage('Category required'),
    body('paidBy').optional().isIn(['PERSONAL', 'COMPANY']).withMessage('Invalid paidBy value'),
    body('expenseDate').isISO8601().withMessage('Valid date required'),
  ],
  validate,
  expenseController.createExpense
);

router.get('/', expenseController.getExpenses);
router.get('/:id', expenseController.getExpenseById);

router.patch(
  '/:id',
  upload.single('receipt'),
  [
    body('amount').optional().isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('expenseDate').optional().isISO8601().withMessage('Valid date required'),
  ],
  validate,
  expenseController.updateExpense
);

router.post('/:id/submit', expenseController.submitExpense);
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;

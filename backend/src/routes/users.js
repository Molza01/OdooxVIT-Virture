const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('ADMIN'),
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').trim().notEmpty().withMessage('First name required'),
    body('lastName').trim().notEmpty().withMessage('Last name required'),
    body('role').isIn(['ADMIN', 'DIRECTOR', 'FINANCE', 'MANAGER', 'EMPLOYEE']).withMessage('Invalid role'),
  ],
  validate,
  userController.createUser
);

router.get('/', authorize('ADMIN', 'DIRECTOR', 'FINANCE', 'MANAGER'), userController.getUsers);
router.get('/:id', authorize('ADMIN', 'DIRECTOR', 'FINANCE', 'MANAGER'), userController.getUserById);

router.patch(
  '/:id',
  authorize('ADMIN'),
  [
    body('role').optional().isIn(['ADMIN', 'DIRECTOR', 'FINANCE', 'MANAGER', 'EMPLOYEE']).withMessage('Invalid role'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  ],
  validate,
  userController.updateUser
);

router.delete('/:id', authorize('ADMIN'), userController.deleteUser);

module.exports = router;

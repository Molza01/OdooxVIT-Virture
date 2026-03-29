const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = Router();

router.post(
  '/signup',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').trim().notEmpty().withMessage('First name required'),
    body('lastName').trim().notEmpty().withMessage('Last name required'),
    body('companyName').trim().notEmpty().withMessage('Company name required'),
    body('country').trim().notEmpty().withMessage('Country required'),
    body('currency').trim().isLength({ min: 3, max: 3 }).withMessage('Currency code required'),
  ],
  validate,
  authController.signup
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  validate,
  authController.login
);

router.get('/profile', authenticate, authController.getProfile);

module.exports = router;

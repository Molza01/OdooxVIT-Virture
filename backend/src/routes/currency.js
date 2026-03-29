const { Router } = require('express');
const currencyController = require('../controllers/currencyController');

const router = Router();

// Public - no auth needed for countries list
router.get('/countries', currencyController.getCountries);
router.get('/exchange-rate', currencyController.getExchangeRate);
router.get('/convert', currencyController.convertAmount);

module.exports = router;

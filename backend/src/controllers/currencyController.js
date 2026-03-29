const currencyService = require('../services/currencyService');

const getCountries = async (req, res, next) => {
  try {
    const countries = await currencyService.getCountries();
    res.json(countries);
  } catch (err) {
    next(err);
  }
};

const getExchangeRate = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'Both "from" and "to" query params required' });
    }
    const result = await currencyService.getExchangeRate(from, to);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const convertAmount = async (req, res, next) => {
  try {
    const { amount, from, to } = req.query;
    if (!amount || !from || !to) {
      return res.status(400).json({ error: 'amount, from, and to query params required' });
    }
    const result = await currencyService.convertCurrency(parseFloat(amount), from, to);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { getCountries, getExchangeRate, convertAmount };

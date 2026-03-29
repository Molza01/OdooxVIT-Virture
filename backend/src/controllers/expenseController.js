const expenseService = require('../services/expenseService');

const createExpense = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.receiptPath = req.file.filename;
    }
    const expense = await expenseService.createExpense(
      req.user.id,
      req.user.companyId,
      data
    );
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
};

const getExpenses = async (req, res, next) => {
  try {
    const expenses = await expenseService.getExpenses(
      req.user.id,
      req.user.companyId,
      req.user.role,
      req.query
    );
    res.json(expenses);
  } catch (err) {
    next(err);
  }
};

const getExpenseById = async (req, res, next) => {
  try {
    const expense = await expenseService.getExpenseById(
      req.params.id,
      req.user.id,
      req.user.companyId,
      req.user.role
    );
    res.json(expense);
  } catch (err) {
    next(err);
  }
};

const updateExpense = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.receiptPath = req.file.filename;
    }
    const expense = await expenseService.updateExpense(
      req.params.id,
      req.user.id,
      data
    );
    res.json(expense);
  } catch (err) {
    next(err);
  }
};

const submitExpense = async (req, res, next) => {
  try {
    const expense = await expenseService.submitExpense(
      req.params.id,
      req.user.id,
      req.user.companyId
    );
    res.json(expense);
  } catch (err) {
    next(err);
  }
};

const deleteExpense = async (req, res, next) => {
  try {
    const result = await expenseService.deleteExpense(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getCategories = (req, res) => {
  res.json(expenseService.CATEGORIES);
};

module.exports = {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  submitExpense,
  deleteExpense,
  getCategories,
};

const approvalService = require('../services/approvalService');

const getPendingApprovals = async (req, res, next) => {
  try {
    const approvals = await approvalService.getPendingApprovals(
      req.user.id,
      req.user.companyId,
      req.user.role
    );
    res.json(approvals);
  } catch (err) {
    next(err);
  }
};

const approveExpense = async (req, res, next) => {
  try {
    const expense = await approvalService.approveExpense(
      req.params.id,
      req.user.id,
      req.body.comment,
      req.user.role
    );
    res.json(expense);
  } catch (err) {
    next(err);
  }
};

const rejectExpense = async (req, res, next) => {
  try {
    const expense = await approvalService.rejectExpense(
      req.params.id,
      req.user.id,
      req.body.comment,
      req.user.role
    );
    res.json(expense);
  } catch (err) {
    next(err);
  }
};

const overrideApproval = async (req, res, next) => {
  try {
    const expense = await approvalService.overrideApproval(
      req.params.id,
      req.user.id,
      req.body.action,
      req.body.comment
    );
    res.json(expense);
  } catch (err) {
    next(err);
  }
};

module.exports = { getPendingApprovals, approveExpense, rejectExpense, overrideApproval };

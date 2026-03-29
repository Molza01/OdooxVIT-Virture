const workflowService = require('../services/workflowService');

const createWorkflow = async (req, res, next) => {
  try {
    const workflow = await workflowService.createWorkflow(req.user.companyId, req.body);
    res.status(201).json(workflow);
  } catch (err) {
    next(err);
  }
};

const getWorkflows = async (req, res, next) => {
  try {
    const workflows = await workflowService.getWorkflows(req.user.companyId);
    res.json(workflows);
  } catch (err) {
    next(err);
  }
};

const getWorkflowById = async (req, res, next) => {
  try {
    const workflow = await workflowService.getWorkflowById(
      req.params.id,
      req.user.companyId
    );
    res.json(workflow);
  } catch (err) {
    next(err);
  }
};

const updateWorkflow = async (req, res, next) => {
  try {
    const workflow = await workflowService.updateWorkflow(
      req.params.id,
      req.user.companyId,
      req.body
    );
    res.json(workflow);
  } catch (err) {
    next(err);
  }
};

const deleteWorkflow = async (req, res, next) => {
  try {
    const result = await workflowService.deleteWorkflow(req.params.id, req.user.companyId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const createRule = async (req, res, next) => {
  try {
    const rule = await workflowService.createRule(req.user.companyId, req.body);
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
};

const getRules = async (req, res, next) => {
  try {
    const rules = await workflowService.getRules(req.user.companyId);
    res.json(rules);
  } catch (err) {
    next(err);
  }
};

const attachRuleToStep = async (req, res, next) => {
  try {
    const result = await workflowService.attachRuleToStep(
      req.params.stepId,
      req.body.ruleId,
      req.user.companyId
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createWorkflow,
  getWorkflows,
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
  createRule,
  getRules,
  attachRuleToStep,
};

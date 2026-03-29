const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const workflowController = require('../controllers/workflowController');

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Workflow name required'),
    body('steps').isArray({ min: 1 }).withMessage('At least one step required'),
    body('steps.*.approverRole')
      .optional()
      .isIn(['MANAGER', 'FINANCE', 'DIRECTOR', 'ADMIN'])
      .withMessage('Invalid approver role'),
  ],
  validate,
  workflowController.createWorkflow
);

router.get('/', workflowController.getWorkflows);
router.get('/:id', workflowController.getWorkflowById);
router.patch('/:id', workflowController.updateWorkflow);
router.delete('/:id', workflowController.deleteWorkflow);

// Rules
router.post(
  '/rules',
  [
    body('name').trim().notEmpty().withMessage('Rule name required'),
    body('ruleType').isIn(['PERCENTAGE', 'SPECIFIC_APPROVER', 'HYBRID']).withMessage('Invalid rule type'),
  ],
  validate,
  workflowController.createRule
);

router.get('/rules/all', workflowController.getRules);
router.post('/steps/:stepId/rules', workflowController.attachRuleToStep);

module.exports = router;

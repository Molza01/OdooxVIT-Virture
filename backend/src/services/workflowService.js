const prisma = require('../config/database');

const createWorkflow = async (companyId, data) => {
  const { name, description, minAmount, maxAmount, category, isDefault, isManagerApprover, steps } = data;

  // If setting as default, unset the current default
  if (isDefault) {
    await prisma.approvalWorkflow.updateMany({
      where: { companyId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.approvalWorkflow.create({
    data: {
      companyId,
      name,
      description,
      minAmount: minAmount || null,
      maxAmount: maxAmount || null,
      category: category || null,
      isDefault: isDefault || false,
      isManagerApprover: isManagerApprover !== undefined ? isManagerApprover : true,
      steps: {
        create: steps.map((step, index) => ({
          stepNumber: index + 1,
          approverId: step.approverId || null,
          approverRole: step.approverRole || null,
          isRequired: step.isRequired !== undefined ? step.isRequired : true,
          description: step.description || `Step ${index + 1}`,
        })),
      },
    },
    include: {
      steps: {
        orderBy: { stepNumber: 'asc' },
        include: {
          approver: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
};

const getWorkflows = async (companyId) => {
  return prisma.approvalWorkflow.findMany({
    where: { companyId },
    include: {
      steps: {
        orderBy: { stepNumber: 'asc' },
        include: {
          approver: { select: { id: true, firstName: true, lastName: true } },
          rules: { include: { rule: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

const getWorkflowById = async (workflowId, companyId) => {
  const workflow = await prisma.approvalWorkflow.findFirst({
    where: { id: workflowId, companyId },
    include: {
      steps: {
        orderBy: { stepNumber: 'asc' },
        include: {
          approver: { select: { id: true, firstName: true, lastName: true } },
          rules: { include: { rule: true } },
        },
      },
    },
  });

  if (!workflow) {
    throw Object.assign(new Error('Workflow not found'), { status: 404 });
  }

  return workflow;
};

const updateWorkflow = async (workflowId, companyId, data) => {
  const workflow = await prisma.approvalWorkflow.findFirst({
    where: { id: workflowId, companyId },
  });

  if (!workflow) {
    throw Object.assign(new Error('Workflow not found'), { status: 404 });
  }

  const updateData = {};
  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.minAmount !== undefined) updateData.minAmount = data.minAmount;
  if (data.maxAmount !== undefined) updateData.maxAmount = data.maxAmount;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.isManagerApprover !== undefined) updateData.isManagerApprover = data.isManagerApprover;

  if (data.isDefault) {
    await prisma.approvalWorkflow.updateMany({
      where: { companyId, isDefault: true },
      data: { isDefault: false },
    });
    updateData.isDefault = true;
  }

  // If steps are provided, replace them
  if (data.steps) {
    await prisma.approvalStep.deleteMany({ where: { workflowId } });
    updateData.steps = {
      create: data.steps.map((step, index) => ({
        stepNumber: index + 1,
        approverId: step.approverId || null,
        approverRole: step.approverRole || null,
        isRequired: step.isRequired !== undefined ? step.isRequired : true,
        description: step.description || `Step ${index + 1}`,
      })),
    };
  }

  return prisma.approvalWorkflow.update({
    where: { id: workflowId },
    data: updateData,
    include: {
      steps: {
        orderBy: { stepNumber: 'asc' },
        include: {
          approver: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
};

const deleteWorkflow = async (workflowId, companyId) => {
  const workflow = await prisma.approvalWorkflow.findFirst({
    where: { id: workflowId, companyId },
  });

  if (!workflow) {
    throw Object.assign(new Error('Workflow not found'), { status: 404 });
  }

  if (workflow.isDefault) {
    throw Object.assign(new Error('Cannot delete the default workflow'), { status: 400 });
  }

  await prisma.approvalWorkflow.delete({ where: { id: workflowId } });
  return { message: 'Workflow deleted' };
};

// --- Rules ---

const createRule = async (companyId, data) => {
  return prisma.approvalRule.create({
    data: {
      companyId,
      name: data.name,
      ruleType: data.ruleType,
      percentageThreshold: data.percentageThreshold || null,
      specificApproverId: data.specificApproverId || null,
      minAmount: data.minAmount || null,
      maxAmount: data.maxAmount || null,
    },
  });
};

const getRules = async (companyId) => {
  return prisma.approvalRule.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });
};

const attachRuleToStep = async (stepId, ruleId, companyId) => {
  // Verify both belong to the company
  const step = await prisma.approvalStep.findUnique({
    where: { id: stepId },
    include: { workflow: { select: { companyId: true } } },
  });

  if (!step || step.workflow.companyId !== companyId) {
    throw Object.assign(new Error('Step not found'), { status: 404 });
  }

  const rule = await prisma.approvalRule.findFirst({
    where: { id: ruleId, companyId },
  });

  if (!rule) {
    throw Object.assign(new Error('Rule not found'), { status: 404 });
  }

  return prisma.stepRule.create({
    data: { stepId, ruleId },
  });
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

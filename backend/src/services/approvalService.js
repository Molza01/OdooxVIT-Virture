const prisma = require('../config/database');

const expenseInclude = {
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  workflow: {
    include: {
      steps: {
        orderBy: { stepNumber: 'asc' },
        include: { approver: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  },
  approvals: {
    include: { approver: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { stepNumber: 'asc' },
  },
};

const getPendingApprovals = async (approverId, companyId, role) => {
  if (role === 'ADMIN') {
    // Admin sees ALL pending expenses in their company
    const expenses = await prisma.expense.findMany({
      where: { companyId, status: 'PENDING' },
      include: expenseInclude,
      orderBy: { createdAt: 'asc' },
    });

    // Return in the same shape as approval records (wrap each expense)
    return expenses.map((expense) => {
      // Find the approval record for the current step
      const currentApproval = expense.approvals.find(
        (a) => a.stepNumber === expense.currentStep && a.action === 'PENDING'
      );
      return {
        id: currentApproval?.id || expense.id,
        expenseId: expense.id,
        approverId,
        stepNumber: expense.currentStep,
        action: 'PENDING',
        expense,
      };
    });
  }

  // For MANAGER, FINANCE, DIRECTOR:
  // 1. Show approvals directly assigned to them at current step
  // 2. Show approvals at steps matching their role (even if assigned to someone else)

  const directApprovals = await prisma.expenseApproval.findMany({
    where: {
      approverId,
      action: 'PENDING',
      expense: { companyId, status: 'PENDING' },
    },
    include: {
      expense: { include: expenseInclude },
    },
    orderBy: { createdAt: 'asc' },
  });

  const results = directApprovals.filter(
    (a) => a.stepNumber === a.expense.currentStep
  );

  const alreadyIncluded = new Set(results.map((r) => r.expense.id));

  // Also find expenses where the current step's role matches this user's role
  // This handles cases where the approval was assigned to a fallback user
  const allPendingExpenses = await prisma.expense.findMany({
    where: { companyId, status: 'PENDING' },
    include: expenseInclude,
  });

  for (const expense of allPendingExpenses) {
    if (alreadyIncluded.has(expense.id)) continue;

    const currentStepDef = expense.workflow?.steps?.find(
      (s) => s.stepNumber === expense.currentStep
    );

    // Show if: step role matches user role, OR user is the employee's manager and step is MANAGER
    const roleMatch = currentStepDef?.approverRole === role;
    const isSubordinateManager = role === 'MANAGER' && expense.user?.managerId === approverId;

    if (roleMatch || isSubordinateManager || !currentStepDef) {
      const pendingApproval = expense.approvals.find(
        (a) => a.stepNumber === expense.currentStep && a.action === 'PENDING'
      );

      if (pendingApproval) {
        results.push({ ...pendingApproval, expense });
        alreadyIncluded.add(expense.id);
      }
    }
  }

  return results;
};

const approveExpense = async (expenseId, approverId, comment, role) => {
  return processApproval(expenseId, approverId, 'APPROVED', comment, role);
};

const rejectExpense = async (expenseId, approverId, comment, role) => {
  return processApproval(expenseId, approverId, 'REJECTED', comment, role);
};

const processApproval = async (expenseId, approverId, action, comment, role) => {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      workflow: {
        include: {
          steps: {
            orderBy: { stepNumber: 'asc' },
            include: { rules: { include: { rule: true } } },
          },
        },
      },
      approvals: true,
    },
  });

  if (!expense) {
    throw Object.assign(new Error('Expense not found'), { status: 404 });
  }

  if (expense.status !== 'PENDING') {
    throw Object.assign(new Error('Expense is not pending approval'), { status: 400 });
  }

  // Find the approval record for this approver at the current step
  let approval = await prisma.expenseApproval.findFirst({
    where: {
      expenseId,
      approverId,
      stepNumber: expense.currentStep,
      action: 'PENDING',
    },
  });

  // MANAGER/FINANCE/DIRECTOR: can approve if the current step's role matches their role
  if (!approval && ['MANAGER', 'FINANCE', 'DIRECTOR'].includes(role)) {
    const currentStepDef = expense.workflow?.steps?.find(
      (s) => s.stepNumber === expense.currentStep
    );

    // Allow if: step role matches user role, or user is the employee's direct manager
    const roleMatch = currentStepDef?.approverRole === role;
    let isSubordinateManager = false;
    if (role === 'MANAGER') {
      const submitter = await prisma.user.findUnique({
        where: { id: expense.userId },
        select: { managerId: true },
      });
      isSubordinateManager = submitter?.managerId === approverId;
    }

    if (roleMatch || isSubordinateManager) {
      approval = await prisma.expenseApproval.findFirst({
        where: {
          expenseId,
          stepNumber: expense.currentStep,
          action: 'PENDING',
        },
      });
    }
  }

  // Admin can approve ANY expense at ANY step — they are the top authority
  if (!approval && role === 'ADMIN') {
    approval = await prisma.expenseApproval.findFirst({
      where: {
        expenseId,
        stepNumber: expense.currentStep,
        action: 'PENDING',
      },
    });

    // If still no record, create one on the fly
    if (!approval) {
      approval = await prisma.expenseApproval.create({
        data: {
          expenseId,
          approverId,
          stepNumber: expense.currentStep,
          action: 'PENDING',
        },
      });
    }
  }

  if (!approval) {
    throw Object.assign(new Error(
      `Cannot approve at this step. The expense is at step ${expense.currentStep} and is waiting for a different approver.`
    ), { status: 403 });
  }

  return prisma.$transaction(async (tx) => {
    // Record the decision (update the approval record with the acting user)
    await tx.expenseApproval.update({
      where: { id: approval.id },
      data: {
        action,
        comment,
        approverId, // Update to the actual person who acted (important for Admin)
        decidedAt: new Date(),
      },
    });

    if (action === 'REJECTED') {
      return tx.expense.update({
        where: { id: expenseId },
        data: { status: 'REJECTED' },
        include: expenseInclude,
      });
    }

    // --- APPROVED: decide whether to advance ---
    const currentStepDef = expense.workflow?.steps?.find(
      (s) => s.stepNumber === expense.currentStep
    );

    const shouldAdvance = await evaluateStepRules(tx, expense, currentStepDef);

    if (!shouldAdvance) {
      return tx.expense.findUnique({
        where: { id: expenseId },
        include: expenseInclude,
      });
    }

    // Find the next step
    const allStepNumbers = getOrderedStepNumbers(expense);
    const currentIndex = allStepNumbers.indexOf(expense.currentStep);
    const nextStepIndex = currentIndex + 1;

    if (nextStepIndex >= allStepNumbers.length) {
      // Last step — fully approved
      return tx.expense.update({
        where: { id: expenseId },
        data: { status: 'APPROVED' },
        include: expenseInclude,
      });
    }

    // Move to next step
    const nextStep = allStepNumbers[nextStepIndex];
    return tx.expense.update({
      where: { id: expenseId },
      data: { currentStep: nextStep },
      include: expenseInclude,
    });
  });
};

const getOrderedStepNumbers = (expense) => {
  const stepNumbers = new Set();
  for (const a of expense.approvals) {
    stepNumbers.add(a.stepNumber);
  }
  return [...stepNumbers].sort((a, b) => a - b);
};

const evaluateStepRules = async (tx, expense, stepDef) => {
  const stepApprovals = await tx.expenseApproval.findMany({
    where: { expenseId: expense.id, stepNumber: expense.currentStep },
  });

  if (!stepDef?.rules?.length) {
    // No conditional rules — all approvers at this step must approve
    return stepApprovals.length > 0 && stepApprovals.every((a) => a.action === 'APPROVED');
  }

  for (const { rule } of stepDef.rules) {
    if (rule.ruleType === 'SPECIFIC_APPROVER') {
      const specificApproval = await tx.expenseApproval.findFirst({
        where: {
          expenseId: expense.id,
          approverId: rule.specificApproverId,
          action: 'APPROVED',
        },
      });
      if (specificApproval) return true;
    }

    if (rule.ruleType === 'PERCENTAGE') {
      const approved = stepApprovals.filter((a) => a.action === 'APPROVED').length;
      const total = stepApprovals.length;
      const percentage = total > 0 ? (approved / total) * 100 : 0;
      if (percentage >= (rule.percentageThreshold || 100)) return true;
    }

    if (rule.ruleType === 'HYBRID') {
      if (rule.specificApproverId) {
        const specificApproval = await tx.expenseApproval.findFirst({
          where: {
            expenseId: expense.id,
            approverId: rule.specificApproverId,
            action: 'APPROVED',
          },
        });
        if (specificApproval) return true;
      }

      if (rule.percentageThreshold) {
        const approved = stepApprovals.filter((a) => a.action === 'APPROVED').length;
        const total = stepApprovals.length;
        const percentage = total > 0 ? (approved / total) * 100 : 0;
        if (percentage >= rule.percentageThreshold) return true;
      }
    }
  }

  return false;
};

const overrideApproval = async (expenseId, adminId, action, comment) => {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });

  if (!expense) {
    throw Object.assign(new Error('Expense not found'), { status: 404 });
  }

  if (expense.status !== 'PENDING') {
    throw Object.assign(new Error('Can only override pending expenses'), { status: 400 });
  }

  return prisma.$transaction(async (tx) => {
    await tx.expenseApproval.updateMany({
      where: { expenseId, action: 'PENDING' },
      data: { action, comment: `Admin override: ${comment || ''}`, decidedAt: new Date() },
    });

    await tx.expenseApproval.create({
      data: {
        expenseId,
        approverId: adminId,
        stepNumber: -1,
        action,
        comment: `Admin override: ${comment || ''}`,
        decidedAt: new Date(),
      },
    });

    return tx.expense.update({
      where: { id: expenseId },
      data: { status: action === 'APPROVED' ? 'APPROVED' : 'REJECTED' },
      include: expenseInclude,
    });
  });
};

module.exports = {
  getPendingApprovals,
  approveExpense,
  rejectExpense,
  overrideApproval,
};

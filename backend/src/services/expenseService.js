const prisma = require('../config/database');
const currencyService = require('./currencyService');

const CATEGORIES = [
  'Travel',
  'Meals',
  'Office Supplies',
  'Software',
  'Hardware',
  'Training',
  'Client Entertainment',
  'Transportation',
  'Accommodation',
  'Miscellaneous',
  'Other',
];

const createExpense = async (userId, companyId, data) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { currency: true },
  });

  let convertedAmount = null;
  let exchangeRate = null;
  const expenseCurrency = data.currency || company.currency;

  if (expenseCurrency !== company.currency) {
    try {
      const conversion = await currencyService.convertCurrency(
        parseFloat(data.amount),
        expenseCurrency,
        company.currency
      );
      convertedAmount = conversion.convertedAmount;
      exchangeRate = conversion.exchangeRate;
    } catch (err) {
      console.error('Currency conversion failed:', err.message);
    }
  } else {
    convertedAmount = parseFloat(data.amount);
    exchangeRate = 1;
  }

  return prisma.expense.create({
    data: {
      userId,
      companyId,
      title: data.title || null,
      amount: data.amount,
      currency: expenseCurrency,
      convertedAmount,
      companyCurrency: company.currency,
      exchangeRate,
      category: data.category,
      paidBy: data.paidBy || 'PERSONAL',
      description: data.description,
      expenseDate: new Date(data.expenseDate),
      receiptPath: data.receiptPath || null,
      status: 'DRAFT', // Always create as draft first
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  // If submitNow, run the full submit flow (assigns workflow + creates approval records)
  if (data.submitNow) {
    return submitExpense(expense.id, userId, companyId);
  }

  return expense;
};

const getExpenses = async (userId, companyId, role, filters = {}) => {
  const where = { companyId };

  if (role === 'EMPLOYEE') {
    where.userId = userId;
  } else if (role === 'MANAGER') {
    where.OR = [
      { userId },
      { user: { managerId: userId } },
    ];
  }

  if (filters.status) where.status = filters.status;
  if (filters.category) where.category = filters.category;
  if (filters.fromDate || filters.toDate) {
    where.expenseDate = {};
    if (filters.fromDate) where.expenseDate.gte = new Date(filters.fromDate);
    if (filters.toDate) where.expenseDate.lte = new Date(filters.toDate);
  }

  return prisma.expense.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      approvals: {
        include: {
          approver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { stepNumber: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

const getExpenseById = async (expenseId, userId, companyId, role) => {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, companyId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      workflow: { include: { steps: { orderBy: { stepNumber: 'asc' } } } },
      approvals: {
        include: {
          approver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  if (!expense) {
    throw Object.assign(new Error('Expense not found'), { status: 404 });
  }

  if (role === 'EMPLOYEE' && expense.userId !== userId) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }

  return expense;
};

const updateExpense = async (expenseId, userId, data) => {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, userId },
  });

  if (!expense) {
    throw Object.assign(new Error('Expense not found'), { status: 404 });
  }

  if (expense.status !== 'DRAFT') {
    throw Object.assign(new Error('Only draft expenses can be edited'), { status: 400 });
  }

  const updateData = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.currency) updateData.currency = data.currency;
  if (data.category) updateData.category = data.category;
  if (data.paidBy) updateData.paidBy = data.paidBy;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.expenseDate) updateData.expenseDate = new Date(data.expenseDate);
  if (data.receiptPath) updateData.receiptPath = data.receiptPath;

  if (data.amount || data.currency) {
    const company = await prisma.company.findUnique({
      where: { id: expense.companyId },
      select: { currency: true },
    });
    const newCurrency = data.currency || expense.currency;
    const newAmount = data.amount || expense.amount;

    if (newCurrency !== company.currency) {
      try {
        const conversion = await currencyService.convertCurrency(
          parseFloat(newAmount),
          newCurrency,
          company.currency
        );
        updateData.convertedAmount = conversion.convertedAmount;
        updateData.exchangeRate = conversion.exchangeRate;
        updateData.companyCurrency = company.currency;
      } catch (err) {
        console.error('Currency conversion failed:', err.message);
      }
    } else {
      updateData.convertedAmount = parseFloat(newAmount);
      updateData.exchangeRate = 1;
      updateData.companyCurrency = company.currency;
    }
  }

  return prisma.expense.update({
    where: { id: expenseId },
    data: updateData,
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  });
};

const submitExpense = async (expenseId, userId, companyId) => {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, userId },
  });

  if (!expense) {
    throw Object.assign(new Error('Expense not found'), { status: 404 });
  }

  if (expense.status !== 'DRAFT') {
    throw Object.assign(new Error('Only draft expenses can be submitted'), { status: 400 });
  }

  const workflow = await findApplicableWorkflow(companyId, expense.amount, expense.category);

  if (!workflow) {
    throw Object.assign(new Error('No approval workflow configured. Contact your admin.'), { status: 400 });
  }

  const steps = await prisma.approvalStep.findMany({
    where: { workflowId: workflow.id },
    orderBy: { stepNumber: 'asc' },
    include: { approver: true },
  });

  return prisma.$transaction(async (tx) => {
    let hasManagerPreStep = false;

    // If isManagerApprover is true, add the employee's direct manager as step 0
    if (workflow.isManagerApprover) {
      const submitter = await tx.user.findUnique({
        where: { id: userId },
        select: { managerId: true },
      });
      if (submitter?.managerId) {
        const managerAlreadyInSteps = steps.some(
          (s) => s.approverId === submitter.managerId
        );
        if (!managerAlreadyInSteps) {
          await tx.expenseApproval.create({
            data: {
              expenseId,
              approverId: submitter.managerId,
              stepNumber: 0,
              action: 'PENDING',
            },
          });
          hasManagerPreStep = true;
        }
      }
    }

    // Create approval records for each workflow step
    for (const step of steps) {
      let approverId = step.approverId;

      if (!approverId && step.approverRole) {
        const approver = await resolveApproverByRole(tx, userId, companyId, step.approverRole);
        approverId = approver?.id;
      }

      if (approverId) {
        await tx.expenseApproval.create({
          data: {
            expenseId,
            approverId,
            stepNumber: step.stepNumber,
            action: 'PENDING',
          },
        });
      }
    }

    const firstStep = hasManagerPreStep ? 0 : 1;

    return tx.expense.update({
      where: { id: expenseId },
      data: {
        status: 'PENDING',
        workflowId: workflow.id,
        currentStep: firstStep,
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        approvals: {
          include: {
            approver: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  });
};

const deleteExpense = async (expenseId, userId) => {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, userId },
  });

  if (!expense) {
    throw Object.assign(new Error('Expense not found'), { status: 404 });
  }

  if (expense.status !== 'DRAFT') {
    throw Object.assign(new Error('Only draft expenses can be deleted'), { status: 400 });
  }

  await prisma.expense.delete({ where: { id: expenseId } });
  return { message: 'Expense deleted' };
};

// --- Helpers ---

const findApplicableWorkflow = async (companyId, amount, category) => {
  const specific = await prisma.approvalWorkflow.findFirst({
    where: {
      companyId,
      isActive: true,
      OR: [
        {
          AND: [
            { minAmount: { lte: amount } },
            { maxAmount: { gte: amount } },
          ],
        },
        { category },
      ],
    },
    include: { steps: { orderBy: { stepNumber: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });

  if (specific) return specific;

  return prisma.approvalWorkflow.findFirst({
    where: { companyId, isDefault: true, isActive: true },
    include: { steps: { orderBy: { stepNumber: 'asc' } } },
  });
};

const resolveApproverByRole = async (tx, userId, companyId, role) => {
  if (role === 'MANAGER') {
    // 1. Try the submitter's direct manager
    const submitter = await tx.user.findUnique({
      where: { id: userId },
      select: { managerId: true },
    });
    if (submitter?.managerId) {
      return { id: submitter.managerId };
    }

    // 2. Fallback: any active MANAGER in the company
    const manager = await tx.user.findFirst({
      where: { companyId, role: 'MANAGER', isActive: true },
      select: { id: true },
    });
    if (manager) return manager;

    // 3. Final fallback: ADMIN (so approvals don't get stuck)
    return tx.user.findFirst({
      where: { companyId, role: 'ADMIN', isActive: true },
      select: { id: true },
    });
  }

  if (role === 'FINANCE') {
    const finance = await tx.user.findFirst({
      where: { companyId, role: 'FINANCE', isActive: true },
      select: { id: true },
    });
    if (finance) return finance;
    // Fallback to ADMIN
    return tx.user.findFirst({
      where: { companyId, role: 'ADMIN', isActive: true },
      select: { id: true },
    });
  }

  if (role === 'DIRECTOR') {
    const director = await tx.user.findFirst({
      where: { companyId, role: 'DIRECTOR', isActive: true },
      select: { id: true },
    });
    if (director) return director;
    return tx.user.findFirst({
      where: { companyId, role: 'ADMIN', isActive: true },
      select: { id: true },
    });
  }

  if (role === 'ADMIN') {
    return tx.user.findFirst({
      where: { companyId, role: 'ADMIN', isActive: true },
      select: { id: true },
    });
  }

  // Fallback for any unknown role: use ADMIN
  return tx.user.findFirst({
    where: { companyId, role: 'ADMIN', isActive: true },
    select: { id: true },
  });
};

module.exports = {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  submitExpense,
  deleteExpense,
  CATEGORIES,
};

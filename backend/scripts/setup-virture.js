/**
 * Set up Virture company with FINANCE and DIRECTOR test users,
 * and fix all pending expenses to use the correct 3-step workflow.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const COMPANY_ID = 'ccafedd2-f9b2-41b3-a81d-5b50b86c47a7'; // Virture

async function main() {
  const hash = (pw) => bcrypt.hashSync(pw, 12);

  // Check if FINANCE user exists
  let financeUser = await prisma.user.findFirst({ where: { companyId: COMPANY_ID, role: 'FINANCE' } });
  if (!financeUser) {
    financeUser = await prisma.user.create({
      data: {
        email: 'finance@virture.com',
        passwordHash: hash('password123'),
        firstName: 'Suresh',
        lastName: 'Finance',
        role: 'FINANCE',
        companyId: COMPANY_ID,
      },
    });
    console.log('Created FINANCE user: Suresh Finance (finance@virture.com / password123)');
  } else {
    console.log('FINANCE user exists:', financeUser.firstName, financeUser.lastName);
  }

  // Check if DIRECTOR user exists
  let directorUser = await prisma.user.findFirst({ where: { companyId: COMPANY_ID, role: 'DIRECTOR' } });
  if (!directorUser) {
    directorUser = await prisma.user.create({
      data: {
        email: 'director@virture.com',
        passwordHash: hash('password123'),
        firstName: 'Priya',
        lastName: 'Director',
        role: 'DIRECTOR',
        companyId: COMPANY_ID,
      },
    });
    console.log('Created DIRECTOR user: Priya Director (director@virture.com / password123)');
  } else {
    console.log('DIRECTOR user exists:', directorUser.firstName, directorUser.lastName);
  }

  // Get the manager
  const manager = await prisma.user.findFirst({ where: { companyId: COMPANY_ID, role: 'MANAGER' } });
  const admin = await prisma.user.findFirst({ where: { companyId: COMPANY_ID, role: 'ADMIN' } });

  console.log('\nVirture team:');
  console.log('  ADMIN:', admin.firstName, admin.lastName);
  console.log('  MANAGER:', manager.firstName, manager.lastName);
  console.log('  FINANCE:', financeUser.firstName, financeUser.lastName);
  console.log('  DIRECTOR:', directorUser.firstName, directorUser.lastName);

  // Get the default workflow
  const workflow = await prisma.approvalWorkflow.findFirst({
    where: { companyId: COMPANY_ID, isDefault: true },
    include: { steps: { orderBy: { stepNumber: 'asc' } } },
  });

  console.log('\nWorkflow:', workflow.name);
  workflow.steps.forEach(s => console.log('  Step', s.stepNumber, ':', s.approverRole));

  // Fix all pending expenses
  const pending = await prisma.expense.findMany({
    where: { companyId: COMPANY_ID, status: 'PENDING' },
    include: { user: { select: { id: true, firstName: true, managerId: true } }, approvals: true },
  });

  console.log('\nFixing', pending.length, 'pending expenses...');

  for (const expense of pending) {
    // Check what's already approved
    const approvedSteps = expense.approvals.filter(a => a.action === 'APPROVED').map(a => a.stepNumber);
    const lastApproved = approvedSteps.length > 0 ? Math.max(...approvedSteps) : 0;

    // Delete old approvals
    await prisma.expenseApproval.deleteMany({ where: { expenseId: expense.id } });

    // Resolve correct approvers
    const managerId = expense.user.managerId || manager.id;
    const approvals = [
      { expenseId: expense.id, approverId: managerId, stepNumber: 1, action: lastApproved >= 1 ? 'APPROVED' : 'PENDING', ...(lastApproved >= 1 ? { decidedAt: new Date(), comment: 'Approved' } : {}) },
      { expenseId: expense.id, approverId: financeUser.id, stepNumber: 2, action: lastApproved >= 2 ? 'APPROVED' : 'PENDING', ...(lastApproved >= 2 ? { decidedAt: new Date(), comment: 'Approved' } : {}) },
      { expenseId: expense.id, approverId: directorUser.id, stepNumber: 3, action: lastApproved >= 3 ? 'APPROVED' : 'PENDING', ...(lastApproved >= 3 ? { decidedAt: new Date(), comment: 'Approved' } : {}) },
    ];

    const nextStep = lastApproved + 1 > 3 ? 3 : lastApproved + 1;

    await prisma.$transaction(async (tx) => {
      for (const a of approvals) {
        await tx.expenseApproval.create({ data: a });
      }
      await tx.expense.update({
        where: { id: expense.id },
        data: { workflowId: workflow.id, currentStep: nextStep },
      });
    });

    console.log(`  "${expense.title || 'Expense'}" by ${expense.user.firstName}: currentStep=${nextStep}`);
    approvals.forEach(a => {
      const roleName = a.approverId === managerId ? 'MANAGER' : a.approverId === financeUser.id ? 'FINANCE' : 'DIRECTOR';
      console.log(`    Step ${a.stepNumber} (${roleName}): ${a.action}`);
    });
  }

  console.log('\nDone! The flow is now:');
  console.log('  Employee submits → Manager approves → Finance approves → Director approves → APPROVED');
  console.log('  Admin (Sandesh) can override/approve at any step');
  console.log('\nTest accounts:');
  console.log('  Finance: finance@virture.com / password123');
  console.log('  Director: director@virture.com / password123');
}

main().catch(console.error).finally(() => prisma.$disconnect());

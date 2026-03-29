/**
 * Fix stuck PENDING expenses that have no approval records.
 * This finds the applicable workflow, resolves approvers, and creates
 * the missing ExpenseApproval records.
 *
 * Run: node scripts/fix-stuck-expenses.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Find all PENDING expenses with zero approval records
  const stuckExpenses = await prisma.expense.findMany({
    where: {
      status: 'PENDING',
      approvals: { none: {} },
    },
    include: {
      user: { select: { id: true, managerId: true, companyId: true, firstName: true, lastName: true } },
    },
  });

  console.log(`Found ${stuckExpenses.length} stuck expense(s) with no approval records.\n`);

  if (stuckExpenses.length === 0) {
    console.log('Nothing to fix!');
    return;
  }

  for (const expense of stuckExpenses) {
    console.log(`Fixing: "${expense.title || expense.description}" by ${expense.user.firstName} ${expense.user.lastName}`);
    console.log(`  Amount: ${expense.currency} ${expense.amount}`);

    const companyId = expense.user.companyId;

    // Find the applicable workflow
    let workflow = await prisma.approvalWorkflow.findFirst({
      where: {
        companyId,
        isActive: true,
        OR: [
          {
            AND: [
              { minAmount: { lte: expense.amount } },
              { maxAmount: { gte: expense.amount } },
            ],
          },
          { category: expense.category },
        ],
      },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });

    if (!workflow) {
      workflow = await prisma.approvalWorkflow.findFirst({
        where: { companyId, isDefault: true, isActive: true },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      });
    }

    if (!workflow) {
      console.log('  ERROR: No workflow found for this company. Skipping.\n');
      continue;
    }

    console.log(`  Workflow: "${workflow.name}" (${workflow.steps.length} steps)`);

    const approvalRecords = [];

    // If isManagerApprover, add step 0 for employee's direct manager
    if (workflow.isManagerApprover && expense.user.managerId) {
      const managerInSteps = workflow.steps.some((s) => s.approverId === expense.user.managerId);
      if (!managerInSteps) {
        approvalRecords.push({
          expenseId: expense.id,
          approverId: expense.user.managerId,
          stepNumber: 0,
          action: 'PENDING',
        });
      }
    }

    // Create records for each workflow step
    for (const step of workflow.steps) {
      let approverId = step.approverId;

      if (!approverId && step.approverRole) {
        // Resolve by role
        if (step.approverRole === 'MANAGER') {
          if (expense.user.managerId) {
            approverId = expense.user.managerId;
          } else {
            const mgr = await prisma.user.findFirst({
              where: { companyId, role: 'MANAGER', isActive: true },
              select: { id: true },
            });
            if (mgr) {
              approverId = mgr.id;
            } else {
              // Fallback to ADMIN
              const admin = await prisma.user.findFirst({
                where: { companyId, role: 'ADMIN', isActive: true },
                select: { id: true },
              });
              approverId = admin?.id;
            }
          }
        } else if (step.approverRole === 'ADMIN') {
          const admin = await prisma.user.findFirst({
            where: { companyId, role: 'ADMIN', isActive: true },
            select: { id: true },
          });
          approverId = admin?.id;
        }
      }

      if (approverId) {
        approvalRecords.push({
          expenseId: expense.id,
          approverId,
          stepNumber: step.stepNumber,
          action: 'PENDING',
        });
      }
    }

    if (approvalRecords.length === 0) {
      console.log('  ERROR: Could not resolve any approvers. Skipping.\n');
      continue;
    }

    // Create all approval records and set the workflow + currentStep
    const firstStep = approvalRecords[0].stepNumber;

    await prisma.$transaction(async (tx) => {
      await tx.expenseApproval.createMany({ data: approvalRecords });
      await tx.expense.update({
        where: { id: expense.id },
        data: {
          workflowId: workflow.id,
          currentStep: firstStep,
        },
      });
    });

    console.log(`  Created ${approvalRecords.length} approval record(s). Current step set to ${firstStep}.`);
    for (const rec of approvalRecords) {
      const approver = await prisma.user.findUnique({
        where: { id: rec.approverId },
        select: { firstName: true, lastName: true, role: true },
      });
      console.log(`    Step ${rec.stepNumber}: ${approver.firstName} ${approver.lastName} (${approver.role})`);
    }
    console.log('');
  }

  console.log('Done! Restart your backend server and check the Approvals page.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

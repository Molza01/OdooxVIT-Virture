/**
 * Fix ALL stuck pending expenses:
 * 1. Assign the correct workflow
 * 2. Create missing approval records
 * 3. Set currentStep correctly
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find all pending expenses missing approvals OR workflow
  const stuck = await prisma.expense.findMany({
    where: {
      status: 'PENDING',
      OR: [
        { approvals: { none: {} } },
        { workflowId: null },
      ],
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, managerId: true, companyId: true } },
    },
  });

  console.log(`Found ${stuck.length} stuck expense(s)\n`);

  for (const expense of stuck) {
    console.log(`Fixing: "${expense.title || expense.category}" by ${expense.user.firstName} ${expense.user.lastName}`);

    const companyId = expense.user.companyId;

    // Find the default workflow for this company
    const workflow = await prisma.approvalWorkflow.findFirst({
      where: { companyId, isDefault: true, isActive: true },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' }, // Latest default
    });

    if (!workflow) {
      console.log('  ERROR: No default workflow. Skipping.\n');
      continue;
    }

    console.log(`  Using workflow: "${workflow.name}" (${workflow.steps.length} steps)`);

    // Delete any existing bad approval records
    await prisma.expenseApproval.deleteMany({ where: { expenseId: expense.id } });

    const approvals = [];

    // If isManagerApprover and employee has a manager, add step 0
    let hasStep0 = false;
    if (workflow.isManagerApprover && expense.user.managerId) {
      const managerInSteps = workflow.steps.some(s => s.approverId === expense.user.managerId);
      if (!managerInSteps) {
        approvals.push({
          expenseId: expense.id,
          approverId: expense.user.managerId,
          stepNumber: 0,
          action: 'PENDING',
        });
        hasStep0 = true;
      }
    }

    // Create approval for each step
    for (const step of workflow.steps) {
      let approverId = step.approverId;

      if (!approverId && step.approverRole === 'MANAGER') {
        approverId = expense.user.managerId;
        if (!approverId) {
          const mgr = await prisma.user.findFirst({ where: { companyId, role: 'MANAGER', isActive: true }, select: { id: true } });
          approverId = mgr?.id;
        }
        if (!approverId) {
          const admin = await prisma.user.findFirst({ where: { companyId, role: 'ADMIN', isActive: true }, select: { id: true } });
          approverId = admin?.id;
        }
      } else if (!approverId && step.approverRole === 'ADMIN') {
        const admin = await prisma.user.findFirst({ where: { companyId, role: 'ADMIN', isActive: true }, select: { id: true } });
        approverId = admin?.id;
      }

      if (approverId) {
        approvals.push({
          expenseId: expense.id,
          approverId,
          stepNumber: step.stepNumber,
          action: 'PENDING',
        });
      }
    }

    const firstStep = hasStep0 ? 0 : (approvals[0]?.stepNumber || 1);

    await prisma.$transaction(async (tx) => {
      await tx.expenseApproval.createMany({ data: approvals });
      await tx.expense.update({
        where: { id: expense.id },
        data: { workflowId: workflow.id, currentStep: firstStep },
      });
    });

    console.log(`  Created ${approvals.length} approval(s), currentStep=${firstStep}`);
    for (const a of approvals) {
      const user = await prisma.user.findUnique({ where: { id: a.approverId }, select: { firstName: true, lastName: true, role: true } });
      console.log(`    Step ${a.stepNumber}: ${user.firstName} ${user.lastName} (${user.role})`);
    }
    console.log('');
  }

  console.log('Done! Restart backend.');
}

main().catch(console.error).finally(() => prisma.$disconnect());

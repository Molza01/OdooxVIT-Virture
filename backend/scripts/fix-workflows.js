/**
 * Fix workflows:
 * 1. Keep only ONE default workflow with 3 steps: Manager → Finance → Director
 * 2. Admin is NOT a step (Admin can override anytime)
 * 3. Reassign stuck expenses to the correct workflow
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get the company (Sandesh's company)
  const companies = await prisma.company.findMany();

  for (const company of companies) {
    console.log(`\nCompany: ${company.name} (${company.id})\n`);

    // 1. Unset ALL defaults first
    await prisma.approvalWorkflow.updateMany({
      where: { companyId: company.id },
      data: { isDefault: false },
    });
    console.log('Reset all workflow defaults.');

    // 2. Check if a 3-step (Manager→Finance→Director) workflow exists
    let mainWorkflow = await prisma.approvalWorkflow.findFirst({
      where: { companyId: company.id, name: 'Standard Approval' },
      include: { steps: true },
    });

    if (!mainWorkflow) {
      // Create the correct 3-step workflow
      mainWorkflow = await prisma.approvalWorkflow.create({
        data: {
          companyId: company.id,
          name: 'Standard Approval',
          description: 'Manager → Finance → Director (Admin can override at any step)',
          isDefault: true,
          isManagerApprover: false,
          isActive: true,
          steps: {
            create: [
              { stepNumber: 1, approverRole: 'MANAGER', description: 'Manager Approval' },
              { stepNumber: 2, approverRole: 'FINANCE', description: 'Finance Review' },
              { stepNumber: 3, approverRole: 'DIRECTOR', description: 'Director Approval' },
            ],
          },
        },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      });
      console.log('Created "Standard Approval" workflow (Manager → Finance → Director)');
    } else {
      await prisma.approvalWorkflow.update({
        where: { id: mainWorkflow.id },
        data: { isDefault: true },
      });
      console.log('Set "Standard Approval" as default');
    }

    console.log(`Default workflow: "${mainWorkflow.name}" with ${mainWorkflow.steps.length} steps`);
    for (const s of mainWorkflow.steps) {
      console.log(`  Step ${s.stepNumber}: ${s.approverRole} — ${s.description}`);
    }

    // 3. Fix all pending expenses — reassign to correct workflow and recreate approvals
    const pendingExpenses = await prisma.expense.findMany({
      where: { companyId: company.id, status: 'PENDING' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, managerId: true } },
        approvals: true,
      },
    });

    console.log(`\nFixing ${pendingExpenses.length} pending expense(s)...`);

    for (const expense of pendingExpenses) {
      console.log(`  "${expense.title || expense.category}" by ${expense.user.firstName} ${expense.user.lastName}`);

      // Check which step has been approved already
      const approvedSteps = expense.approvals
        .filter(a => a.action === 'APPROVED')
        .map(a => a.stepNumber)
        .sort((a, b) => a - b);

      const lastApprovedStep = approvedSteps.length > 0 ? Math.max(...approvedSteps) : 0;

      // Delete all existing approvals
      await prisma.expenseApproval.deleteMany({ where: { expenseId: expense.id } });

      // Resolve approvers for each step
      const approvals = [];
      for (const step of mainWorkflow.steps) {
        let approverId = null;

        if (step.approverRole === 'MANAGER') {
          approverId = expense.user.managerId;
          if (!approverId) {
            const mgr = await prisma.user.findFirst({ where: { companyId: company.id, role: 'MANAGER', isActive: true }, select: { id: true } });
            approverId = mgr?.id;
          }
        } else if (step.approverRole === 'FINANCE') {
          const fin = await prisma.user.findFirst({ where: { companyId: company.id, role: 'FINANCE', isActive: true }, select: { id: true } });
          approverId = fin?.id;
          if (!approverId) {
            const admin = await prisma.user.findFirst({ where: { companyId: company.id, role: 'ADMIN', isActive: true }, select: { id: true } });
            approverId = admin?.id;
          }
        } else if (step.approverRole === 'DIRECTOR') {
          const dir = await prisma.user.findFirst({ where: { companyId: company.id, role: 'DIRECTOR', isActive: true }, select: { id: true } });
          approverId = dir?.id;
          if (!approverId) {
            const admin = await prisma.user.findFirst({ where: { companyId: company.id, role: 'ADMIN', isActive: true }, select: { id: true } });
            approverId = admin?.id;
          }
        } else if (step.approverRole === 'ADMIN') {
          const admin = await prisma.user.findFirst({ where: { companyId: company.id, role: 'ADMIN', isActive: true }, select: { id: true } });
          approverId = admin?.id;
        }

        if (approverId) {
          // If this step was already approved, mark it as approved
          const isAlreadyApproved = step.stepNumber <= lastApprovedStep;
          approvals.push({
            expenseId: expense.id,
            approverId,
            stepNumber: step.stepNumber,
            action: isAlreadyApproved ? 'APPROVED' : 'PENDING',
            ...(isAlreadyApproved ? { decidedAt: new Date(), comment: 'Migrated from previous workflow' } : {}),
          });
        }
      }

      // Find the next pending step
      const nextPendingStep = approvals.find(a => a.action === 'PENDING')?.stepNumber || 1;

      await prisma.$transaction(async (tx) => {
        for (const a of approvals) {
          await tx.expenseApproval.create({ data: a });
        }
        await tx.expense.update({
          where: { id: expense.id },
          data: { workflowId: mainWorkflow.id, currentStep: nextPendingStep },
        });
      });

      const approverNames = [];
      for (const a of approvals) {
        const u = await prisma.user.findUnique({ where: { id: a.approverId }, select: { firstName: true, role: true } });
        approverNames.push(`Step ${a.stepNumber}: ${u.firstName} (${u.role}) → ${a.action}`);
      }
      console.log(`    Workflow: ${mainWorkflow.name}, currentStep: ${nextPendingStep}`);
      approverNames.forEach(n => console.log(`    ${n}`));
    }
  }

  console.log('\nDone! Restart backend.');
}

main().catch(console.error).finally(() => prisma.$disconnect());

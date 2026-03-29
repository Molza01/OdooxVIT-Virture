/**
 * Fix expenses stuck at step 0 by removing step 0 records
 * and resetting currentStep to 1.
 * Also fix the Default Workflow to disable isManagerApprover.
 *
 * Run: node scripts/fix-step0.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // 1. Fix Default Workflow: disable isManagerApprover
  const updated = await prisma.approvalWorkflow.updateMany({
    where: { name: 'Default Workflow', isManagerApprover: true },
    data: { isManagerApprover: false },
  });
  console.log(`Fixed ${updated.count} workflow(s): set isManagerApprover = false`);

  // 2. Delete all step 0 approval records (manager pre-steps)
  const deleted = await prisma.expenseApproval.deleteMany({
    where: { stepNumber: 0 },
  });
  console.log(`Deleted ${deleted.count} step-0 approval record(s)`);

  // 3. Fix any expenses stuck at currentStep 0 → set to 1
  const fixed = await prisma.expense.updateMany({
    where: { status: 'PENDING', currentStep: 0 },
    data: { currentStep: 1 },
  });
  console.log(`Fixed ${fixed.count} expense(s): currentStep 0 → 1`);

  // 4. Verify: show remaining pending expenses and their approval records
  const pending = await prisma.expense.findMany({
    where: { status: 'PENDING' },
    include: {
      user: { select: { firstName: true, lastName: true } },
      approvals: {
        include: { approver: { select: { firstName: true, lastName: true, role: true } } },
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  console.log(`\n${pending.length} pending expense(s):`);
  for (const exp of pending) {
    console.log(`  "${exp.title || exp.description}" by ${exp.user.firstName} ${exp.user.lastName} (step ${exp.currentStep})`);
    for (const a of exp.approvals) {
      console.log(`    Step ${a.stepNumber}: ${a.approver.firstName} ${a.approver.lastName} (${a.approver.role}) → ${a.action}`);
    }
  }

  console.log('\nDone! Restart backend server.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

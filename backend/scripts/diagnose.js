require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Show all pending expenses with their approval records
  const pending = await prisma.expense.findMany({
    where: { status: 'PENDING' },
    include: {
      user: { select: { firstName: true, lastName: true, managerId: true } },
      workflow: { select: { id: true, name: true, isManagerApprover: true } },
      approvals: {
        include: { approver: { select: { id: true, firstName: true, lastName: true, role: true } } },
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  console.log(`\n=== ${pending.length} PENDING EXPENSE(S) ===\n`);
  for (const exp of pending) {
    console.log(`"${exp.title || exp.category}" by ${exp.user.firstName} ${exp.user.lastName}`);
    console.log(`  Amount: ${exp.currency} ${exp.amount} | CurrentStep: ${exp.currentStep}`);
    console.log(`  Workflow: ${exp.workflow?.name || 'NONE'} (isManagerApprover: ${exp.workflow?.isManagerApprover})`);
    console.log(`  Employee managerId: ${exp.user.managerId || 'NOT SET'}`);
    console.log(`  Approvals (${exp.approvals.length}):`);
    if (exp.approvals.length === 0) {
      console.log('    *** NO APPROVAL RECORDS — this is the bug ***');
    }
    for (const a of exp.approvals) {
      console.log(`    Step ${a.stepNumber}: ${a.approver.firstName} ${a.approver.lastName} (${a.approver.role}, id:${a.approver.id}) → ${a.action}`);
    }
    console.log('');
  }

  // 2. Show the manager user
  const managers = await prisma.user.findMany({
    where: { role: 'MANAGER' },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  console.log('=== MANAGERS ===');
  for (const m of managers) {
    console.log(`  ${m.firstName} ${m.lastName} (${m.email}) id: ${m.id}`);
  }

  // 3. Show employees and their managerId
  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    select: { id: true, firstName: true, lastName: true, managerId: true },
  });
  console.log('\n=== EMPLOYEES ===');
  for (const e of employees) {
    const mgr = managers.find(m => m.id === e.managerId);
    console.log(`  ${e.firstName} ${e.lastName} → manager: ${mgr ? `${mgr.firstName} ${mgr.lastName}` : 'NOT SET (!!)'}`);
  }

  // 4. Show workflows
  const workflows = await prisma.approvalWorkflow.findMany({
    include: { steps: { orderBy: { stepNumber: 'asc' }, include: { approver: { select: { firstName: true, lastName: true } } } } },
  });
  console.log('\n=== WORKFLOWS ===');
  for (const wf of workflows) {
    console.log(`  "${wf.name}" (default: ${wf.isDefault}, active: ${wf.isActive}, isManagerApprover: ${wf.isManagerApprover})`);
    for (const s of wf.steps) {
      console.log(`    Step ${s.stepNumber}: ${s.approver ? `${s.approver.firstName} ${s.approver.lastName}` : `role: ${s.approverRole}`} — ${s.description}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

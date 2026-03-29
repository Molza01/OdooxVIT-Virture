const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create company
  const company = await prisma.company.create({
    data: { name: 'Acme Corporation', domain: 'acme.com', country: 'United States', currency: 'USD' },
  });

  const hash = (pw) => bcrypt.hashSync(pw, 12);

  // Create admin (acts as Director)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@acme.com',
      passwordHash: hash('password123'),
      firstName: 'Alice',
      lastName: 'Admin',
      role: 'ADMIN',
      companyId: company.id,
    },
  });

  // Create managers
  const manager1 = await prisma.user.create({
    data: {
      email: 'manager@acme.com',
      passwordHash: hash('password123'),
      firstName: 'Mike',
      lastName: 'Manager',
      role: 'MANAGER',
      companyId: company.id,
    },
  });

  const manager2 = await prisma.user.create({
    data: {
      email: 'finance@acme.com',
      passwordHash: hash('password123'),
      firstName: 'Fiona',
      lastName: 'Finance',
      role: 'MANAGER',
      companyId: company.id,
    },
  });

  // Create employees
  const emp1 = await prisma.user.create({
    data: {
      email: 'john@acme.com',
      passwordHash: hash('password123'),
      firstName: 'John',
      lastName: 'Employee',
      role: 'EMPLOYEE',
      companyId: company.id,
      managerId: manager1.id,
    },
  });

  await prisma.user.create({
    data: {
      email: 'jane@acme.com',
      passwordHash: hash('password123'),
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'EMPLOYEE',
      companyId: company.id,
      managerId: manager1.id,
    },
  });

  // =====================================================
  // WORKFLOW: 3-step multi-level approval
  //   Step 1 → Manager (role-based: employee's manager)
  //   Step 2 → Finance (specific: Fiona)
  //   Step 3 → Director (specific: Alice Admin)
  // =====================================================
  const workflow = await prisma.approvalWorkflow.create({
    data: {
      companyId: company.id,
      name: 'Standard Multi-Level Approval',
      description: 'Step 1: Manager → Step 2: Finance → Step 3: Director',
      isDefault: true,
      isManagerApprover: false, // Manager is already step 1, no need for pre-step
      steps: {
        create: [
          { stepNumber: 1, approverRole: 'MANAGER', description: 'Manager Approval' },
          { stepNumber: 2, approverId: manager2.id, description: 'Finance Review' },
          { stepNumber: 3, approverId: admin.id, description: 'Director Final Approval' },
        ],
      },
    },
  });

  // High-value workflow
  await prisma.approvalWorkflow.create({
    data: {
      companyId: company.id,
      name: 'High Value Expenses (>$5000)',
      description: 'Extra scrutiny for large expenses',
      minAmount: 5000,
      isManagerApprover: true, // Employee's manager auto-approves first
      steps: {
        create: [
          { stepNumber: 1, approverId: manager2.id, description: 'Finance Review' },
          { stepNumber: 2, approverId: admin.id, description: 'CFO Final Approval' },
        ],
      },
    },
  });

  // Approval rules
  await prisma.approvalRule.create({
    data: {
      companyId: company.id,
      name: '60% Majority Approval',
      ruleType: 'PERCENTAGE',
      percentageThreshold: 60,
    },
  });

  await prisma.approvalRule.create({
    data: {
      companyId: company.id,
      name: 'CFO Auto-Approve',
      ruleType: 'SPECIFIC_APPROVER',
      specificApproverId: admin.id,
    },
  });

  await prisma.approvalRule.create({
    data: {
      companyId: company.id,
      name: 'Hybrid: 60% OR CFO',
      ruleType: 'HYBRID',
      percentageThreshold: 60,
      specificApproverId: admin.id,
    },
  });

  // =====================================================
  // SAMPLE EXPENSES with proper multi-step approval records
  // =====================================================
  const categories = ['Travel', 'Meals', 'Office Supplies', 'Software', 'Training'];

  // --- DRAFT expenses (no approvals needed) ---
  for (let i = 0; i < 2; i++) {
    await prisma.expense.create({
      data: {
        userId: emp1.id,
        companyId: company.id,
        title: `Draft: ${categories[i]} expense`,
        amount: Math.round((Math.random() * 300 + 50) * 100) / 100,
        currency: 'USD',
        convertedAmount: Math.round((Math.random() * 300 + 50) * 100) / 100,
        companyCurrency: 'USD',
        exchangeRate: 1,
        category: categories[i],
        paidBy: 'PERSONAL',
        description: `Draft expense for ${categories[i].toLowerCase()}`,
        expenseDate: new Date(2026, 2, 15 + i),
        status: 'DRAFT',
      },
    });
  }

  // --- PENDING expense: waiting at Step 1 (Manager) ---
  const pendingExp1 = await prisma.expense.create({
    data: {
      userId: emp1.id,
      companyId: company.id,
      title: 'Team lunch at downtown restaurant',
      amount: 185.50,
      currency: 'USD',
      convertedAmount: 185.50,
      companyCurrency: 'USD',
      exchangeRate: 1,
      category: 'Meals',
      paidBy: 'PERSONAL',
      description: 'Lunch with client team - 5 people',
      expenseDate: new Date(2026, 2, 20),
      status: 'PENDING',
      workflowId: workflow.id,
      currentStep: 1,  // Waiting at Step 1 (Manager)
    },
  });
  // All 3 approval slots created at submission time
  await prisma.expenseApproval.createMany({
    data: [
      { expenseId: pendingExp1.id, approverId: manager1.id, stepNumber: 1, action: 'PENDING' },
      { expenseId: pendingExp1.id, approverId: manager2.id, stepNumber: 2, action: 'PENDING' },
      { expenseId: pendingExp1.id, approverId: admin.id, stepNumber: 3, action: 'PENDING' },
    ],
  });

  // --- PENDING expense: waiting at Step 2 (Finance) — Manager already approved ---
  const pendingExp2 = await prisma.expense.create({
    data: {
      userId: emp1.id,
      companyId: company.id,
      title: 'Flight to NYC for client meeting',
      amount: 450.00,
      currency: 'USD',
      convertedAmount: 450.00,
      companyCurrency: 'USD',
      exchangeRate: 1,
      category: 'Travel',
      paidBy: 'COMPANY',
      description: 'Round trip flight for Q1 client review',
      expenseDate: new Date(2026, 2, 18),
      status: 'PENDING',
      workflowId: workflow.id,
      currentStep: 2,  // Waiting at Step 2 (Finance)
    },
  });
  await prisma.expenseApproval.createMany({
    data: [
      { expenseId: pendingExp2.id, approverId: manager1.id, stepNumber: 1, action: 'APPROVED', comment: 'Approved - necessary trip', decidedAt: new Date(2026, 2, 19) },
      { expenseId: pendingExp2.id, approverId: manager2.id, stepNumber: 2, action: 'PENDING' },
      { expenseId: pendingExp2.id, approverId: admin.id, stepNumber: 3, action: 'PENDING' },
    ],
  });

  // --- PENDING expense: waiting at Step 3 (Director) — Manager & Finance approved ---
  const pendingExp3 = await prisma.expense.create({
    data: {
      userId: emp1.id,
      companyId: company.id,
      title: 'Annual software license renewal',
      amount: 1200.00,
      currency: 'USD',
      convertedAmount: 1200.00,
      companyCurrency: 'USD',
      exchangeRate: 1,
      category: 'Software',
      paidBy: 'COMPANY',
      description: 'Renewal for design tools - annual plan',
      expenseDate: new Date(2026, 2, 10),
      status: 'PENDING',
      workflowId: workflow.id,
      currentStep: 3,  // Waiting at Step 3 (Director)
    },
  });
  await prisma.expenseApproval.createMany({
    data: [
      { expenseId: pendingExp3.id, approverId: manager1.id, stepNumber: 1, action: 'APPROVED', comment: 'Needed for the team', decidedAt: new Date(2026, 2, 11) },
      { expenseId: pendingExp3.id, approverId: manager2.id, stepNumber: 2, action: 'APPROVED', comment: 'Budget verified', decidedAt: new Date(2026, 2, 12) },
      { expenseId: pendingExp3.id, approverId: admin.id, stepNumber: 3, action: 'PENDING' },
    ],
  });

  // --- APPROVED expense: all 3 steps approved ---
  const approvedExp = await prisma.expense.create({
    data: {
      userId: emp1.id,
      companyId: company.id,
      title: 'Office supplies for Q1',
      amount: 89.99,
      currency: 'USD',
      convertedAmount: 89.99,
      companyCurrency: 'USD',
      exchangeRate: 1,
      category: 'Office Supplies',
      paidBy: 'PERSONAL',
      description: 'Notebooks, pens, sticky notes',
      expenseDate: new Date(2026, 2, 5),
      status: 'APPROVED',
      workflowId: workflow.id,
      currentStep: 3,
    },
  });
  await prisma.expenseApproval.createMany({
    data: [
      { expenseId: approvedExp.id, approverId: manager1.id, stepNumber: 1, action: 'APPROVED', comment: 'Approved', decidedAt: new Date(2026, 2, 6) },
      { expenseId: approvedExp.id, approverId: manager2.id, stepNumber: 2, action: 'APPROVED', comment: 'OK', decidedAt: new Date(2026, 2, 7) },
      { expenseId: approvedExp.id, approverId: admin.id, stepNumber: 3, action: 'APPROVED', comment: 'Final approval', decidedAt: new Date(2026, 2, 8) },
    ],
  });

  // --- REJECTED expense: rejected by Finance at Step 2 ---
  const rejectedExp = await prisma.expense.create({
    data: {
      userId: emp1.id,
      companyId: company.id,
      title: 'Personal equipment purchase',
      amount: 750.00,
      currency: 'USD',
      convertedAmount: 750.00,
      companyCurrency: 'USD',
      exchangeRate: 1,
      category: 'Hardware',
      paidBy: 'PERSONAL',
      description: 'Wireless keyboard and monitor',
      expenseDate: new Date(2026, 2, 8),
      status: 'REJECTED',
      workflowId: workflow.id,
      currentStep: 2,
    },
  });
  await prisma.expenseApproval.createMany({
    data: [
      { expenseId: rejectedExp.id, approverId: manager1.id, stepNumber: 1, action: 'APPROVED', comment: 'OK from my side', decidedAt: new Date(2026, 2, 9) },
      { expenseId: rejectedExp.id, approverId: manager2.id, stepNumber: 2, action: 'REJECTED', comment: 'Not in budget. Please use company-issued equipment.', decidedAt: new Date(2026, 2, 10) },
      { expenseId: rejectedExp.id, approverId: admin.id, stepNumber: 3, action: 'PENDING' },
    ],
  });

  console.log('Seed completed!');
  console.log('');
  console.log('Test accounts:');
  console.log('  Admin/Director: admin@acme.com    / password123');
  console.log('  Manager:        manager@acme.com   / password123');
  console.log('  Finance:        finance@acme.com   / password123');
  console.log('  Employee:       john@acme.com      / password123');
  console.log('  Employee:       jane@acme.com      / password123');
  console.log('');
  console.log('Approval flow demo:');
  console.log('  "Team lunch"        → Step 1 (waiting for Manager)');
  console.log('  "Flight to NYC"     → Step 2 (waiting for Finance, Manager approved)');
  console.log('  "Software license"  → Step 3 (waiting for Director, Manager+Finance approved)');
  console.log('  "Office supplies"   → Fully Approved (all 3 steps)');
  console.log('  "Equipment purchase"→ Rejected by Finance at Step 2');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

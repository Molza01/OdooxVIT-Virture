const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

const SALT_ROUNDS = 12;

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const signup = async ({ email, password, firstName, lastName, companyName, country, currency }) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw Object.assign(new Error('Email already registered'), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName,
        country: country || 'United States',
        currency: currency || 'USD',
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role: 'ADMIN',
        companyId: company.id,
      },
    });

    // Create default 3-level approval workflow (Admin can override at any step)
    await tx.approvalWorkflow.create({
      data: {
        companyId: company.id,
        name: 'Standard Approval',
        description: 'Manager → Finance → Director (Admin can override at any step)',
        isDefault: true,
        isManagerApprover: false,
        steps: {
          create: [
            { stepNumber: 1, approverRole: 'MANAGER', description: 'Manager Approval' },
            { stepNumber: 2, approverRole: 'FINANCE', description: 'Finance Review' },
            { stepNumber: 3, approverRole: 'DIRECTOR', description: 'Director Approval' },
          ],
        },
      },
    });

    return { user, company };
  });

  const token = generateToken(result.user.id);

  return {
    token,
    user: {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      role: result.user.role,
      companyId: result.company.id,
      companyName: result.company.name,
      companyCurrency: result.company.currency,
      companyCountry: result.company.country,
    },
  };
};

const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: { select: { name: true, currency: true, country: true } } },
  });

  if (!user || !user.isActive) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const token = generateToken(user.id);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      companyId: user.companyId,
      companyName: user.company.name,
      companyCurrency: user.company.currency,
      companyCountry: user.company.country,
    },
  };
};

const getProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      companyId: true,
      managerId: true,
      isActive: true,
      company: { select: { name: true, currency: true, country: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  return {
    ...user,
    companyName: user.company.name,
    companyCurrency: user.company.currency,
    companyCountry: user.company.country,
    managerName: user.manager
      ? `${user.manager.firstName} ${user.manager.lastName}`
      : null,
  };
};

module.exports = { signup, login, getProfile };

const bcrypt = require('bcryptjs');
const prisma = require('../config/database');

const SALT_ROUNDS = 12;

const createUser = async ({ email, password, firstName, lastName, role, managerId }, companyId) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw Object.assign(new Error('Email already registered'), { status: 409 });
  }

  if (managerId) {
    const manager = await prisma.user.findFirst({
      where: { id: managerId, companyId, role: { in: ['MANAGER', 'FINANCE', 'DIRECTOR', 'ADMIN'] } },
    });
    if (!manager) {
      throw Object.assign(new Error('Invalid manager'), { status: 400 });
    }
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: role || 'EMPLOYEE',
      companyId,
      managerId: managerId || null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      companyId: true,
      managerId: true,
      isActive: true,
      createdAt: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return user;
};

const getUsers = async (companyId, { role, isActive, search } = {}) => {
  const where = { companyId };

  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  return prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      managerId: true,
      createdAt: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

const getUserById = async (userId, companyId) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      managerId: true,
      createdAt: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
      subordinates: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
    },
  });

  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  return user;
};

const updateUser = async (userId, companyId, updates) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
  });

  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const data = {};
  if (updates.firstName) data.firstName = updates.firstName;
  if (updates.lastName) data.lastName = updates.lastName;
  if (updates.role) data.role = updates.role;
  if (updates.managerId !== undefined) data.managerId = updates.managerId || null;
  if (updates.isActive !== undefined) data.isActive = updates.isActive;

  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      managerId: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
  });
};

const deleteUser = async (userId, companyId, adminId) => {
  if (userId === adminId) {
    throw Object.assign(new Error('Cannot delete your own account'), { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
  });

  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  // Reassign subordinates to null before deleting
  await prisma.user.updateMany({
    where: { managerId: userId },
    data: { managerId: null },
  });

  await prisma.user.delete({ where: { id: userId } });
  return { message: 'User deleted' };
};

module.exports = { createUser, getUsers, getUserById, updateUser, deleteUser };

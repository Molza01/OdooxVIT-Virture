const userService = require('../services/userService');

const createUser = async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body, req.user.companyId);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const users = await userService.getUsers(req.user.companyId, req.query);
    res.json(users);
  } catch (err) {
    next(err);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id, req.user.companyId);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await userService.updateUser(req.params.id, req.user.companyId, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const result = await userService.deleteUser(req.params.id, req.user.companyId, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { createUser, getUsers, getUserById, updateUser, deleteUser };

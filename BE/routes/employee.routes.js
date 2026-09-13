const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/permission.middleware');
const {
  getEmployeeStats,
  getAllUsers,
  getEmployees,
  getEmployeeById,
  createEmployee,
  deleteEmployee,
  updateEmployeeDetails,
  updateEmployeeStatus,
  updateEmployeePassword,
  updateEmployeePercentage,
} = require('../controllers/employee.controller');
const {
  getUserPermissions,
  setUserPermissions,
} = require('../controllers/permission.controller');
const { mongoIdParam } = require('../middleware/validate.middleware');
const { validateEmployeeStatus } = require('../validators/employee.validator');
// Same required fields as public self-registration (auth.validator.js) —
// an SA-created employee needs exactly the same information.
const { validateRegister } = require('../validators/auth.validator');

router.get('/employees/stats', requirePermission('users.view'), getEmployeeStats);
// Display-only dropdown feed for the ticket form — every authenticated role needs it.
router.get('/users', getAllUsers);
router.get('/employees', requirePermission('users.view'), getEmployees);
router.get('/employees/:id', mongoIdParam, requirePermission('users.view'), getEmployeeById);
router.post('/employees', requirePermission('users.create'), validateRegister, createEmployee);
router.delete('/employees/:id', mongoIdParam, requirePermission('users.delete'), deleteEmployee);
router.get('/employees/:id/permissions', mongoIdParam, requirePermission('users.permissions'), getUserPermissions);
router.put('/employees/:id/permissions', mongoIdParam, requirePermission('users.permissions'), setUserPermissions);
router.put('/employees/:id/status', mongoIdParam, requirePermission('users.status'), validateEmployeeStatus, updateEmployeeStatus);
router.put('/employees/:id/details', mongoIdParam, requirePermission('users.edit'), updateEmployeeDetails);
router.put('/employees/:id/password', mongoIdParam, requirePermission('users.password'), updateEmployeePassword);
router.put('/employees/:id/percentage', mongoIdParam, requirePermission('users.percentage'), updateEmployeePercentage);

module.exports = router;

const express = require("express");
const router = express.Router();
const { requirePermission } = require("../middleware/permission.middleware");
const { getEmployeeComparison } = require("../controllers/comparison.controller");

router.get(
  "/comparison/employees",
  requirePermission("comparison.view"),
  getEmployeeComparison,
);

module.exports = router;

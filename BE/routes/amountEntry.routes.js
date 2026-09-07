const express = require("express");
const router = express.Router();
const { requirePermission } = require("../middleware/permission.middleware");
const {
  getAmountEntries,
  createAmountEntry,
  updateAmountEntry,
  deleteAmountEntry,
  getAmountSummary,
  getEmployeeSummary,
} = require("../controllers/amountEntry.controller");
const { mongoIdParam } = require("../middleware/validate.middleware");
const {
  validateCreateAmount,
  validateUpdateAmount,
} = require("../validators/amount.validator");

// Fine-grained scope is still enforced inside the controllers: SA (or a user
// granted amounts.summary.sa) acts on any ledger, everyone else only on their own.
router.get("/amount-entries", requirePermission("amounts.view"), getAmountEntries);
router.post("/amount-entries", requirePermission("amounts.create"), validateCreateAmount, createAmountEntry);
router.put("/amount-entries/:id", mongoIdParam, requirePermission("amounts.edit"), validateUpdateAmount, updateAmountEntry);
router.delete("/amount-entries/:id", mongoIdParam, requirePermission("amounts.delete"), deleteAmountEntry);
// Studio-wide totals (per-employee + per-client balances).
router.get("/dashboard/summary", requirePermission("amounts.summary.sa"), getAmountSummary);
router.get("/employee/summary", requirePermission("amounts.summary.self"), getEmployeeSummary);

module.exports = router;

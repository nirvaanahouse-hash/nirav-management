const express = require("express");
const router = express.Router();
const { requirePermission } = require("../middleware/permission.middleware");
const { mongoIdParam } = require("../middleware/validate.middleware");
const {
  whoami,
  getStats,
  listRules,
  createRule,
  updateRule,
  deleteRule,
  getSettingsHandler,
  updateSettingsHandler,
  listLogins,
  listRequests,
} = require("../controllers/ip.controller");
const {
  validateCreateIpRule,
  validateUpdateIpRule,
  validateIpSettings,
} = require("../validators/ip.validator");

// Opening the IP & Security area at all needs security.view (SA bypasses).
// Scoped to "/ip" so it never gates other routers mounted on the same "/api".
router.use("/ip", requirePermission("security.view"));

router.get("/ip/whoami", whoami);
router.get("/ip/stats", getStats);

router.get("/ip/rules", listRules);
router.post("/ip/rules", requirePermission("security.rules.manage"), validateCreateIpRule, createRule);
router.put("/ip/rules/:id", mongoIdParam, requirePermission("security.rules.manage"), validateUpdateIpRule, updateRule);
router.delete("/ip/rules/:id", mongoIdParam, requirePermission("security.rules.manage"), deleteRule);

router.get("/ip/settings", getSettingsHandler);
router.put("/ip/settings", requirePermission("security.settings.manage"), validateIpSettings, updateSettingsHandler);

router.get("/ip/logins", requirePermission("security.logs.view"), listLogins);
router.get("/ip/requests", requirePermission("security.logs.view"), listRequests);

module.exports = router;

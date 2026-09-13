const IpRule = require("../models/ipRule.model");
const LoginEvent = require("../models/loginEvent.model");
const RequestLog = require("../models/requestLog.model");
const { getSettings, updateSettings } = require("../models/ipSetting.model");
const { invalidateIpRuleCache } = require("../middleware/ipGuard.middleware");
const { getClientIp, normalizeIp } = require("../utils/ip");

const clampInt = (value, def, min, max) => {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// Store exact addresses in a canonical form; leave CIDR blocks untouched.
const canonicalRuleIp = (raw) => {
  const value = String(raw || "").trim();
  return value.includes("/") ? value : normalizeIp(value);
};

// GET /api/ip/whoami
const whoami = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: { ip: getClientIp(req), userAgent: req.headers["user-agent"] || "" },
  });
};

// GET /api/ip/stats
const getStats = async (req, res) => {
  try {
    const since = startOfToday();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalRules,
      activeBlocks,
      activeAllows,
      loginsToday,
      failedLoginsToday,
      requestsToday,
      topIps,
      settings,
    ] = await Promise.all([
      IpRule.countDocuments({}),
      IpRule.countDocuments({ isActive: true, mode: "block" }),
      IpRule.countDocuments({ isActive: true, mode: "allow" }),
      LoginEvent.countDocuments({ createdAt: { $gte: since } }),
      LoginEvent.countDocuments({ createdAt: { $gte: since }, success: false }),
      RequestLog.countDocuments({ createdAt: { $gte: since } }),
      RequestLog.aggregate([
        { $match: { createdAt: { $gte: weekAgo } } },
        { $group: { _id: "$ip", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      getSettings(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalRules,
        activeBlocks,
        activeAllows,
        loginsToday,
        failedLoginsToday,
        requestsToday,
        topIps: topIps.map((t) => ({ ip: t._id || "unknown", count: t.count })),
        guardEnabled: settings.guardEnabled,
        allowlistMode: activeAllows > 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/ip/rules
const listRules = async (req, res) => {
  try {
    const rules = await IpRule.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      message: "IP rules fetched successfully",
      data: rules,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/ip/rules   body: { ip, mode, note }
const createRule = async (req, res) => {
  try {
    const ip = canonicalRuleIp(req.body.ip);
    const { mode } = req.body;
    const note = (req.body.note || "").trim();

    const existing = await IpRule.findOne({ ip });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A rule for this IP already exists.",
        errors: [{ field: "ip", message: "A rule for this IP already exists." }],
      });
    }

    const rule = await IpRule.create({
      ip,
      mode,
      note,
      createdBy: req.user.id,
    });

    invalidateIpRuleCache();

    return res.status(201).json({
      success: true,
      message: "IP rule created successfully",
      data: rule,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/ip/rules/:id   body: { ip?, mode?, note?, isActive? }
const updateRule = async (req, res) => {
  try {
    const { id } = req.params;
    const $set = {};

    if (req.body.ip !== undefined) $set.ip = canonicalRuleIp(req.body.ip);
    if (req.body.mode !== undefined) $set.mode = req.body.mode;
    if (req.body.note !== undefined) $set.note = String(req.body.note || "").trim();
    if (req.body.isActive !== undefined) $set.isActive = !!req.body.isActive;

    if ($set.ip) {
      const clash = await IpRule.findOne({ ip: $set.ip, _id: { $ne: id } });
      if (clash) {
        return res.status(400).json({
          success: false,
          message: "Another rule already uses this IP.",
          errors: [{ field: "ip", message: "Another rule already uses this IP." }],
        });
      }
    }

    const updated = await IpRule.findByIdAndUpdate(id, { $set }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "IP rule not found" });
    }

    invalidateIpRuleCache();

    return res.status(200).json({
      success: true,
      message: "IP rule updated successfully",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/ip/rules/:id
const deleteRule = async (req, res) => {
  try {
    const deleted = await IpRule.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "IP rule not found" });
    }

    invalidateIpRuleCache();

    return res.status(200).json({
      success: true,
      message: "IP rule deleted successfully",
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/ip/settings
const getSettingsHandler = async (req, res) => {
  try {
    const settings = await getSettings();
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/ip/settings
const updateSettingsHandler = async (req, res) => {
  try {
    const settings = await updateSettings(req.body);
    return res.status(200).json({
      success: true,
      message: "Security settings updated",
      data: settings,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/ip/logins?userId=&ip=&success=&limit=&skip=
const listLogins = async (req, res) => {
  try {
    const { userId, ip, success } = req.query;
    const limit = clampInt(req.query.limit, 50, 1, 200);
    const skip = clampInt(req.query.skip, 0, 0, 100000);

    const filter = {};
    if (userId) filter.userId = String(userId);
    if (ip) filter.ip = normalizeIp(ip);
    if (success === "true") filter.success = true;
    if (success === "false") filter.success = false;

    const [data, total] = await Promise.all([
      LoginEvent.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      LoginEvent.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data,
      total,
      limit,
      skip,
      hasMore: skip + data.length < total,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/ip/requests?userId=&ip=&method=&statusClass=&path=&limit=&skip=
const listRequests = async (req, res) => {
  try {
    const { userId, ip, method, statusClass, path } = req.query;
    const limit = clampInt(req.query.limit, 50, 1, 200);
    const skip = clampInt(req.query.skip, 0, 0, 100000);

    const filter = {};
    if (userId) filter.userId = String(userId);
    if (ip) filter.ip = normalizeIp(ip);
    if (method) filter.method = String(method).toUpperCase();
    if (path) filter.path = { $regex: String(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

    const cls = parseInt(statusClass, 10);
    if (cls >= 1 && cls <= 5) {
      filter.statusCode = { $gte: cls * 100, $lt: cls * 100 + 100 };
    }

    const [data, total] = await Promise.all([
      RequestLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      RequestLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data,
      total,
      limit,
      skip,
      hasMore: skip + data.length < total,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
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
};

const { getTicketTypes, getActiveTicketTypes } = require("../utils/ticket-types");

/**
 * Loads the SA-managed ticket type registry onto the request so the (sync)
 * ticket validators can check `ticketType` against it.
 *
 *   scope "active" — creating: only types the SA still offers.
 *   scope "all"    — editing: a ticket may already carry a switched-off type.
 */
const attachTicketTypes = (scope = "active") => async (req, res, next) => {
  try {
    const types = scope === "all" ? await getTicketTypes() : await getActiveTicketTypes();
    const map = {};
    types.forEach((t) => {
      map[t.key] = t;
    });

    req.ticketTypes = types;
    req.ticketTypeKeys = types.map((t) => t.key);
    req.ticketTypeMap = map;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { attachTicketTypes };

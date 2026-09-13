const Notification = require("../models/notification.model");
const { sendPushToUser } = require("./push.service");

let io = null;

const setSocketIO = (socketIOInstance) => {
  io = socketIOInstance;
};

const createNotification = async ({
  recipient,
  type,
  title,
  message,
  ticketId = null,
  actorId = null,
}) => {
  const notification = await Notification.create({
    recipient,
    type,
    title,
    message,
    ticketId,
    actorId,
  });

  if (io) {
    io.to(`user-${recipient}`).emit("notification", notification);
    io.to(`user-${recipient}`).emit("notification-count", { unreadCount: true });
  }

  // Reaches the user even if the tab is backgrounded or closed — the
  // in-app bell above only works while a session is actually connected.
  sendPushToUser(recipient, {
    title,
    body: message || "",
    tag: `notification-${notification._id}`,
    url: ticketId ? `/employee/tickets?ticket=${ticketId}` : "/",
  }).catch(() => {});

  return notification;
};

// Nothing joins a `ticket-${id}` room from the Tickets LIST page (only a
// ticket-detail view ever would, via the join-ticket socket event) — so a
// room-scoped emit reached no one. Targets everyone getTickets() would
// actually show this ticket to instead: every SA (the "role-SA" room, see
// server.js), plus the ticket's own assignee/creator. Delete-style minimal
// payloads ({ _id } only, no assignedEmployee/createdBy) broadcast globally
// instead — the bare id leaks nothing, and every open list just needs to
// drop it if present.
const emitTicketEvent = (event, ticket, room) => {
  if (!io) return;

  if (ticket.assignedEmployee === undefined && ticket.createdBy === undefined) {
    io.emit(event, ticket);
    return;
  }

  const rooms = new Set(["role-SA"]);
  if (room) rooms.add(`ticket-${room}`);
  if (ticket.assignedEmployee) rooms.add(`user-${ticket.assignedEmployee}`);
  if (ticket.createdBy) rooms.add(`user-${ticket.createdBy}`);
  io.to([...rooms]).emit(event, ticket);
};

// Generalised version of emitTicketEvent for clients/employees/amount-entries:
// every SA session (role-SA), every socket whose user actually holds
// `permission` (perm-<key>, joined at connect time — server.js), plus any
// specific user ids that should see this regardless of that permission (e.g.
// an employee viewing their own ledger row).
const emitScopedEvent = (event, payload, { permission, userIds = [] } = {}) => {
  if (!io) return;
  const rooms = new Set(["role-SA"]);
  if (permission) rooms.add(`perm-${permission}`);
  userIds.filter(Boolean).forEach((id) => rooms.add(`user-${id}`));
  io.to([...rooms]).emit(event, payload);
};

// A socket joins one `perm-<key>` room per permission the user held AT
// CONNECT TIME (server.js) and nothing re-evaluates that afterward — so if
// an SA revokes a permission from a currently-connected user, their open tab
// kept receiving that permission's live pushes (emitScopedEvent) until they
// reconnected, even though a fresh REST call would now 403 on the same data.
// Called right after a permission change to force that user's live socket(s)
// to leave every stale perm-* room and rejoin exactly the fresh set.
const resyncPermissionRooms = async (userId, permissions = []) => {
  if (!io) return;
  const sockets = await io.in(`user-${userId}`).fetchSockets();
  sockets.forEach((s) => {
    [...s.rooms].forEach((r) => {
      if (r.startsWith("perm-")) s.leave(r);
    });
    permissions.forEach((p) => s.join(`perm-${p}`));
  });
};

// Strictly private delivery — unlike emitScopedEvent, this never adds
// role-SA, so a 1:1 chat message never fans out to every SA session, only
// the two people actually in the conversation.
const emitToUsers = (event, payload, userIds = []) => {
  if (!io) return;
  const rooms = new Set(userIds.filter(Boolean).map((id) => `user-${id}`));
  if (!rooms.size) return;
  io.to([...rooms]).emit(event, payload);
};

module.exports = {
  setSocketIO,
  createNotification,
  emitTicketEvent,
  emitScopedEvent,
  emitToUsers,
  resyncPermissionRooms,
};

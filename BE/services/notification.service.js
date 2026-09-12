const Notification = require("../models/notification.model");

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

module.exports = {
  setSocketIO,
  createNotification,
  emitTicketEvent,
};

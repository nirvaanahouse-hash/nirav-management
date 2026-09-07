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

const emitTicketEvent = (event, ticket, room) => {
  if (io) {
    if (room) {
      io.to(`ticket-${room}`).emit(event, ticket);
    } else {
      io.emit(event, ticket);
    }
  }
};

module.exports = {
  setSocketIO,
  createNotification,
  emitTicketEvent,
};

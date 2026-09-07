const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const app = require("./app");
const { setSocketIO } = require("./services/notification.service");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const server = http.createServer(app);

const socketOrigin =
  process.env.FRONTEND_URL || [
    "http://localhost:4200",
    "http://192.168.1.73:4200",
    /^http:\/\/(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)[\d.]+:4200$/,
  ];

const io = new Server(server, {
  cors: {
    origin: socketOrigin,
    credentials: true,
  },
});

io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    (() => {
      const cookieHeader = socket.handshake.headers?.cookie;
      if (!cookieHeader) return null;
      const cookies = cookieHeader.split(";").map((c) => c.trim());
      for (const cookie of cookies) {
        const [name, value] = cookie.split("=");
        if (name === "token") return value;
      }
      return null;
    })();

  if (!token) {
    next(new Error("Authentication error"));
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (error) {
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.userId;

  socket.join(`user-${userId}`);

  socket.on("join-ticket", (ticketId) => {
    socket.join(`ticket-${ticketId}`);
  });

  socket.on("leave-ticket", (ticketId) => {
    socket.leave(`ticket-${ticketId}`);
  });

  socket.on("disconnect", () => {
    // Cleanup handled automatically by Socket.IO
  });
});

setSocketIO(io);

server.listen(PORT, HOST, () => {
  console.log(`Server Running On http://${HOST}:${PORT}`);
});

module.exports = { app, io };

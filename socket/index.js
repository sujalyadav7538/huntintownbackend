import { registerChatSocket } from "./chatSocket.js";
import socketAuth from "./socketAuth.js";
import User from "../models/userSchema.js";

export default function initializeSocket(io) {
  io.use(socketAuth);

  io.on("connection", async (socket) => {
    const userId = socket.user._id;
    const dbUserFilter = { _id: userId };

    try {
      await User.findOneAndUpdate(dbUserFilter, {
        isOnline: true,
      });

      io.emit("user-online", userId);
    } catch {}

    registerChatSocket(io, socket);

    socket.on("disconnect", async () => {
      const lastSeen = new Date();

      try {
        await User.findOneAndUpdate(dbUserFilter, {
          isOnline: false,
          lastSeen,
        });

        io.emit("user-offline", {
          userId,
          lastSeen,
        });
      } catch {}
    });
  });
}
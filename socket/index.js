import registerChatSocket from "./chatSocket.js";
import socketAuth from "./socketAuth.js";
import User from "../models/userSchema.js";

export default function initializeSocket(io) {
  console.log("Socket Initialized");
  io.use(socketAuth);
  io.on("connection", async (socket) => {
    console.log("Socket Connected:", socket.id);

    const userId = socket.user.id;
    const dbUserFilter = { $or: [{ _id: socket.user._id }, { id: userId }] };

    try {
      await User.findOneAndUpdate(dbUserFilter, { isOnline: true });
      io.emit("user-online", userId);
    } catch (error) {
      console.error("Failed to mark user online:", error.message);
    }

    registerChatSocket(io, socket);

    socket.on("disconnect", async () => {
      const lastSeen = new Date();
      try {
        await User.findOneAndUpdate(dbUserFilter, {
          isOnline: false,
          lastSeen,
        });
        io.emit("user-offline", { userId, lastSeen });
      } catch (error) {
        console.error("Failed to mark user offline:", error.message);
      }
      console.log("Socket Disconnected:", socket.id);
    });
  });
}

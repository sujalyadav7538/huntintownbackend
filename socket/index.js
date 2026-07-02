import registerChatSocket from "./chatSocket.js";
import socketAuth from "./socketAuth.js";

export default function initializeSocket(io) {
  console.log("Socket Initialized");
  io.use(socketAuth);
  io.on("connection", (socket) => {
    console.log("Socket Connected:", socket.id);

    registerChatSocket(io, socket);

    socket.on("disconnect", () => {
      console.log("Socket Disconnected:", socket.id);
    });
  });
}

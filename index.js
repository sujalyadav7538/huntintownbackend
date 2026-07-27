process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Socket IO
import http from "http";
import { Server } from "socket.io";
import initializeSocket from "./socket/index.js";

// Routes
import authRoute from "./routes/authRoute.js";
import postRoute from "./routes/postRoute.js";
import connectDB from "./utils/MongoDBClient.js";
import profileRoute from "./routes/profileRoute.js";
import dataRoute from "./routes/dataRoute.js";
import offerRoute from "./routes/offerRoutes.js";
import chatRoute from "./routes/chatRoutes.js";
import ratingRoute from "./routes/ratingRoutes.js";

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

dotenv.config();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());

// Socket Initialization

export const io = new Server(server, {
  cors: {
    origin:true,
    credentials: true,
  },
});
initializeSocket(io);

// Connection With Database`
await connectDB();

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
  });
});

// User Api Entry Points
app.use("/api/user", authRoute);
app.use("/api/posts", postRoute);
app.use("/api/profile", profileRoute);
app.use("/api/data", dataRoute);
app.use("/api/offers", offerRoute);
app.use("/api/chat", chatRoute);
app.use("/api/rating", ratingRoute);

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Error";
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  });
});

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

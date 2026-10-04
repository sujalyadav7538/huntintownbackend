process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import "dotenv/config";
import express from "express";
import cors from "cors";

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
import responseRoute from "./routes/responseRoutes.js";
import chatRoute from "./routes/chatRoutes.js";
import ratingRoute from "./routes/ratingRoutes.js";
import showCaseRoutes from "./routes/showCaseRoute.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import serializeIds from "./middlewares/serializeIds.js";
import { startPostExpiryScheduler } from "./service/notification/postExpiryScheduler.js";

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());

// Mirror every `_id` onto `id` in JSON responses (see middlewares/serializeIds.js)
app.use(serializeIds);


// Socket Initialization

export const io = new Server(server, {
  cors: {
    origin:true,
    credentials: true,
  },
});
initializeSocket(io);
app.set("io", io);

// Connection With Database`
await connectDB();
startPostExpiryScheduler();

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
app.use("/api/responses", responseRoute);
app.use("/api/chat", chatRoute);
app.use("/api/rating", ratingRoute);
app.use("/api/showcase", showCaseRoutes);
app.use("/api/notifications", notificationRoutes);


app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Error";
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

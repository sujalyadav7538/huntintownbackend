process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Routes
import authRoute from "./routes/authRoute.js";
import postRoute from "./routes/postRoute.js";
import connectDB from "./utils/MongoDBClient.js";
import profileRoute from "./routes/profileRoute.js";
import dataRoute from "./routes/dataRoute.js";
import offerRoute from "./routes/offerRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

dotenv.config();
// Whitelisted domains
const allowedOrigins = [
  "http://localhost:3000",
  "https://yourdomain.com",
  "https://www.yourdomain.com",
];
// Cors configuration
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (Postman, mobile apps, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());

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

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Error";
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

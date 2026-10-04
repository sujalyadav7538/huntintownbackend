import express from "express";
import {
  getNotifications,
  markNotificationRead,
  subscribeToPush,
  unsubscribeFromPush,
  getVapidPublicKey,
} from "../controllers/notificationController.js";
import {verifyToken} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/vapid-public-key", getVapidPublicKey);
router.get("/", verifyToken, getNotifications);
router.patch("/:notificationId/read", verifyToken, markNotificationRead);

router.post("/subscribe", verifyToken, subscribeToPush);

router.post("/unsubscribe", verifyToken, unsubscribeFromPush);

export default router;

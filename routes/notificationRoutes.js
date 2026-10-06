import express from "express";
import {
  getNotifications,
  getUnreadCount,
  getNotificationById,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearReadNotifications,
  subscribeToPush,
  unsubscribeFromPush,
  getVapidPublicKey,
} from "../controllers/notificationController.js";
import {verifyToken} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/vapid-public-key", getVapidPublicKey);
router.post("/subscribe", verifyToken, subscribeToPush);
router.post("/unsubscribe", verifyToken, unsubscribeFromPush);

router.get("/", verifyToken, getNotifications);
router.get("/unread-count", verifyToken, getUnreadCount);
router.patch("/read-all", verifyToken, markAllNotificationsRead);
router.delete("/read", verifyToken, clearReadNotifications);

// Parameterised routes stay last so they don't shadow the static paths above.
router.get("/:notificationId", verifyToken, getNotificationById);
router.patch("/:notificationId/read", verifyToken, markNotificationRead);
router.delete("/:notificationId", verifyToken, deleteNotification);

export default router;

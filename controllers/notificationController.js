import mongoose from "mongoose";
import PushSubscription from "../models/pushSubscriptionSchema.js";
import Notification from "../models/notificationSchema.js";
import { NOTIFICATION_TYPES } from "../config/constants.js";

const READ_STATUSES = ["all", "read", "unread"];
const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPES);

const invalidId = (res) =>
  res.status(400).json({ success: false, message: "Invalid notification id" });

export const getNotifications = async (req, res, next) => {
  try {
    const recipient = req.user._id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const status =
      typeof req.query.status === "string" ? req.query.status : "all";
    const type =
      typeof req.query.type === "string" ? req.query.type.toUpperCase() : "";

    if (!READ_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Use one of: ${READ_STATUSES.join(", ")}`,
      });
    }

    if (type && !NOTIFICATION_TYPE_VALUES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Use one of: ${NOTIFICATION_TYPE_VALUES.join(", ")}`,
      });
    }

    const filter = { recipient };
    if (status !== "all") filter.isRead = status === "read";
    if (type) filter.type = type;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient, isRead: false }),
    ]);

    return res.json({
      success: true,
      page,
      total,
      unreadCount,
      hasMore: skip + notifications.length < total,
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    return res.json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
};

export const getNotificationById = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(notificationId)) return invalidId(res);

    const notification = await Notification.findOne({
      _id: notificationId,
      recipient: req.user._id,
    }).lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.json({ success: true, notification });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.notificationId)) {
      return invalidId(res);
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, recipient: req.user._id },
      { $set: { isRead: true } },
      { new: true },
    ).lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.json({ success: true, notification });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true } },
    );

    return res.json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(notificationId)) return invalidId(res);

    const result = await Notification.deleteOne({
      _id: notificationId,
      recipient: req.user._id,
    });

    if (!result.deletedCount) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    next(error);
  }
};

// Clears read notifications only, so unseen activity is never lost.
export const clearReadNotifications = async (req, res, next) => {
  try {
    const result = await Notification.deleteMany({
      recipient: req.user._id,
      isRead: true,
    });

    return res.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    next(error);
  }
};

export const subscribeToPush = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { subscription } = req.body;

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid push subscription",
      });
    }

    const savedSubscription = await PushSubscription.findOneAndUpdate(
      {
        endpoint: subscription.endpoint,
      },
      {
        userId,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Push subscription registered successfully",
      subscription: savedSubscription,
    });
  } catch (error) {
    next(error);
  }
};

export const unsubscribeFromPush = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: "Endpoint is required",
      });
    }

    await PushSubscription.deleteOne({
      userId,
      endpoint,
    });

    return res.status(200).json({
      success: true,
      message: "Push subscription removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getVapidPublicKey = (req, res) => {
  return res.status(200).json({
    success: true,
    publicKey: process.env.VAPID_PUBLIC_KEY,
  });
};

import Post from "../../models/postSchema.js";
import Notification from "../../models/notificationSchema.js";
import { POST_STATUS, NOTIFICATION_ACTIONS } from "../../config/constants.js";
import { NotificationManager } from "../../utils/notificationManager.js";

const EXPIRING_WINDOW_MS = 24 * 60 * 60 * 1000;

async function hasNotification(postId, action) {
  return Notification.exists({
    action,
    "data.postId": postId,
  });
}

export async function processPostExpiry() {
  const now = new Date();
  const expiringBefore = new Date(now.getTime() + EXPIRING_WINDOW_MS);

  const expiringPosts = await Post.find({
    status: { $in: [POST_STATUS.LIVE, POST_STATUS.IN_PROGRESS] },
    expiresAt: { $gt: now, $lte: expiringBefore },
  }).populate("author", "_id name");

  for (const post of expiringPosts) {
    if (!(await hasNotification(post._id, NOTIFICATION_ACTIONS.POST_EXPIRING))) {
      await NotificationManager.postExpiring({ userId: post.author._id, post });
    }
  }

  const expiredPosts = await Post.find({
    status: { $in: [POST_STATUS.LIVE, POST_STATUS.IN_PROGRESS] },
    expiresAt: { $lte: now },
  }).populate("author", "_id name");

  for (const post of expiredPosts) {
    const updated = await Post.updateOne(
      { _id: post._id, status: { $in: [POST_STATUS.LIVE, POST_STATUS.IN_PROGRESS] } },
      { $set: { status: POST_STATUS.EXPIRED } },
    );

    if (updated.modifiedCount && !(await hasNotification(post._id, NOTIFICATION_ACTIONS.POST_EXPIRED))) {
      await NotificationManager.postExpired({ userId: post.author._id, post });
    }
  }
}

export function startPostExpiryScheduler() {
  const interval = setInterval(() => {
    processPostExpiry().catch((error) =>
      console.error("[PostExpiry] Processing failed:", error.message),
    );
  }, 60 * 1000);

  interval.unref?.();
  void processPostExpiry();
  return interval;
}
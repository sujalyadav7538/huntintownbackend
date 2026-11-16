import "dotenv/config";
import { Worker } from "bullmq";
import mongoose from "mongoose";

import { createRedisConnection } from "../../config/redis.js";
import Notification from "../../models/notificationSchema.js";
import PushSubscription from "../../models/pushSubscriptionSchema.js";
import connectDB from "../../utils/MongoDBClient.js";
import { sendPushNotification } from "./pushService.js";

const required = [
  "REDIS_URL",
  "MONGO_URI",
  "VAPID_SUBJECT",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`Notification worker missing configuration: ${missing.join(", ")}`);
}

await connectDB();
const redisConnection = createRedisConnection({ worker: true });
const worker = new Worker(
  "notification-queue",

  async (job) => {
    const { notificationId } = job.data;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    const subscriptions = await PushSubscription.find({
      userId: notification.recipient,
    });

    if (!subscriptions.length) {
      console.info("[notifications] Push skipped: no browser subscription");
      return;
    }

    const payload = {
      notificationId: notification._id,
      type: notification.type,
      action: notification.action,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      link: notification.link,
      createdAt: notification.createdAt,
    };

    for (const subscription of subscriptions) {
      try {
        await sendPushNotification(subscription, payload);
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await PushSubscription.deleteOne({
            _id: subscription._id,
          });

          console.info("[notifications] Removed expired push subscription");
          continue;
        }

        throw error;
      }
    }
  },

  {
    connection: redisConnection,

    concurrency: 20,
  },
);

worker.on("ready", () => console.info("[notifications] Worker ready"));
worker.on("completed", () => console.info("[notifications] Push job completed"));
worker.on("error", (error) => {
  console.error("[notifications] Worker error", { code: error.code || "UNKNOWN" });
});
worker.on("failed", (_job, error) => {
  console.error("[notifications] Push job failed", {
    code: error.code || "PUSH_ERROR",
    statusCode: error.statusCode,
  });
});

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  try {
    await worker.close();
    await redisConnection.quit();
    await mongoose.disconnect();
  } catch (error) {
    console.error("[notifications] Worker shutdown failed", { code: error.code || "UNKNOWN" });
    process.exitCode = 1;
  }
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

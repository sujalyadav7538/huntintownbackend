import "dotenv/config";
import { Worker } from "bullmq";

import redisConnection from "../../config/redis.js";
import Notification from "../../models/notificationSchema.js";
import PushSubscription from "../../models/pushSubscriptionSchema.js";
import connectDB from "../../utils/MongoDBClient.js";
import { sendPushNotification } from "./pushService.js";

const worker = redisConnection
  ? new Worker(
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
      throw new Error(
        `No push subscriptions found for recipient ${notification.recipient}`,
      );
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
    )
  : null;

if (worker) await connectDB();

worker?.on("error", () => {});

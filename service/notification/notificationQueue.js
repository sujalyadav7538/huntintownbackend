import { Queue } from "bullmq";
import redisConnection from "../../config/redis.js";

export const notificationQueue = redisConnection
  ? new Queue("notification-queue", {
      connection: redisConnection,

      defaultJobOptions: {
        attempts: 3,

        backoff: {
          type: "exponential",
          delay: 5000,
        },

        removeOnComplete: {
          age: 3600,
          count: 10000,
        },

        removeOnFail: {
          age: 86400,
          count: 10000,
        },
      },
    })
  : null;

notificationQueue?.on("error", () => {});

export const enqueueNotification = async (notificationId) => {
  if (!notificationQueue) return null;

  try {
    const job = await notificationQueue.add(
      "send-push",
      {
        notificationId: notificationId.toString(),
      },
      {
        jobId: notificationId.toString(),
      },
    );

    return job;
  } catch (error) {
    throw error;
  }
};

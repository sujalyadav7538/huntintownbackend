import { Queue } from "bullmq";
import { createRedisConnection } from "../../config/redis.js";

const redisConnection = createRedisConnection();

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

notificationQueue?.on("error", (error) => {
  console.error("[notifications] Queue error", { code: error.code || "UNKNOWN" });
});

export const enqueueNotification = async (notificationId) => {
  if (!notificationQueue) {
    const error = new Error("REDIS_URL is not configured");
    error.code = "REDIS_NOT_CONFIGURED";
    throw error;
  }
  if (redisConnection.status !== "ready") {
    const error = new Error("Redis is not ready");
    error.code = "REDIS_UNAVAILABLE";
    throw error;
  }

  return notificationQueue.add(
    "send-push",
    { notificationId: notificationId.toString() },
    { jobId: notificationId.toString() },
  );
};

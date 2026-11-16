import IORedis from "ioredis";

export function createRedisConnection({ worker = false } = {}) {
  if (!process.env.REDIS_URL) return null;

  const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: worker ? null : 1,
    enableOfflineQueue: worker,
    retryStrategy: (attempt) => Math.min(attempt * 200, 6000),
  });
  connection.on("error", (error) => {
    console.error("[notifications] Redis connection error", {
      code: error.code || "UNKNOWN",
    });
  });
  return connection;
}

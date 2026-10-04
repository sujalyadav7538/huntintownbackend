import IORedis from "ioredis";

const redisConnection = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      retryStrategy: (attempt) => Math.min(attempt * 200, 6000),
    })
  : null;

redisConnection?.on("connect", () => {
  console.log("[Redis] Connected");
});

redisConnection?.on("error", (error) => {
  console.error("[Redis] Error:", {
    name: error.name,
    code: error.code,
    message: error.message || String(error),
  });
});

export default redisConnection;

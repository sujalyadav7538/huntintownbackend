import IORedis from "ioredis";

const redisConnection = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      retryStrategy: (attempt) => Math.min(attempt * 200, 6000),
    })
  : null;

redisConnection?.on("error", () => {});

export default redisConnection;

import Redis from "ioredis";
import { config } from "./environment";

export const redis = new Redis(config.REDIS_URL, {
  password: config.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  reconnectOnError: (err) => {
    const targetError = "READONLY";
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
});

export const pubClient = redis.duplicate();
export const subClient = redis.duplicate();

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("error", (err) => {
  console.error("Redis error:", err);
});

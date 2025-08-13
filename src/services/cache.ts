import { redis } from "../config/redis";
import { logger } from "../utils/logger";

export class CacheService {
  private defaultTTL: number = 3600;
  private keyPrefix: string = "cache:";

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(this.keyPrefix + key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error({ error, key }, "Cache get error");
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await redis.setex(
        this.keyPrefix + key,
        ttl || this.defaultTTL,
        serialized
      );
    } catch (error) {
      logger.error({ error, key }, "Cache set error");
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await redis.del(this.keyPrefix + key);
    } catch (error) {
      logger.error({ error, key }, "Cache delete error");
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(this.keyPrefix + pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error({ error, pattern }, "Cache delete pattern error");
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(this.keyPrefix + key);
      return result === 1;
    } catch (error) {
      logger.error({ error, key }, "Cache exists error");
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(this.keyPrefix + key);
    } catch (error) {
      logger.error({ error, key }, "Cache ttl error");
      return -1;
    }
  }

  async invalidate(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    try {
      const prefixedKeys = keys.map((k) => this.keyPrefix + k);
      await redis.del(...prefixedKeys);
    } catch (error) {
      logger.error({ error, keys }, "Cache invalidate error");
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  async increment(key: string, value: number = 1): Promise<number> {
    try {
      return await redis.incrby(this.keyPrefix + key, value);
    } catch (error) {
      logger.error({ error, key }, "Cache increment error");
      return 0;
    }
  }

  async decrement(key: string, value: number = 1): Promise<number> {
    try {
      return await redis.decrby(this.keyPrefix + key, value);
    } catch (error) {
      logger.error({ error, key }, "Cache decrement error");
      return 0;
    }
  }

  async flush(): Promise<void> {
    try {
      const keys = await redis.keys(this.keyPrefix + "*");
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error({ error }, "Cache flush error");
    }
  }
}

export const cacheService = new CacheService();

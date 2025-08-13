import { Event } from "../schemas/event.schema";
import { BaseProcessor } from "./base.processor";
import { redis } from "../config/redis";
import { pool } from "../config/database";

export class PerformanceProcessor extends BaseProcessor {
  name = "PerformanceProcessor";

  shouldProcess(event: Event): boolean {
    return event.type === "api_call" && event.duration !== undefined;
  }

  async process(event: Event): Promise<void> {
    try {
      await this.logProcessing(event);

      const endpoint =
        typeof event.metadata?.endpoint === "string"
          ? event.metadata.endpoint
          : "unknown";
      const method =
        typeof event.metadata?.method === "string"
          ? event.metadata.method
          : "GET";
      const statusCode =
        typeof event.metadata?.statusCode === "number"
          ? event.metadata.statusCode
          : 200;

      await this.updatePerformanceMetrics(
        endpoint,
        method,
        statusCode,
        event.duration!
      );

      if (event.duration! > 1000) {
        await this.recordSlowRequest(event);
      }
    } catch (error) {
      await this.handleError(error as Error, event);
    }
  }

  private async updatePerformanceMetrics(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number
  ): Promise<void> {
    const key = `perf:${endpoint}:${method}`;
    const pipeline = redis.pipeline();

    pipeline.hincrby(key, "count", 1);
    pipeline.hincrbyfloat(key, "total_duration", duration);
    pipeline.hincrbyfloat(key, "max_duration", Math.max(0, duration));

    if (statusCode >= 500) {
      pipeline.hincrby(key, "errors", 1);
    }

    pipeline.expire(key, 86400);

    await pipeline.exec();
  }

  private async recordSlowRequest(event: Event): Promise<void> {
    const query = `
      INSERT INTO slow_requests (
        endpoint, method, duration, timestamp, user_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await pool.query(query, [
      event.metadata?.endpoint || "unknown",
      event.metadata?.method || "GET",
      event.duration,
      event.timestamp,
      event.userId || null,
      JSON.stringify(event.metadata),
    ]);
  }
}

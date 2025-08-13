import { Event } from "../schemas/event.schema";
import { BaseProcessor } from "./base.processor";
import { redis } from "../config/redis";
import { pool } from "../config/database";

export class ErrorProcessor extends BaseProcessor {
  name = "ErrorProcessor";

  shouldProcess(event: Event): boolean {
    return event.type === "error";
  }

  async process(event: Event): Promise<void> {
    try {
      await this.logProcessing(event);

      const errorType =
        typeof event.metadata?.errorType === "string"
          ? event.metadata.errorType
          : "unknown";
      const errorMessage =
        typeof event.metadata?.message === "string"
          ? event.metadata.message
          : "";
      const stackTrace =
        typeof event.metadata?.stackTrace === "string"
          ? event.metadata.stackTrace
          : "";

      await this.updateErrorMetrics(errorType);
      await this.storeError(event, errorType, errorMessage, stackTrace);

      if (this.isCriticalError(event)) {
        await this.alertCriticalError(event);
      }
    } catch (error) {
      await this.handleError(error as Error, event);
    }
  }

  private async updateErrorMetrics(errorType: string): Promise<void> {
    const key = `errors:${errorType}`;
    const hourKey = `errors:hourly:${new Date().toISOString().slice(0, 13)}`;

    const pipeline = redis.pipeline();

    pipeline.hincrby(key, "count", 1);
    pipeline.hincrby(key, `last_seen`, Date.now());
    pipeline.hincrby(hourKey, errorType, 1);

    pipeline.expire(key, 86400 * 7);
    pipeline.expire(hourKey, 86400);

    await pipeline.exec();
  }

  private async storeError(
    event: Event,
    errorType: string,
    errorMessage: string,
    stackTrace: string
  ): Promise<void> {
    const query = `
      INSERT INTO errors (
        error_type, message, stack_trace, timestamp, user_id, session_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await pool.query(query, [
      errorType,
      errorMessage,
      stackTrace,
      event.timestamp,
      event.userId || null,
      event.sessionId || null,
      JSON.stringify(event.metadata),
    ]);
  }

  private isCriticalError(event: Event): boolean {
    const criticalTypes = ["DATABASE_ERROR", "AUTH_FAILURE", "PAYMENT_ERROR"];
    const errorType =
      typeof event.metadata?.errorType === "string"
        ? event.metadata.errorType
        : "";
    return criticalTypes.includes(errorType);
  }

  private async alertCriticalError(event: Event): Promise<void> {
    await redis.publish(
      "alerts:critical",
      JSON.stringify({
        type: "critical_error",
        event,
        timestamp: Date.now(),
        severity: "high",
      })
    );
  }
}

import { Event } from "../schemas/event.schema";
import { pool } from "../config/database";
import { redis } from "../config/redis";
import { BatchProcessor } from "../utils/batch-processor";
import { config } from "../config/environment";
import { BaseProcessor } from "../processors/base.processor";
import { PerformanceProcessor } from "../processors/performance.processor";
import { ErrorProcessor } from "../processors/error.processor";

export class EventProcessorService {
  private processors: Map<string, BaseProcessor> = new Map();
  private batchProcessor: BatchProcessor<Event>;

  constructor() {
    this.registerProcessors();
    this.batchProcessor = new BatchProcessor<Event>(
      config.BATCH_SIZE,
      config.AGGREGATION_INTERVAL_MS,
      this.processBatch.bind(this)
    );
  }

  private registerProcessors(): void {
    this.processors.set("performance", new PerformanceProcessor());
    this.processors.set("error", new ErrorProcessor());
  }

  async processEvent(event: Event): Promise<void> {
    const enrichedEvent = await this.enrichEvent(event);
    await this.batchProcessor.add(enrichedEvent);
    await this.publishRealtimeUpdate(enrichedEvent);
  }

  private async enrichEvent(event: Event): Promise<Event> {
    return {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      metadata: {
        ...event.metadata,
        processed_at: new Date().toISOString(),
        server_id: process.env.HOSTNAME || "unknown",
      },
    };
  }

  private async processBatch(events: Event[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const insertQuery = `
        INSERT INTO events (type, timestamp, user_id, session_id, metadata, tags, value, duration)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

      for (const event of events) {
        await client.query(insertQuery, [
          event.type,
          event.timestamp,
          event.userId || null,
          event.sessionId || null,
          JSON.stringify(event.metadata),
          event.tags || [],
          event.value || null,
          event.duration || null,
        ]);

        for (const [name, processor] of this.processors) {
          if (processor.shouldProcess(event)) {
            await processor.process(event);
          }
        }
      }

      await client.query("COMMIT");
      await this.updateMetrics(events);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async updateMetrics(events: Event[]): Promise<void> {
    const pipeline = redis.pipeline();

    for (const event of events) {
      const key = `metrics:${event.type}:${new Date(event.timestamp!)
        .toISOString()
        .slice(0, 10)}`;
      pipeline.hincrby(key, "count", 1);

      if (event.value !== undefined) {
        pipeline.hincrbyfloat(key, "sum", event.value);
        pipeline.hincrbyfloat(key, "max", event.value);
        pipeline.hincrbyfloat(key, "min", event.value);
      }

      if (event.duration !== undefined) {
        pipeline.hincrbyfloat(key, "duration_sum", event.duration);
        pipeline.hincrby(key, "duration_count", 1);
      }

      pipeline.expire(key, 86400 * config.METRICS_RETENTION_DAYS);
    }

    await pipeline.exec();
  }

  private async publishRealtimeUpdate(event: Event): Promise<void> {
    await redis.publish(
      "events:realtime",
      JSON.stringify({
        type: "event",
        data: event,
        timestamp: Date.now(),
      })
    );
  }

  async getQueueStatus(): Promise<{
    queueSize: number;
    isProcessing: boolean;
  }> {
    return {
      queueSize: this.batchProcessor.getQueueSize(),
      isProcessing: this.batchProcessor.isProcessing(),
    };
  }

  async shutdown(): Promise<void> {
    await this.batchProcessor.stop();
  }
}

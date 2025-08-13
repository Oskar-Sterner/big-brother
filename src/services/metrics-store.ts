import { pool } from "../config/database";
import { redis } from "../config/redis";
import { MetricData, MetricWindow } from "../types";
import { logger } from "../utils/logger";

export class MetricsStore {
  private buffers = new Map<string, MetricData[]>();
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(
    private flushIntervalMs: number = 5000,
    private maxBufferSize: number = 1000
  ) {
    this.startAutoFlush();
  }

  async store(metric: MetricData): Promise<void> {
    const key = this.getBufferKey(metric);

    if (!this.buffers.has(key)) {
      this.buffers.set(key, []);
    }

    const buffer = this.buffers.get(key)!;
    buffer.push(metric);

    if (buffer.length >= this.maxBufferSize) {
      await this.flush(key);
    }
  }

  async storeBatch(metrics: MetricData[]): Promise<void> {
    for (const metric of metrics) {
      await this.store(metric);
    }
  }

  private getBufferKey(metric: MetricData): string {
    return `${metric.name}:${Math.floor(metric.timestamp / 60000)}`;
  }

  private startAutoFlush(): void {
    this.flushInterval = setInterval(async () => {
      await this.flushAll();
    }, this.flushIntervalMs);
  }

  async flush(key: string): Promise<void> {
    const buffer = this.buffers.get(key);
    if (!buffer || buffer.length === 0) return;

    const metrics = [...buffer];
    this.buffers.set(key, []);

    try {
      await this.persistMetrics(metrics);
      await this.updateAggregates(metrics);
    } catch (error) {
      logger.error({ error, key }, "Failed to flush metrics");
      // Re-add metrics to buffer on failure
      this.buffers.get(key)?.push(...metrics);
    }
  }

  async flushAll(): Promise<void> {
    const keys = Array.from(this.buffers.keys());
    await Promise.all(keys.map((key) => this.flush(key)));
  }

  private async persistMetrics(metrics: MetricData[]): Promise<void> {
    if (metrics.length === 0) return;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const query = `
        INSERT INTO metrics (name, value, timestamp, tags, aggregation_type)
        VALUES ($1, $2, $3, $4, $5)
      `;

      for (const metric of metrics) {
        await client.query(query, [
          metric.name,
          metric.value,
          new Date(metric.timestamp),
          JSON.stringify(metric.tags || {}),
          "raw",
        ]);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async updateAggregates(metrics: MetricData[]): Promise<void> {
    if (metrics.length === 0) return;

    const aggregates = this.calculateAggregates(metrics);

    for (const [key, agg] of aggregates.entries()) {
      const pipeline = redis.pipeline();

      pipeline.hset(
        `agg:${key}`,
        "count",
        agg.count.toString(),
        "sum",
        agg.sum.toString(),
        "min",
        agg.min.toString(),
        "max",
        agg.max.toString(),
        "avg",
        agg.avg.toString(),
        "last_updated",
        Date.now().toString()
      );

      pipeline.expire(`agg:${key}`, 86400);

      await pipeline.exec();
    }
  }

  private calculateAggregates(metrics: MetricData[]): Map<string, any> {
    const aggregates = new Map();

    for (const metric of metrics) {
      const key = `${metric.name}:${Math.floor(metric.timestamp / 60000)}`;

      if (!aggregates.has(key)) {
        aggregates.set(key, {
          count: 0,
          sum: 0,
          min: Infinity,
          max: -Infinity,
          values: [],
        });
      }

      const agg = aggregates.get(key);
      agg.count++;
      agg.sum += metric.value;
      agg.min = Math.min(agg.min, metric.value);
      agg.max = Math.max(agg.max, metric.value);
      agg.values.push(metric.value);
    }

    // Calculate averages and percentiles
    for (const [key, agg] of aggregates.entries()) {
      agg.avg = agg.sum / agg.count;
      agg.values.sort((a: number, b: number) => a - b);
      agg.p50 = this.percentile(agg.values, 50);
      agg.p95 = this.percentile(agg.values, 95);
      agg.p99 = this.percentile(agg.values, 99);
      delete agg.values; // Remove raw values to save memory
    }

    return aggregates;
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  async getMetricWindow(
    name: string,
    startTime: number,
    endTime: number,
    windowSizeMs: number
  ): Promise<MetricWindow[]> {
    const query = `
      SELECT 
        FLOOR(EXTRACT(EPOCH FROM timestamp) * 1000 / $4) * $4 as window_start,
        COUNT(*) as count,
        SUM(value) as sum,
        MIN(value) as min,
        MAX(value) as max,
        AVG(value) as avg,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value) as p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) as p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value) as p99
      FROM metrics
      WHERE name = $1 
        AND timestamp >= $2 
        AND timestamp < $3
      GROUP BY window_start
      ORDER BY window_start
    `;

    const result = await pool.query(query, [
      name,
      new Date(startTime),
      new Date(endTime),
      windowSizeMs,
    ]);

    return result.rows.map((row) => ({
      start: parseInt(row.window_start),
      end: parseInt(row.window_start) + windowSizeMs,
      count: parseInt(row.count),
      sum: parseFloat(row.sum),
      min: parseFloat(row.min),
      max: parseFloat(row.max),
      avg: parseFloat(row.avg),
    }));
  }

  async getTopMetrics(limit: number = 10): Promise<any[]> {
    const query = `
      SELECT 
        name,
        COUNT(*) as count,
        MAX(timestamp) as last_seen
      FROM metrics
      WHERE timestamp > NOW() - INTERVAL '1 hour'
      GROUP BY name
      ORDER BY count DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  async deleteOldMetrics(retentionDays: number): Promise<number> {
    const query = `
      DELETE FROM metrics
      WHERE timestamp < NOW() - INTERVAL '$1 days'
      RETURNING id
    `;

    const result = await pool.query(query, [retentionDays]);
    const deletedCount = result.rowCount ?? 0;
    logger.info({ deleted: deletedCount }, "Old metrics deleted");
    return deletedCount;
  }

  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flushAll();
  }
}

export const metricsStore = new MetricsStore();

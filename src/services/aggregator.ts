import { pool } from "../config/database";
import { redis } from "../config/redis";
import { SlidingWindow } from "../utils/sliding-window";
import { AggregationQuery } from "../schemas/metric.schema";

interface WindowConfig {
  "1m": number;
  "5m": number;
  "15m": number;
  "1h": number;
  "6h": number;
  "24h": number;
  "7d": number;
}

export class AggregatorService {
  private windows: Map<string, SlidingWindow> = new Map();
  private windowConfigs: WindowConfig = {
    "1m": 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
  };

  constructor() {
    this.initializeWindows();
  }

  private initializeWindows(): void {
    for (const [key, windowSize] of Object.entries(this.windowConfigs)) {
      this.windows.set(key, new SlidingWindow(windowSize));
    }
  }

  async aggregate(query: AggregationQuery): Promise<any[]> {
    const cacheKey = this.getCacheKey(query);
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.performAggregation(query);
    await redis.setex(cacheKey, 60, JSON.stringify(result));

    return result;
  }

  private async performAggregation(query: AggregationQuery): Promise<any[]> {
    const intervalMs = this.windowConfigs[query.interval];
    const buckets = this.generateBuckets(
      new Date(query.startTime).getTime(),
      new Date(query.endTime).getTime(),
      intervalMs
    );

    const results = [];

    for (const bucket of buckets) {
      const aggregatedValue = await this.aggregateBucket(
        query.metric,
        bucket.start,
        bucket.end,
        query.aggregationType,
        query.filters as Record<string, string> | undefined
      );

      results.push({
        timestamp: new Date(bucket.start).toISOString(),
        value: aggregatedValue,
        metric: query.metric,
        aggregation: query.aggregationType,
      });
    }

    return results;
  }

  private generateBuckets(
    startTime: number,
    endTime: number,
    intervalMs: number
  ): Array<{ start: number; end: number }> {
    const buckets = [];
    let currentTime = startTime;

    while (currentTime < endTime) {
      buckets.push({
        start: currentTime,
        end: Math.min(currentTime + intervalMs, endTime),
      });
      currentTime += intervalMs;
    }

    return buckets;
  }

  private async aggregateBucket(
    metric: string,
    startTime: number,
    endTime: number,
    aggregationType: string,
    filters?: Record<string, string>
  ): Promise<number> {
    let query = `
      SELECT 
        ${this.getAggregationFunction(aggregationType, "value")} as result
      FROM events
      WHERE timestamp >= $1 AND timestamp < $2
        AND metadata->>'metric_name' = $3
    `;

    const params: any[] = [
      new Date(startTime).toISOString(),
      new Date(endTime).toISOString(),
      metric,
    ];

    if (filters) {
      let paramIndex = 4;
      for (const [key, value] of Object.entries(filters)) {
        query += ` AND metadata->>$${paramIndex} = $${paramIndex + 1}`;
        params.push(key, value);
        paramIndex += 2;
      }
    }

    const result = await pool.query(query, params);
    return result.rows[0]?.result || 0;
  }

  private getAggregationFunction(type: string, column: string): string {
    const functions: Record<string, string> = {
      sum: `SUM(${column})`,
      avg: `AVG(${column})`,
      min: `MIN(${column})`,
      max: `MAX(${column})`,
      count: `COUNT(${column})`,
      p50: `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${column})`,
      p95: `PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${column})`,
      p99: `PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${column})`,
    };

    return functions[type] || functions.avg;
  }

  private getCacheKey(query: AggregationQuery): string {
    return `agg:${query.metric}:${query.aggregationType}:${query.interval}:${
      query.startTime
    }:${query.endTime}:${JSON.stringify(query.filters || {})}`;
  }

  async addRealtimeMetric(metric: string, value: number): Promise<void> {
    for (const window of this.windows.values()) {
      window.add(value);
    }

    await redis.zadd(
      `realtime:${metric}`,
      Date.now(),
      JSON.stringify({ value, timestamp: Date.now() })
    );

    await redis.expire(`realtime:${metric}`, 3600);
  }

  async getRealtimeStats(
    metric: string,
    interval: keyof WindowConfig
  ): Promise<any> {
    const window = this.windows.get(interval);

    if (!window) {
      throw new Error(`Invalid interval: ${interval}`);
    }

    return {
      metric,
      interval,
      timestamp: new Date().toISOString(),
      stats: {
        sum: window.getSum(),
        avg: window.getAverage(),
        count: window.getCount(),
        min: window.getMin(),
        max: window.getMax(),
        p50: window.getPercentile(50),
        p95: window.getPercentile(95),
        p99: window.getPercentile(99),
      },
    };
  }
}

import { z } from "zod";

export const MetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  timestamp: z.string().datetime(),
  tags: z.record(z.string(), z.string()),
  aggregationType: z.enum([
    "sum",
    "avg",
    "min",
    "max",
    "count",
    "p50",
    "p95",
    "p99",
  ]),
});

export const AggregationQuerySchema = z.object({
  metric: z.string(),
  aggregationType: z.enum([
    "sum",
    "avg",
    "min",
    "max",
    "count",
    "p50",
    "p95",
    "p99",
  ]),
  interval: z.enum(["1m", "5m", "15m", "1h", "6h", "24h", "7d"]),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  groupBy: z.array(z.string()).optional(),
  filters: z.record(z.string(), z.string()).optional(),
});

export const RealtimeSubscriptionSchema = z.object({
  metrics: z.array(z.string()),
  filters: z.record(z.string(), z.string()).optional(),
  aggregationWindow: z.enum(["1s", "5s", "10s", "30s", "1m"]).default("5s"),
});

export const PostMetricResponseSchema = z.object({
  success: z.boolean(),
});

export const AggregateResponseSchema = z.array(
  z.object({
    timestamp: z.string(),
    value: z.number(),
    metric: z.string(),
    aggregation: z.string(),
  })
);

export const RealtimeParamsSchema = z.object({
  metric: z.string(),
});

export const RealtimeQuerySchema = z.object({
  interval: z.enum(["1m", "5m", "15m", "1h", "6h", "24h", "7d"]).optional(),
});

export const RealtimeResponseSchema = z.object({
  metric: z.string(),
  interval: z.string(),
  timestamp: z.string(),
  stats: z.object({
    sum: z.number(),
    avg: z.number(),
    count: z.number(),
    min: z.number().nullable(),
    max: z.number().nullable(),
    p50: z.number().nullable(),
    p95: z.number().nullable(),
    p99: z.number().nullable(),
  }),
});

export type Metric = z.infer<typeof MetricSchema>;
export type AggregationQuery = z.infer<typeof AggregationQuerySchema>;
export type RealtimeSubscription = z.infer<typeof RealtimeSubscriptionSchema>;

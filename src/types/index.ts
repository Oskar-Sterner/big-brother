import { FastifyRequest } from "fastify";

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    userId: string;
    email?: string;
    permissions: string[];
  };
}

export interface MetricData {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface AggregationResult {
  timestamp: string;
  value: number;
  metric: string;
  aggregation: string;
}

export interface EventProcessingResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors?: string[];
}

export interface QueueMessage<T = any> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

export interface WebSocketMessage {
  type: "subscribe" | "unsubscribe" | "data" | "error" | "ping" | "pong";
  payload?: any;
  timestamp?: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
}

export interface HealthCheckResult {
  service: string;
  status: "healthy" | "unhealthy" | "degraded";
  message?: string;
  responseTime?: number;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  invalidateOn?: string[];
}

export interface ProcessorPlugin {
  name: string;
  version: string;
  init: () => Promise<void>;
  process: (event: any) => Promise<void>;
  shutdown?: () => Promise<void>;
}

export interface MetricWindow {
  start: number;
  end: number;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

export interface BatchResult<T> {
  successful: T[];
  failed: Array<{ item: T; error: string }>;
  totalProcessed: number;
  processingTime: number;
}

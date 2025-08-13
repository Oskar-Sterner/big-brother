import { z } from "zod";

export const EventSchema = z.object({
  type: z.enum(["pageview", "click", "api_call", "error", "custom"]),
  timestamp: z.string().datetime().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  metadata: z.record(z.string(), z.any()),
  tags: z.array(z.string()).optional(),
  value: z.number().optional(),
  duration: z.number().optional(),
});

export const BatchEventSchema = z.object({
  events: z.array(EventSchema).min(1).max(1000),
});

export const EventQuerySchema = z.object({
  type: z.enum(["pageview", "click", "api_call", "error", "custom"]).optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
});

export const PostEventResponseSchema = z.object({
  success: z.boolean(),
  id: z.string(),
});

export const PostBatchEventResponseSchema = z.object({
  success: z.boolean(),
  processed: z.number(),
});

export const GetEventsResponseSchema = z.object({
  events: z.array(z.record(z.string(), z.any())),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export const GetQueueStatusResponseSchema = z.object({
  queueSize: z.number(),
  isProcessing: z.boolean(),
});

export type Event = z.infer<typeof EventSchema>;
export type BatchEvent = z.infer<typeof BatchEventSchema>;
export type EventQuery = z.infer<typeof EventQuerySchema>;

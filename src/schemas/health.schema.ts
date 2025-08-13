import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  uptime: z.number(),
});

export const LiveResponseSchema = z.object({
  status: z.string(),
});

export const ReadyResponseSchema = z.object({
  status: z.string(),
  services: z.object({
    database: z.string(),
    redis: z.string(),
  }),
});

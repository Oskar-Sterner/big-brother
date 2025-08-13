import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().transform(Number).default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string(),
  DATABASE_POOL_MIN: z.string().transform(Number).default(2),
  DATABASE_POOL_MAX: z.string().transform(Number).default(10),
  REDIS_URL: z.string(),
  REDIS_PASSWORD: z.string().optional(),
  JWT_SECRET: z.string(),
  JWT_EXPIRY: z.string().default("24h"),
  RATE_LIMIT_MAX: z.string().transform(Number).default(100),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default(60000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  METRICS_RETENTION_DAYS: z.string().transform(Number).default(30),
  AGGREGATION_INTERVAL_MS: z.string().transform(Number).default(5000),
  BATCH_SIZE: z.string().transform(Number).default(1000),
});

export const config = envSchema.parse(process.env);

export type Config = z.infer<typeof envSchema>;

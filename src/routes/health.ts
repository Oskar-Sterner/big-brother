import { FastifyPluginAsync } from "fastify";
import { pool } from "../config/database";
import { redis } from "../config/redis";
import {
  HealthResponseSchema,
  LiveResponseSchema,
  ReadyResponseSchema,
} from "../schemas/health.schema";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/",
    {
      schema: {
        response: {
          200: HealthResponseSchema,
        },
      },
    },
    async (request, reply) => {
      return {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    }
  );

  fastify.get(
    "/live",
    {
      schema: {
        response: {
          200: LiveResponseSchema,
        },
      },
    },
    async (request, reply) => {
      return { status: "ok" };
    }
  );

  fastify.get(
    "/ready",
    {
      schema: {
        response: {
          200: ReadyResponseSchema,
          503: ReadyResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const services = {
        database: "unknown",
        redis: "unknown",
      };

      try {
        await pool.query("SELECT 1");
        services.database = "healthy";
      } catch (error) {
        services.database = "unhealthy";
      }

      try {
        await redis.ping();
        services.redis = "healthy";
      } catch (error) {
        services.redis = "unhealthy";
      }

      const isHealthy = Object.values(services).every((s) => s === "healthy");

      if (!isHealthy) {
        reply.code(503);
      }

      return {
        status: isHealthy ? "ready" : "not_ready",
        services,
      };
    }
  );
};

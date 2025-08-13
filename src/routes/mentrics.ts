import { FastifyPluginAsync } from "fastify";
import {
  AggregationQuerySchema,
  MetricSchema,
  PostMetricResponseSchema,
  AggregateResponseSchema,
  RealtimeParamsSchema,
  RealtimeQuerySchema,
  RealtimeResponseSchema,
} from "../schemas/metric.schema";
import { AggregatorService } from "../services/aggregator";

const aggregator = new AggregatorService();

export const metricsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/",
    {
      schema: {
        body: MetricSchema,
        response: {
          200: PostMetricResponseSchema,
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const metric = request.body as any;
      await aggregator.addRealtimeMetric(metric.name, metric.value);

      return { success: true };
    }
  );

  fastify.post(
    "/aggregate",
    {
      schema: {
        body: AggregationQuerySchema,
        response: {
          200: AggregateResponseSchema,
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const query = request.body as any;
      return await aggregator.aggregate(query);
    }
  );

  fastify.get(
    "/realtime/:metric",
    {
      schema: {
        params: RealtimeParamsSchema,
        querystring: RealtimeQuerySchema,
        response: {
          200: RealtimeResponseSchema,
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { metric } = request.params as any;
      const { interval = "5m" } = request.query as any;

      return await aggregator.getRealtimeStats(metric, interval);
    }
  );
};

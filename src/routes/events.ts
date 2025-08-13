import { FastifyPluginAsync } from "fastify";
import {
  EventSchema,
  BatchEventSchema,
  EventQuerySchema,
  PostEventResponseSchema,
  PostBatchEventResponseSchema,
  GetEventsResponseSchema,
  GetQueueStatusResponseSchema,
} from "../schemas/event.schema";
import { EventProcessorService } from "../services/event-processor";
import { pool } from "../config/database";

const eventProcessor = new EventProcessorService();

export const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/",
    {
      schema: {
        body: EventSchema,
        response: {
          200: PostEventResponseSchema,
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const event = request.body as any;
      await eventProcessor.processEvent(event);

      return {
        success: true,
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
    }
  );

  fastify.post(
    "/batch",
    {
      schema: {
        body: BatchEventSchema,
        response: {
          200: PostBatchEventResponseSchema,
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { events } = request.body as any;

      for (const event of events) {
        await eventProcessor.processEvent(event);
      }

      return {
        success: true,
        processed: events.length,
      };
    }
  );

  fastify.get(
    "/",
    {
      schema: {
        querystring: EventQuerySchema,
        response: {
          200: GetEventsResponseSchema,
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const query = request.query as any;

      let sqlQuery = "SELECT * FROM events WHERE 1=1";
      const params: any[] = [];
      let paramIndex = 1;

      if (query.type) {
        sqlQuery += ` AND type = $${paramIndex++}`;
        params.push(query.type);
      }

      if (query.userId) {
        sqlQuery += ` AND user_id = $${paramIndex++}`;
        params.push(query.userId);
      }

      if (query.sessionId) {
        sqlQuery += ` AND session_id = $${paramIndex++}`;
        params.push(query.sessionId);
      }

      if (query.startTime) {
        sqlQuery += ` AND timestamp >= $${paramIndex++}`;
        params.push(query.startTime);
      }

      if (query.endTime) {
        sqlQuery += ` AND timestamp <= $${paramIndex++}`;
        params.push(query.endTime);
      }

      if (query.tags && query.tags.length > 0) {
        sqlQuery += ` AND tags && $${paramIndex++}`;
        params.push(query.tags);
      }

      const countQuery = sqlQuery.replace("SELECT *", "SELECT COUNT(*)");
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      sqlQuery += ` ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(query.limit, query.offset);

      const result = await pool.query(sqlQuery, params);

      return {
        events: result.rows,
        total,
        limit: query.limit,
        offset: query.offset,
      };
    }
  );

  fastify.get(
    "/queue/status",
    {
      schema: {
        response: {
          200: GetQueueStatusResponseSchema,
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      return await eventProcessor.getQueueStatus();
    }
  );
};

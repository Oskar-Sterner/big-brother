import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { config } from "../config/environment";
import { pinoOptions } from "../utils/logger";
import { registerPlugins } from "./plugins";
import { eventsRoutes } from "../routes/events";

import { healthRoutes } from "../routes/health";
import { authRoutes } from "../routes/auth";
import { websocketRoutes } from "../routes/websocket";
import { errorHandler } from "../middleware/error-handler";
import { metricsRoutes } from "../routes/mentrics";
import { authMiddleware } from "../middleware/auth";

export async function createServer() {
  const server = Fastify({
    logger: pinoOptions,
    requestIdLogLabel: "requestId",
    disableRequestLogging: false,
    trustProxy: true,
  });

  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  await server.register(cors, {
    origin: true,
    credentials: true,
  });

  await server.register(helmet, {
    contentSecurityPolicy: false,
  });

  await server.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    cache: 10000,
    allowList: ["127.0.0.1"],
    redis: undefined,
    skipOnError: true,
  });

  await server.register(jwt, {
    secret: config.JWT_SECRET,
    sign: {
      expiresIn: config.JWT_EXPIRY,
    },
  });

  await server.register(websocket, {
    options: {
      maxPayload: 1048576,
      verifyClient: (info: any, cb: any) => {
        const token = info.req.headers.authorization?.replace("Bearer ", "");
        if (token) {
          server.jwt.verify(token, (err: any, decoded: any) => {
            if (err) {
              cb(false, 401, "Unauthorized");
            } else {
              info.req.user = decoded;
              cb(true);
            }
          });
        } else {
          cb(false, 401, "Unauthorized");
        }
      },
    },
  });

  await server.register(swagger, {
    openapi: {
      info: {
        title: "Real-time Analytics API",
        description: "High-performance analytics ingestion and query API",
        version: "1.0.0",
      },
      servers: [
        {
          url: `http://localhost:${config.PORT}`,
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
  });

  await server.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "none",
      deepLinking: false,
    },
  });

  await server.register(authMiddleware);

  await registerPlugins(server);

  server.setErrorHandler(errorHandler);

  server.register(authRoutes, { prefix: "/api/auth" });
  server.register(eventsRoutes, { prefix: "/api/events" });
  server.register(metricsRoutes, { prefix: "/api/metrics" });
  server.register(healthRoutes, { prefix: "/api/health" });
  server.register(websocketRoutes, { prefix: "/api/ws" });

  return server;
}

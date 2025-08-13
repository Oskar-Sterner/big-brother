import { FastifyInstance } from "fastify";

export async function registerPlugins(server: FastifyInstance) {
  server.addHook("onRequest", async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
      },
      "incoming request"
    );
  });

  server.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "request completed"
    );
  });

  server.addHook("preHandler", async (request, reply) => {
    if (request.headers["x-request-id"]) {
      request.id = request.headers["x-request-id"] as string;
    }
  });

  server.addSchema({
    $id: "commonResponse",
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
    },
  });

  server.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: "Not Found",
      message: `Route ${request.method}:${request.url} not found`,
    });
  });
}

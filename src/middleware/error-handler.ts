import { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { logger } from "../utils/logger";

export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  logger.error(
    {
      err: error,
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        params: request.params,
        query: request.query,
      },
    },
    "Request error"
  );

  if (error.validation) {
    reply.status(400).send({
      error: "Validation Error",
      message: error.message,
      validation: error.validation,
    });
    return;
  }

  if (error.statusCode) {
    reply.status(error.statusCode).send({
      error: error.name,
      message: error.message,
    });
    return;
  }

  reply.status(500).send({
    error: "Internal Server Error",
    message: "An unexpected error occurred",
  });
}

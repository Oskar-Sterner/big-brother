import { FastifyRequest, FastifyReply } from "fastify";
import { ZodSchema, ZodError } from "zod";
import { logger } from "../utils/logger";

export function validateRequest(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (schema.body) {
        request.body = schema.body.parse(request.body);
      }

      if (schema.query) {
        request.query = schema.query.parse(request.query);
      }

      if (schema.params) {
        request.params = schema.params.parse(request.params);
      }

      if (schema.headers) {
        request.headers = schema.headers.parse(
          request.headers
        ) as typeof request.headers;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn(
          {
            error: error.issues,
            path: request.url,
          },
          "Validation error"
        );

        reply.code(400).send({
          error: "Validation Error",
          message: "Request validation failed",
          details: error.issues.map((err) => ({
            path: err.path.join("."),
            message: err.message,
            code: err.code,
          })),
        });
      } else {
        throw error;
      }
    }
  };
}

export function sanitizeInput(input: any): any {
  if (typeof input === "string") {
    // Remove potential SQL injection attempts
    return input
      .replace(/;/g, "")
      .replace(/--/g, "")
      .replace(/\/\*/g, "")
      .replace(/\*\//g, "")
      .trim();
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (input && typeof input === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
}

export function validateApiKey(apiKey: string): boolean {
  // API key format: ak_<32 hex characters>
  const pattern = /^ak_[a-f0-9]{64}$/;
  return pattern.test(apiKey);
}

export function validateEmail(email: string): boolean {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

export function validateUUID(uuid: string): boolean {
  const pattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return pattern.test(uuid);
}

export function validateTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}

export function validateMetricName(name: string): boolean {
  // Metric names should be alphanumeric with dots, underscores, and hyphens
  const pattern = /^[a-zA-Z][a-zA-Z0-9._-]*$/;
  return pattern.test(name) && name.length <= 255;
}

export function validateTags(tags: Record<string, string>): boolean {
  const maxTags = 20;
  const maxKeyLength = 100;
  const maxValueLength = 255;

  const tagEntries = Object.entries(tags);

  if (tagEntries.length > maxTags) {
    return false;
  }

  for (const [key, value] of tagEntries) {
    if (key.length > maxKeyLength || value.length > maxValueLength) {
      return false;
    }

    // Validate key format
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
      return false;
    }
  }

  return true;
}

export class ValidationError extends Error {
  constructor(public field: string, public value: any, message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

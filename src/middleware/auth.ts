import { FastifyRequest, FastifyReply } from "fastify";
import { pool } from "../config/database";
import crypto from "crypto";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

async function authPlugin(fastify: any, options: any) {
  fastify.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        const authorization = request.headers.authorization;

        if (!authorization) {
          reply.code(401).send({ error: "No authorization header" });
          return;
        }

        if (authorization.startsWith("Bearer ")) {
          const token = authorization.replace("Bearer ", "");
          try {
            const decoded = await fastify.jwt.verify(token);
            (request as any).user = decoded;
          } catch (err) {
            reply.code(401).send({ error: "Invalid token" });
          }
        } else if (authorization.startsWith("ApiKey ")) {
          const apiKey = authorization.replace("ApiKey ", "");
          const hashedKey = crypto
            .createHash("sha256")
            .update(apiKey)
            .digest("hex");

          const query = `
          SELECT user_id, permissions, expires_at 
          FROM api_keys 
          WHERE key_hash = $1 AND (expires_at IS NULL OR expires_at > NOW())
        `;

          const result = await pool.query(query, [hashedKey]);

          if (result.rows.length === 0) {
            reply.code(401).send({ error: "Invalid API key" });
            return;
          }

          const keyData = result.rows[0];
          (request as any).user = {
            userId: keyData.user_id,
            permissions: keyData.permissions,
          };
        } else {
          reply.code(401).send({ error: "Invalid authorization format" });
        }
      } catch (error) {
        reply.code(500).send({ error: "Authentication failed" });
      }
    }
  );
}

export const authMiddleware = fp(authPlugin);

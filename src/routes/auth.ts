import { FastifyPluginAsync } from "fastify";
import {
  LoginSchema,
  RegisterSchema,
  ApiKeySchema,
  RegisterResponseSchema,
  LoginResponseSchema,
  ErrorResponseSchema,
  ApiKeyResponseSchema,
  VerifyResponseSchema,
} from "../schemas/auth.schema";
import { pool } from "../config/database";
import crypto from "crypto";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/register",
    {
      schema: {
        body: RegisterSchema,
        response: {
          200: RegisterResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { email, password, name, organization } = request.body as any;

      const hashedPassword = crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");

      const query = `
      INSERT INTO users (email, password, name, organization)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email
    `;

      const result = await pool.query(query, [
        email,
        hashedPassword,
        name,
        organization,
      ]);
      const user = result.rows[0];

      const token = fastify.jwt.sign({
        userId: user.id,
        email: user.email,
        permissions: ["read", "write"],
      });

      return {
        id: user.id,
        email: user.email,
        token,
      };
    }
  );

  fastify.post(
    "/login",
    {
      schema: {
        body: LoginSchema,
        response: {
          200: LoginResponseSchema,
          401: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as any;

      const hashedPassword = crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");

      const query =
        "SELECT id, email FROM users WHERE email = $1 AND password = $2";
      const result = await pool.query(query, [email, hashedPassword]);

      if (result.rows.length === 0) {
        reply.code(401);
        return { error: "Invalid credentials" };
      }

      const user = result.rows[0];

      const token = fastify.jwt.sign({
        userId: user.id,
        email: user.email,
        permissions: ["read", "write"],
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
        },
      };
    }
  );

  fastify.post(
    "/api-key",
    {
      schema: {
        body: ApiKeySchema,
        response: {
          200: ApiKeyResponseSchema,
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { name, permissions, expiresAt } = request.body as any;
      const user = (request as any).user;

      const key = `ak_${crypto.randomBytes(32).toString("hex")}`;
      const hashedKey = crypto.createHash("sha256").update(key).digest("hex");

      const query = `
      INSERT INTO api_keys (user_id, name, key_hash, permissions, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

      const result = await pool.query(query, [
        user.userId,
        name,
        hashedKey,
        permissions,
        expiresAt || null,
      ]);

      return {
        key,
        id: result.rows[0].id,
      };
    }
  );

  fastify.get(
    "/verify",
    {
      schema: {
        response: {
          200: VerifyResponseSchema,
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = (request as any).user;

      return {
        valid: true,
        user,
      };
    }
  );
};

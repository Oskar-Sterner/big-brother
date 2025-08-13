import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  organization: z.string().optional(),
});

export const ApiKeySchema = z.object({
  name: z.string(),
  permissions: z.array(z.enum(["read", "write", "admin"])),
  expiresAt: z.string().datetime().optional(),
});

export const TokenPayloadSchema = z.object({
  userId: z.string(),
  email: z.string(),
  permissions: z.array(z.string()),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export const RegisterResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  token: z.string(),
});

export const LoginResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
  }),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
});

export const ApiKeyResponseSchema = z.object({
  key: z.string(),
  id: z.string(),
});

export const VerifyResponseSchema = z.object({
  valid: z.boolean(),
  user: TokenPayloadSchema.omit({ iat: true, exp: true }),
});

export type Login = z.infer<typeof LoginSchema>;
export type Register = z.infer<typeof RegisterSchema>;
export type ApiKey = z.infer<typeof ApiKeySchema>;
export type TokenPayload = z.infer<typeof TokenPayloadSchema>;

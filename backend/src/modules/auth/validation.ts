import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(512),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().max(320),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(20).max(512),
  password: z.string().min(12).max(128),
});

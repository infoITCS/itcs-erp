import { z } from "zod";

const permissionCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9-]+:[a-z0-9-]+$/, "Invalid permission code");

const permissionsSchema = z.array(permissionCodeSchema).max(500);

export const roleIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  permissions: permissionsSchema.default([]),
});

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    permissions: permissionsSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Provide at least one field to update",
  });

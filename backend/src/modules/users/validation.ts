import { AccountStatus } from "@prisma/client";
import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";

const accountStatusSchema = z.enum([
  AccountStatus.ACTIVE,
  AccountStatus.INACTIVE,
  AccountStatus.LOCKED,
]);

const roleCodesSchema = z.array(z.string().trim().min(1).max(64)).min(1).max(10);

export const userListQuerySchema = listQuerySchema.extend({
  status: accountStatusSchema.optional(),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const createUserSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(128),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  roleCodes: roleCodesSchema,
});

export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    status: accountStatusSchema.optional(),
    roleCodes: roleCodesSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Provide at least one field to update",
  });

export const updateUserStatusSchema = z.object({
  status: accountStatusSchema,
});

export const resetUserPasswordSchema = z.object({
  newPassword: z.string().min(12).max(128),
});

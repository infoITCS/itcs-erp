import { AccountStatus } from "@prisma/client";
import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";

export const userListQuerySchema = listQuerySchema;

export const userIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const createUserSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(128),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  roleCodes: z.array(z.string().trim().min(1).max(64)).min(1).max(10),
});

export const updateUserStatusSchema = z.object({
  status: z.enum([AccountStatus.ACTIVE, AccountStatus.INACTIVE, AccountStatus.LOCKED]),
});

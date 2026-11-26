import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";

export const auditListQuerySchema = listQuerySchema.extend({
  module: z.string().trim().min(1).max(64).optional(),
  entityType: z.string().trim().min(1).max(64).optional(),
  entityId: z.string().trim().min(1).max(64).optional(),
  subjectId: z.string().uuid().optional(),
  date: z.iso.date().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export const auditRetentionBodySchema = z.object({
  retentionDays: z.number().int().min(1).max(3650),
});

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
export type AuditRetentionBody = z.infer<typeof auditRetentionBodySchema>;

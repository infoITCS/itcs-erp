import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";

export const auditListQuerySchema = listQuerySchema.extend({
  module: z.string().trim().min(1).max(64).optional(),
  entityType: z.string().trim().min(1).max(64).optional(),
  entityId: z.string().trim().min(1).max(64).optional(),
  subjectId: z.string().uuid().optional(),
});

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;

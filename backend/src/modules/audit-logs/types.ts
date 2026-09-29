import type { Prisma } from "@prisma/client";

export interface AuditEntry {
  organizationId?: string | null;
  userId: string | null;
  action: string;
  module: string;
  entityType: string;
  entityId: string | null;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditWriter {
  record(entry: AuditEntry): Promise<void>;
}

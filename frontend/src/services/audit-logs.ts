import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  module: string;
  entityType: string;
  entityId: string | null;
  oldValues: unknown;
  newValues: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  pageInfo: {
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
}

export function listAuditLogs(params: { cursor?: string; limit?: number }): Promise<AuditLogPage> {
  return http
    .get<ApiSuccess<AuditLogPage>>("/api/v1/audit-logs", { params })
    .then((response) => response.data.data as AuditLogPage);
}

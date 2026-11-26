import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export interface AuditLogActor {
  name: string;
  email: string | null;
  initials: string;
  isSystem: boolean;
}

export interface AuditLogAction {
  key: string;
  label: string;
  headline: string;
  description: string;
  category: "create" | "update" | "status" | "delete" | "security" | "convert";
  tone: "emerald" | "blue" | "amber" | "rose" | "violet" | "slate";
  icon: string;
}

export interface AuditLogSubject {
  type: string;
  typeLabel: string;
  label: string;
  detail: string | null;
}

export interface AuditLogChange {
  key: string;
  label: string;
  before: string;
  after: string;
}

export interface AuditLogFact {
  label: string;
  value: string;
}

export interface AuditLogEntry {
  id: string;
  createdAt: string;
  actor: AuditLogActor;
  action: AuditLogAction;
  module: { key: string; label: string };
  subject: AuditLogSubject;
  changes: AuditLogChange[];
  facts: AuditLogFact[];
  tags: string[];
  searchText: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  pageInfo: {
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
}

export interface AuditLogRetention {
  retentionDays: number;
  defaultRetentionDays: number;
}

export interface AuditLogQuery {
  cursor?: string;
  limit?: number;
  module?: string;
  date?: string;
  from?: string;
  to?: string;
}

export function listAuditLogs(params: AuditLogQuery): Promise<AuditLogPage> {
  return http
    .get<ApiSuccess<AuditLogPage>>("/api/v1/audit-logs", { params })
    .then((response) => response.data.data as AuditLogPage);
}

export function getAuditLogRetention(): Promise<AuditLogRetention> {
  return http
    .get<ApiSuccess<AuditLogRetention>>("/api/v1/audit-logs/retention")
    .then((response) => response.data.data as AuditLogRetention);
}

export function updateAuditLogRetention(retentionDays: number): Promise<AuditLogRetention> {
  return http
    .patch<ApiSuccess<AuditLogRetention>>("/api/v1/audit-logs/retention", { retentionDays })
    .then((response) => response.data.data as AuditLogRetention);
}

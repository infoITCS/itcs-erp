import { ValidationFailedError } from "../../common/errors/app-error";
import { logger } from "../../common/logging/logger";
import { toCursorPage } from "../../common/pagination/cursor";
import type { RequestMeta } from "../auth/types";
import type { AuditEnrichmentRepository } from "./enrichment-repository";
import { presentAuditRows, type AuditDisplayContext } from "./presenter";
import type { AuditDateRange, AuditLogsRepository } from "./repository";
import type { AuditEntry } from "./types";

export const DEFAULT_AUDIT_RETENTION_DAYS = 365;

export interface AuditRetentionRepository {
  getRetentionDays(organizationId: string): Promise<number>;
  setRetentionDays(organizationId: string, retentionDays: number): Promise<number>;
  listRetentionPolicies(): Promise<Array<{ id: string; auditLogRetentionDays: number }>>;
  purgeExpired(cutoff: Date, organizationId: string | null): Promise<number>;
}

export interface AuditRetentionView {
  retentionDays: number;
  defaultRetentionDays: number;
}

export class AuditLogsService {
  constructor(
    private readonly repository: Pick<AuditLogsRepository, "append" | "list">,
    private readonly enricher?: Pick<AuditEnrichmentRepository, "resolve">,
    private readonly retentionRepository?: AuditRetentionRepository,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.repository.append(entry);
    logger.info({ audit: { action: entry.action, module: entry.module, entityId: entry.entityId } }, "audit.event");
  }

  async list(
    organizationId: string,
    limit: number,
    cursor?: string,
    filter?: {
      module?: string;
      entityType?: string;
      entityId?: string;
      subjectId?: string;
      dateRange?: AuditDateRange;
    },
  ) {
    const rows = await this.repository.list(limit, cursor, organizationId, filter);
    const page = toCursorPage(rows, limit);
    const context: AuditDisplayContext = this.enricher ? await this.enricher.resolve(page.items) : {};
    return {
      items: presentAuditRows(page.items, context),
      pageInfo: page.pageInfo,
    };
  }

  private retention(): AuditRetentionRepository {
    if (!this.retentionRepository) {
      throw new ValidationFailedError({ retention: ["Audit retention is not configured"] });
    }
    return this.retentionRepository;
  }

  async getRetentionView(organizationId: string): Promise<AuditRetentionView> {
    return {
      retentionDays: await this.retention().getRetentionDays(organizationId),
      defaultRetentionDays: DEFAULT_AUDIT_RETENTION_DAYS,
    };
  }

  async updateRetentionDays(
    organizationId: string,
    actorId: string,
    retentionDays: number,
    meta: RequestMeta,
  ): Promise<AuditRetentionView> {
    const repository = this.retention();
    const previous = await repository.getRetentionDays(organizationId);
    const updated = await repository.setRetentionDays(organizationId, retentionDays);
    await this.record({
      organizationId,
      userId: actorId,
      action: "audit_logs.retention_changed",
      module: "audit-logs",
      entityType: "organization",
      entityId: organizationId,
      oldValues: { retentionDays: previous },
      newValues: { retentionDays: updated },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    try {
      await this.purgeExpiredLogs();
    } catch (error: unknown) {
      logger.error({ err: error }, "audit.retention.purge_failed");
    }
    return { retentionDays: updated, defaultRetentionDays: DEFAULT_AUDIT_RETENTION_DAYS };
  }

  async purgeExpiredLogs(): Promise<number> {
    const repository = this.retention();
    const policies = await repository.listRetentionPolicies();
    let deleted = 0;
    for (const policy of policies) {
      deleted += await repository.purgeExpired(daysAgo(policy.auditLogRetentionDays), policy.id);
    }
    deleted += await repository.purgeExpired(daysAgo(DEFAULT_AUDIT_RETENTION_DAYS), null);
    if (deleted > 0) {
      logger.info({ audit: { deleted, policies: policies.length } }, "audit.retention.purged");
    }
    return deleted;
  }
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
}

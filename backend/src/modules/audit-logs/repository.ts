import type { Prisma } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { decodeCursor } from "../../common/pagination/cursor";
import type { AuditEntry } from "./types";

export interface AuditDateRange {
  from?: Date;
  to?: Date;
}

export interface AuditListFilter {
  module?: string;
  entityType?: string;
  entityId?: string;
  subjectId?: string;
  dateRange?: AuditDateRange;
}

export class AuditLogsRepository extends BaseRepository {
  canPersist(): boolean {
    return true;
  }

  async append(entry: AuditEntry): Promise<void> {
    await this.db.auditLog.create({
      data: {
        organizationId: entry.organizationId ?? null,
        userId: entry.userId,
        action: entry.action,
        module: entry.module,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValues: entry.oldValues ?? undefined,
        newValues: entry.newValues ?? undefined,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  }

  async list(
    limit: number,
    cursor: string | undefined,
    organizationId: string,
    filter: AuditListFilter = {},
  ) {
    const decoded = cursor ? decodeCursor(cursor) : null;
    const and: Prisma.AuditLogWhereInput[] = [];
    if (filter.subjectId) {
      and.push({
        OR: [
          { entityId: filter.subjectId },
          { newValues: { path: ["customerId"], equals: filter.subjectId } },
          { newValues: { path: ["productId"], equals: filter.subjectId } },
          { newValues: { path: ["categoryId"], equals: filter.subjectId } },
          { newValues: { path: ["resellerId"], equals: filter.subjectId } },
        ],
      });
    }
    if (decoded) {
      and.push({
        OR: [
          { createdAt: { lt: new Date(decoded.createdAt) } },
          { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
        ],
      });
    }
    const rows = await this.db.auditLog.findMany({
      where: {
        organizationId,
        ...(filter.dateRange
          ? {
              createdAt: {
                ...(filter.dateRange.from ? { gte: filter.dateRange.from } : {}),
                ...(filter.dateRange.to ? { lte: filter.dateRange.to } : {}),
              },
            }
          : {}),
        ...(filter.module ? { module: filter.module } : {}),
        ...(filter.entityType ? { entityType: filter.entityType } : {}),
        ...(filter.entityId ? { entityId: filter.entityId } : {}),
        ...(and.length > 0 ? { AND: and } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        userId: true,
        action: true,
        module: true,
        entityType: true,
        entityId: true,
        oldValues: true,
        newValues: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    });
    return rows;
  }

  async getRetentionDays(organizationId: string): Promise<number> {
    const organization = await this.db.organization.findUnique({
      where: { id: organizationId },
      select: { auditLogRetentionDays: true },
    });
    return organization?.auditLogRetentionDays ?? 365;
  }

  async setRetentionDays(organizationId: string, retentionDays: number): Promise<number> {
    const updated = await this.db.organization.update({
      where: { id: organizationId },
      data: { auditLogRetentionDays: retentionDays },
      select: { auditLogRetentionDays: true },
    });
    return updated.auditLogRetentionDays;
  }

  async listRetentionPolicies(): Promise<Array<{ id: string; auditLogRetentionDays: number }>> {
    return this.db.organization.findMany({
      select: { id: true, auditLogRetentionDays: true },
    });
  }

  async purgeExpired(cutoff: Date, organizationId: string | null): Promise<number> {
    const result = await this.db.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        ...(organizationId ? { organizationId } : { organizationId: null }),
      },
    });
    return result.count;
  }
}

export type AuditListRow = Prisma.AuditLogGetPayload<{
  select: {
    id: true;
    userId: true;
    action: true;
    module: true;
    entityType: true;
    entityId: true;
    oldValues: true;
    newValues: true;
    ipAddress: true;
    userAgent: true;
    createdAt: true;
  };
}>;

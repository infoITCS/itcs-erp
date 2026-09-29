import type { Prisma } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { decodeCursor } from "../../common/pagination/cursor";
import type { AuditEntry } from "./types";

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

  async list(limit: number, cursor: string | undefined, organizationId: string) {
    const decoded = cursor ? decodeCursor(cursor) : null;
    const rows = await this.db.auditLog.findMany({
      where: {
        organizationId,
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: new Date(decoded.createdAt) } },
                { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
              ],
            }
          : {}),
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

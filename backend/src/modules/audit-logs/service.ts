import { logger } from "../../common/logging/logger";
import { toCursorPage } from "../../common/pagination/cursor";
import type { AuditLogsRepository } from "./repository";
import type { AuditEntry } from "./types";

export class AuditLogsService {
  constructor(private readonly repository: Pick<AuditLogsRepository, "append" | "list">) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.repository.append(entry);
    logger.info({ audit: { action: entry.action, module: entry.module, entityId: entry.entityId } }, "audit.event");
  }

  async list(organizationId: string, limit: number, cursor?: string) {
    const rows = await this.repository.list(limit, cursor, organizationId);
    return toCursorPage(rows, limit);
  }
}

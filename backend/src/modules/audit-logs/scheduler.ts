import { logger } from "../../common/logging/logger";
import type { AuditLogsService } from "./service";

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function startAuditRetentionScheduler(
  service: AuditLogsService,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): () => void {
  const run = (): void => {
    void service.purgeExpiredLogs().catch((error: unknown) => {
      logger.error({ err: error }, "audit.retention.scheduler_failed");
    });
  };

  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

import assert from "node:assert/strict";
import test from "node:test";
import { AuditLogsService } from "../src/modules/audit-logs/service";
import type { AuditEntry } from "../src/modules/audit-logs/types";

const DAY_MS = 24 * 60 * 60 * 1000;

test("audit list forwards an explicit date range to the repository", async () => {
  let capturedFilter: unknown;
  const service = new AuditLogsService({
    append: async () => {},
    list: async (_limit, _cursor, _organizationId, filter) => {
      capturedFilter = filter;
      return [];
    },
  });
  const from = new Date("2026-11-20T00:00:00.000Z");
  const to = new Date("2026-11-26T23:59:59.999Z");

  await service.list("org-1", 25, undefined, { dateRange: { from, to } });

  assert.deepEqual(capturedFilter, { dateRange: { from, to } });
});

test("retention update is audited and purge uses the saved policy", async () => {
  let retentionDays = 365;
  let auditEntry: AuditEntry | undefined;
  const purged: Array<{ cutoff: Date; organizationId: string | null }> = [];
  const service = new AuditLogsService(
    {
      append: async (entry) => {
        auditEntry = entry;
      },
      list: async () => [],
    },
    undefined,
    {
      getRetentionDays: async () => retentionDays,
      setRetentionDays: async (_organizationId, days) => {
        retentionDays = days;
        return days;
      },
      listRetentionPolicies: async () => [{ id: "org-1", auditLogRetentionDays: retentionDays }],
      purgeExpired: async (cutoff, organizationId) => {
        purged.push({ cutoff, organizationId });
        return 1;
      },
    },
  );

  const view = await service.updateRetentionDays("org-1", "user-1", 30, {
    ipAddress: "127.0.0.1",
    userAgent: "unit-test",
  });

  assert.equal(view.retentionDays, 30);
  assert.equal(view.defaultRetentionDays, 365);
  assert.equal(auditEntry?.action, "audit_logs.retention_changed");
  assert.deepEqual(auditEntry?.oldValues, { retentionDays: 365 });
  assert.deepEqual(auditEntry?.newValues, { retentionDays: 30 });
  assert.equal(auditEntry?.ipAddress, "127.0.0.1");
  assert.equal(purged.length, 2);
  assert.equal(purged[0]?.organizationId, "org-1");
  assert.equal(purged[1]?.organizationId, null);
  const now = Date.now();
  assert.ok(Math.abs((purged[0]?.cutoff.getTime() ?? 0) - (now - 30 * DAY_MS)) < 5000);
  assert.ok(Math.abs((purged[1]?.cutoff.getTime() ?? 0) - (now - 365 * DAY_MS)) < 5000);
});

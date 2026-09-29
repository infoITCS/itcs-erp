import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AuditLogsService } from "../src/modules/audit-logs/service";
import type { AuditEntry } from "../src/modules/audit-logs/types";

describe("audit logging", () => {
  it("persists the actor, entity, before and after values, and request metadata", async () => {
    const stored: AuditEntry[] = [];
    const service = new AuditLogsService({
      async append(entry) {
        stored.push(entry);
      },
      async list() {
        return [];
      },
    });

    const entry: AuditEntry = {
      organizationId: "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f",
      userId: "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11",
      action: "users.status.changed",
      module: "users",
      entityType: "user",
      entityId: "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11",
      oldValues: { status: "ACTIVE" },
      newValues: { status: "LOCKED" },
      ipAddress: "203.0.113.10",
      userAgent: "test-agent",
    };

    await service.record(entry);
    assert.deepEqual(stored[0], entry);
  });
});

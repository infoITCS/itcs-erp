import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayKey, presentAuditRows } from "../src/modules/audit-logs/presenter";
import type { AuditListRow } from "../src/modules/audit-logs/repository";

describe("audit log presentation", () => {
  it("turns stored IDs into names and writes a readable activity headline", () => {
    const actorId = "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11";
    const tenderId = "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f";
    const opportunityId = "2f1a6d4c-8b3e-4a7d-9c2f-5e8b1a7d6c30";
    const rows: AuditListRow[] = [
      {
        id: "3c9f0a11-7d24-4b6e-8f1a-9b2c3d4e5f60",
        userId: actorId,
        action: "tenders.converted_to_opportunity",
        module: "tenders",
        entityType: "tender",
        entityId: tenderId,
        oldValues: { status: "SUBMITTED" },
        newValues: {
          tenderId,
          tenderNumber: "TND-2026-00001",
          opportunityId,
          opportunityNumber: "OPP-2026-00001",
          estimatedValue: "50000",
          currencyCode: "PKR",
        },
        ipAddress: "203.0.113.10",
        userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0",
        createdAt: new Date("2026-11-26T10:30:00.000Z"),
      },
    ];
    const context = {
      [displayKey("user", actorId)]: {
        label: "Ayesha Khan",
        email: "ayesha@example.com",
        initials: "AK",
      },
      [displayKey("tender", tenderId)]: {
        label: "Network Upgrade",
        detail: "TND-2026-00001 · pseb",
      },
      [displayKey("opportunity", opportunityId)]: {
        label: "Network Upgrade",
        detail: "OPP-2026-00001",
      },
    };

    const [entry] = presentAuditRows(rows, context);
    const rendered = JSON.stringify(entry).toLowerCase();

    assert.equal(entry.actor.name, "Ayesha Khan");
    assert.equal(entry.actor.initials, "AK");
    assert.equal(entry.action.label, "Converted to opportunity");
    assert.match(entry.action.headline, /Ayesha Khan converted tender/);
    assert.match(entry.action.headline, /Network Upgrade · TND-2026-00001/);
    assert.match(entry.action.headline, /Network Upgrade · OPP-2026-00001/);
    assert.equal(entry.subject.label, "Network Upgrade");
    assert.ok(entry.facts.some((fact) => fact.label === "Opportunity number" && fact.value === "OPP-2026-00001"));
    assert.ok(!entry.changes.some((change) => change.key === "status"));
    assert.ok(!rendered.includes(actorId));
    assert.ok(!rendered.includes(tenderId));
    assert.ok(!rendered.includes(opportunityId));
    assert.ok(entry.searchText.includes("ayesha khan"));
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuditEntry } from "../src/modules/audit-logs/types";
import { buildTenderListWhere } from "../src/modules/tenders/list-filter";
import { decodeTenderCursor, encodeTenderCursor, toTenderPage } from "../src/modules/tenders/page";
import { TendersService } from "../src/modules/tenders/service";
import { createTenderSchema, tenderListQuerySchema, updateTenderSchema } from "../src/modules/tenders/validation";

const orgId = "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f";
const actorId = "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11";
const customerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const contactId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const tenderId = "11111111-1111-4111-8111-111111111111";
const meta = { ipAddress: "127.0.0.1", userAgent: "test" };

const validTender = {
  title: "Network refresh",
  customerId,
  currencyCode: "PKR",
};

function recorder(audits: AuditEntry[]) {
  return {
    async record(entry: AuditEntry) {
      audits.push(entry);
    },
  };
}

describe("tender validation", () => {
  it("requires a customer and uppercases the currency", () => {
    const parsed = createTenderSchema.safeParse({ ...validTender, currencyCode: "pkr" });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.currencyCode, "PKR");
      assert.equal(parsed.data.customerId, customerId);
    }
    assert.equal(createTenderSchema.safeParse({ title: "No customer", currencyCode: "PKR" }).success, false);
  });

  it("rejects unknown statuses and empty updates", () => {
    assert.equal(
      createTenderSchema.safeParse({ ...validTender, status: "PENDING" }).success,
      false,
    );
    assert.equal(updateTenderSchema.safeParse({}).success, false);
    assert.equal(updateTenderSchema.safeParse({ status: "SUBMITTED" }).success, true);
  });

  it("validates list filters and page limits", () => {
    assert.equal(tenderListQuerySchema.safeParse({ limit: "101" }).success, false);
    const parsed = tenderListQuerySchema.safeParse({ includeDeleted: "true", status: "OPEN", customerId });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.includeDeleted, true);
    }
  });
});

describe("tender list filters", () => {
  it("always scopes to the organization and hides deleted rows", () => {
    const where = buildTenderListWhere({ organizationId: orgId, q: "network", status: "OPEN", customerId });
    assert.equal(where.organizationId, orgId);
    assert.equal(where.deletedAt, null);
    assert.equal(where.status, "OPEN");
    assert.equal(where.customerId, customerId);
    assert.ok(Array.isArray(where.OR));
  });

  it("keeps deleted rows only when includeDeleted is set", () => {
    const where = buildTenderListWhere({ organizationId: orgId, includeDeleted: true, ownerUserId: actorId });
    assert.equal(where.deletedAt, undefined);
    assert.equal(where.ownerUserId, actorId);
  });
});

describe("tender paging", () => {
  it("round-trips a cursor and creates a next cursor", () => {
    const cursor = { sort: "title" as const, value: "Network refresh", id: tenderId };
    assert.deepEqual(decodeTenderCursor(encodeTenderCursor(cursor)), cursor);

    const page = toTenderPage(
      [
        {
          id: tenderId,
          createdAt: new Date("2026-10-26T00:00:00.000Z"),
          title: "Network refresh",
          tenderNumber: "TND-2026-00001",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          createdAt: new Date("2026-10-25T00:00:00.000Z"),
          title: "Second",
          tenderNumber: "TND-2026-00002",
        },
      ],
      1,
      "createdAt",
    );
    assert.equal(page.items.length, 1);
    assert.equal(page.pageInfo.hasNextPage, true);
    assert.ok(page.pageInfo.nextCursor);
  });
});

describe("tender service", () => {
  it("creates a tender with a currency snapshot, actor owner, and audit entry", async () => {
    const audits: AuditEntry[] = [];
    let capturedOwner = "";
    const service = new TendersService(
      {
        async currencyIsActive() {
          return true;
        },
        async findActiveOrgUser() {
          return { id: actorId };
        },
        async findCustomerForLink() {
          return { id: customerId, status: "ACTIVE" };
        },
        async findOrganization() {
          return { baseCurrencyCode: "PKR" };
        },
        async findExchangeRateValue() {
          return null;
        },
        async create(_organizationId: string, _actorId: string, input: { ownerUserId: string; estimatedValue: string }) {
          capturedOwner = input.ownerUserId;
          return {
            id: tenderId,
            tenderNumber: "TND-2026-00001",
            title: "Network refresh",
            status: "DRAFT",
            customerId,
            currencyCode: "PKR",
            estimatedValue: input.estimatedValue,
            estimatedValueBase: "1000.0000",
          };
        },
      } as never,
      recorder(audits),
    );

    const tender = await service.create(
      orgId,
      actorId,
      { ...validTender, estimatedValue: "1000" } as never,
      meta,
    );
    assert.equal(capturedOwner, actorId);
    assert.equal(tender.tenderNumber, "TND-2026-00001");
    assert.equal(audits[0]?.action, "tenders.created");
  });

  it("rejects a contact that belongs to a different customer", async () => {
    const service = new TendersService(
      {
        async currencyIsActive() {
          return true;
        },
        async findActiveOrgUser() {
          return { id: actorId };
        },
        async findCustomerForLink() {
          return { id: customerId, status: "ACTIVE" };
        },
        async findContactForTender() {
          return { id: contactId, customerId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" };
        },
      } as never,
      recorder([]),
    );

    try {
      await service.create(orgId, actorId, { ...validTender, contactId } as never, meta);
      assert.fail("expected a validation error");
    } catch (error) {
      const errors = (error as { errors?: Record<string, string[]> }).errors;
      assert.ok(errors?.contactId?.[0]?.includes("belongs to the linked customer"));
    }
  });

  it("does not allow deleted tenders without delete or restore permission", async () => {
    const service = new TendersService({} as never, recorder([]));
    await assert.rejects(
      () =>
        service.list(
          orgId,
          { includeDeleted: true, limit: 50, order: "desc" } as never,
          ["tenders:read"],
        ),
      /permission/i,
    );
  });
});

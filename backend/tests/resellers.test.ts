import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { requirePermission } from "../src/middleware/authorize";
import type { AuditEntry } from "../src/modules/audit-logs/types";
import { buildResellerListWhere } from "../src/modules/resellers/list-filter";
import { ResellersRepository } from "../src/modules/resellers/repository";
import { ResellersService } from "../src/modules/resellers/service";
import { RESELLERS_MODULE } from "../src/modules/resellers/types";
import {
  createResellerSchema,
  resellerListQuerySchema,
  updateAddressSchema,
  updateResellerSchema,
} from "../src/modules/resellers/validation";

const orgId = "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f";
const actorId = "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11";
const meta = { ipAddress: "127.0.0.1", userAgent: "test" };

const validReseller = {
  legalName: "Channel Partners LLC",
  displayName: "Channel Partners",
  countryCode: "pk",
  currencyCode: "pkr",
};

describe("reseller validation", () => {
  it("uppercases country, currency, and price list and rejects oversized pages", () => {
    const created = createResellerSchema.safeParse({
      ...validReseller,
      priceListCode: "reseller_gold",
      defaultDiscountPercent: "10.5000",
    });
    assert.equal(created.success, true);
    if (created.success) {
      assert.equal(created.data.countryCode, "PK");
      assert.equal(created.data.currencyCode, "PKR");
      assert.equal(created.data.priceListCode, "RESELLER_GOLD");
    }
    assert.equal(resellerListQuerySchema.safeParse({ limit: "101" }).success, false);
  });

  it("accepts partial address updates and nullable field clearing", () => {
    const partial = updateAddressSchema.safeParse({ city: "Lahore" });
    assert.equal(partial.success, true);
    assert.equal(updateAddressSchema.safeParse({}).success, false);

    const update = updateResellerSchema.safeParse({ email: null, taxNumber: null, defaultDiscountPercent: null });
    assert.equal(update.success, true);
    if (update.success) {
      assert.equal(update.data.email, null);
      assert.equal(update.data.taxNumber, null);
      assert.equal(update.data.defaultDiscountPercent, null);
    }
  });

  it("rejects a percentage above 100", async () => {
    const service = new ResellersService(
      {
        async currencyIsActive() {
          return true;
        },
      } as never,
      recorder([]),
    );
    try {
      await service.create(orgId, actorId, { ...validReseller, defaultDiscountPercent: "101" } as never, meta);
      assert.fail("expected percentage rejection");
    } catch (error) {
      const errors = (error as { errors?: Record<string, string[]> }).errors;
      assert.ok(errors?.defaultDiscountPercent?.[0]?.includes("0 and 100"));
    }
  });
});

describe("reseller list filters", () => {
  it("always scopes the query to the organization and hides deleted rows", () => {
    const where = buildResellerListWhere({ organizationId: orgId, q: "channel", status: "ACTIVE" });
    assert.equal(where.organizationId, orgId);
    assert.equal(where.deletedAt, null);
    assert.equal(where.status, "ACTIVE");
    assert.ok(Array.isArray(where.OR));
  });
});

describe("reseller service", () => {
  it("creates a reseller, allocates a number, and records audit", async () => {
    const audits: AuditEntry[] = [];
    const service = new ResellersService(
      {
        async currencyIsActive() {
          return true;
        },
        async create() {
          return {
            id: "11111111-1111-4111-8111-111111111111",
            resellerNumber: "RSL-2026-00001",
            displayName: "Channel Partners",
            status: "ACTIVE",
            priceListCode: "STANDARD",
            addresses: [],
            contacts: [],
          };
        },
      } as never,
      recorder(audits),
    );

    const reseller = await service.create(orgId, actorId, validReseller as never, meta);
    assert.equal(reseller.resellerNumber, "RSL-2026-00001");
    assert.equal(audits[0]?.action, "resellers.created");
  });

  it("rejects duplicate emails before any pricing validation", async () => {
    const service = new ResellersService(
      {
        async emailExists() {
          return true;
        },
        async displayNameExists() {
          return false;
        },
        async currencyIsActive() {
          assert.fail("currency should not be checked for duplicate input");
        },
      } as never,
      recorder([]),
    );

    await assert.rejects(
      () => service.create(orgId, actorId, { ...validReseller, email: "taken@example.com" } as never, meta),
      /email already exists/,
    );
  });

  it("scopes audit listing to this reseller", async () => {
    let captured: { limit?: number; cursor?: string; filter?: unknown } = {};
    const service = new ResellersService(
      {
        async findById() {
          return { id: "r1" };
        },
      } as never,
      {
        ...recorder([]),
        async list(_organizationId: string, limit: number, cursor: string | undefined, filter: unknown) {
          captured = { limit, cursor, filter };
          return { items: [], pageInfo: { limit, hasNextPage: false, nextCursor: null } };
        },
      } as never,
    );

    await service.listAudit(orgId, "r1", 25, "next-cursor");
    assert.deepEqual(captured, {
      limit: 25,
      cursor: "next-cursor",
      filter: { entityType: "reseller", entityId: "r1", module: RESELLERS_MODULE },
    });
  });

  it("rejects assigning a customer to a suspended reseller", async () => {
    const service = new ResellersService(
      {
        async findById() {
          return {
            id: "r1",
            status: "SUSPENDED",
            displayName: "Partner",
            priceListCode: "STANDARD",
            addresses: [],
            contacts: [],
          };
        },
      } as never,
      recorder([]),
    );

    try {
      await service.assignCustomer(orgId, actorId, "r1", "c1", meta);
      assert.fail("expected inactive assignment rejection");
    } catch (error) {
      const errors = (error as { errors?: Record<string, string[]> }).errors;
      assert.ok(errors?.customerId?.[0]?.includes("active reseller"));
    }
  });

  it("rejects assigning a customer already owned by another reseller", async () => {
    const service = new ResellersService(
      {
        async findById() {
          return {
            id: "r1",
            status: "ACTIVE",
            displayName: "Partner",
            priceListCode: "STANDARD",
            addresses: [],
            contacts: [],
          };
        },
        async findCustomerForAssign() {
          return {
            id: "c1",
            displayName: "Northwind",
            customerNumber: "CUS-1",
            resellerId: "r-other",
          };
        },
      } as never,
      recorder([]),
    );

    await assert.rejects(() => service.assignCustomer(orgId, actorId, "r1", "c1", meta), /already assigned/);
  });

  it("assigns and unassigns a customer with audit events", async () => {
    const audits: AuditEntry[] = [];
    let assigned: string | null = null;
    const service = new ResellersService(
      {
        async findById() {
          return {
            id: "r1",
            status: "ACTIVE",
            displayName: "Partner",
            priceListCode: "STANDARD",
            addresses: [],
            contacts: [],
          };
        },
        async findCustomerForAssign() {
          return {
            id: "c1",
            displayName: "Northwind",
            customerNumber: "CUS-1",
            resellerId: assigned,
          };
        },
        async assignCustomer() {
          assigned = "r1";
          return true;
        },
        async unassignCustomer() {
          assigned = null;
          return true;
        },
      } as never,
      recorder(audits),
    );

    await service.assignCustomer(orgId, actorId, "r1", "c1", meta);
    await service.unassignCustomer(orgId, actorId, "r1", "c1", meta);
    assert.deepEqual(
      audits.map((entry) => entry.action),
      ["resellers.customer.assigned", "resellers.customer.unassigned"],
    );
  });

  it("soft-deletes a reseller", async () => {
    const audits: AuditEntry[] = [];
    let deleted = false;
    const service = new ResellersService(
      {
        async findById() {
          return {
            id: "r1",
            displayName: "Partner",
            resellerNumber: "RSL-1",
            status: "ACTIVE",
            addresses: [],
            contacts: [],
          };
        },
        async softDelete() {
          deleted = true;
          return true;
        },
      } as never,
      recorder(audits),
    );

    await service.remove(orgId, actorId, "r1", meta);
    assert.equal(deleted, true);
    assert.equal(audits[0]?.action, "resellers.deleted");
  });

  it("records pricing changes", async () => {
    const audits: AuditEntry[] = [];
    const service = new ResellersService(
      {
        async currencyIsActive() {
          return true;
        },
        async findById() {
          return {
            id: "r1",
            status: "ACTIVE",
            priceListCode: "STANDARD",
            defaultDiscountPercent: null,
            defaultCommissionPercent: null,
            addresses: [],
            contacts: [],
          };
        },
        async update(_organizationId: string, _id: string, _actorId: string, input: { priceListCode?: string }) {
          return {
            id: "r1",
            status: "ACTIVE",
            priceListCode: input.priceListCode ?? "STANDARD",
            defaultDiscountPercent: "5.0000",
            defaultCommissionPercent: null,
            addresses: [],
            contacts: [],
          };
        },
      } as never,
      recorder(audits),
    );

    await service.update(orgId, actorId, "r1", { priceListCode: "RESELLER", defaultDiscountPercent: "5.0000" }, meta);
    assert.ok(audits.some((entry) => entry.action === "resellers.pricing.changed"));
  });
});

describe("reseller repository", () => {
  it("only assigns customers that are still unassigned", async () => {
    let where: Record<string, unknown> = {};
    const repository = new ResellersRepository({
      customer: {
        async updateMany(args: { where: Record<string, unknown> }) {
          where = args.where;
          return { count: 0 };
        },
      },
    } as never);

    await assert.rejects(
      () => repository.assignCustomer(orgId, "reseller-1", "customer-1", actorId),
      /assigned to another reseller/,
    );
    assert.deepEqual(where, { id: "customer-1", organizationId: orgId, deletedAt: null, resellerId: null });
  });

  it("returns the full country list and only active currencies for forms", async () => {
    const repository = new ResellersRepository({
      currency: {
        async findMany() {
          return [{ code: "PKR", name: "Pakistani Rupee" }];
        },
      },
      reseller: {
        async findMany() {
          return [{ countryCode: "PK", priceListCode: "STANDARD" }];
        },
      },
    } as never);

    const options = await repository.formOptions(orgId);
    assert.deepEqual(options.currencies, [{ code: "PKR", name: "Pakistani Rupee" }]);
    assert.ok(options.countries.includes("PK"));
    assert.ok(options.countries.includes("US"));
    assert.ok(options.countries.length > 100);
    assert.deepEqual(options.priceLists, ["STANDARD"]);
  });

  it("merges partial address updates and clears nullable fields", async () => {
    const current = {
      id: "address-1",
      purpose: "BILLING",
      isPrimary: false,
      label: "Office",
      line1: "12 Main Street",
      line2: "Suite 4",
      city: "Karachi",
      region: "Sindh",
      postalCode: "74000",
      countryCode: "PK",
    };
    let updateArgs: { where: Record<string, unknown>; data: Record<string, unknown> } = { where: {}, data: {} };
    const repository = new ResellersRepository({
      resellerAddress: {
        async findFirst() {
          return current;
        },
      },
      async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
        return fn({
          resellerAddress: {
            async updateMany() {
              return { count: 0 };
            },
            async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
              updateArgs = args;
              return { ...current, ...args.data };
            },
          },
        });
      },
    } as never);

    const updated = await repository.updateAddress(orgId, "reseller-1", "address-1", actorId, {
      city: "Lahore",
      line2: null,
    } as never);
    assert.equal(updated?.city, "Lahore");
    assert.equal(updated?.line1, "12 Main Street");
    assert.equal(updated?.line2, null);
    assert.equal(updated?.postalCode, "74000");
    assert.deepEqual(updateArgs.where, { id: "address-1", resellerId: "reseller-1", organizationId: orgId });
  });
});

describe("reseller permissions", () => {
  it("denies reseller update without resellers:update", () => {
    const middleware = requirePermission("resellers:update");
    const req = {
      auth: {
        userId: actorId,
        email: "admin@itcs.local",
        organizationId: orgId,
        roles: ["viewer"],
        permissions: ["resellers:read"],
      },
    } as Request;
    let forwarded: unknown;
    middleware(req, {} as Response, ((error?: unknown) => {
      forwarded = error;
    }) as NextFunction);
    assert.equal((forwarded as { statusCode?: number }).statusCode, 403);
  });
});

function recorder(audits: AuditEntry[]) {
  return {
    async record(entry: AuditEntry) {
      audits.push(entry);
    },
  };
}

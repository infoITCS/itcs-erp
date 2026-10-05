import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { requirePermission } from "../src/middleware/authorize";
import { buildCustomerListWhere } from "../src/modules/customers/list-filter";
import { CustomersService } from "../src/modules/customers/service";
import { createCustomerSchema, customerListQuerySchema } from "../src/modules/customers/validation";
import type { AuditEntry } from "../src/modules/audit-logs/types";
import { ContactsService } from "../src/modules/contacts/service";

const orgId = "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f";
const actorId = "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11";
const meta = { ipAddress: "127.0.0.1", userAgent: "test" };

const validCustomer = {
  customerType: "COMPANY",
  legalName: "Northwind LLC",
  displayName: "Northwind",
  countryCode: "pk",
  currencyCode: "pkr",
};

describe("customer validation", () => {
  it("rejects a client-supplied customer number", () => {
    const parsed = createCustomerSchema.safeParse({ ...validCustomer, customerNumber: "CUS-2026-00001" });
    assert.equal(parsed.success, false);
  });

  it("uppercases country and currency and rejects an oversized page", () => {
    const created = createCustomerSchema.safeParse(validCustomer);
    assert.equal(created.success, true);
    if (created.success) {
      assert.equal(created.data.countryCode, "PK");
      assert.equal(created.data.currencyCode, "PKR");
    }
    const page = customerListQuerySchema.safeParse({ limit: "101" });
    assert.equal(page.success, false);
  });
});

describe("customer list filters", () => {
  it("always scopes the query to the organization and hides deleted rows", () => {
    const where = buildCustomerListWhere({ organizationId: orgId, q: "north", status: "ACTIVE" });
    assert.equal(where.organizationId, orgId);
    assert.equal(where.deletedAt, null);
    assert.equal(where.status, "ACTIVE");
    assert.ok(Array.isArray(where.OR));
  });

  it("keeps deleted rows only when includeDeleted is set", () => {
    const where = buildCustomerListWhere({ organizationId: orgId, includeDeleted: true, customerType: "INDIVIDUAL" });
    assert.equal(where.deletedAt, undefined);
    assert.equal(where.customerType, "INDIVIDUAL");
  });
});

describe("customer service", () => {
  it("creates a customer, records an audit event, and warns on a duplicate email", async () => {
    const audits: AuditEntry[] = [];
    const service = new CustomersService(
      {
        async currencyIsActive() {
          return true;
        },
        async emailExists() {
          return true;
        },
        async create() {
          return {
            id: "11111111-1111-4111-8111-111111111111",
            customerNumber: "CUS-2026-00001",
            displayName: "Northwind",
            status: "ACTIVE",
            addresses: [],
            contacts: [],
          };
        },
      } as never,
      recorder(audits),
    );

    const result = await service.create(
      orgId,
      actorId,
      { ...validCustomer, email: "billing@northwind.test" } as never,
      meta,
    );
    assert.equal(result.possibleDuplicate, true);
    assert.equal(result.customer.customerNumber, "CUS-2026-00001");
    assert.equal(audits[0]?.action, "customers.created");
    assert.equal(JSON.stringify(audits).includes("CUS-2026-00001"), true);
  });

  it("soft-deletes a customer without removing the row", async () => {
    const audits: AuditEntry[] = [];
    let deleted = false;
    const service = new CustomersService(
      {
        async findById() {
          return { id: "11111111-1111-4111-8111-111111111111", displayName: "Northwind", status: "ACTIVE" };
        },
        async softDelete() {
          deleted = true;
          return true;
        },
      } as never,
      recorder(audits),
    );

    await service.remove(orgId, actorId, "11111111-1111-4111-8111-111111111111", meta);
    assert.equal(deleted, true);
    assert.equal(audits[0]?.action, "customers.deleted");
  });
});

describe("contact primary", () => {
  it("records a primary-contact change when a new primary is created", async () => {
    const audits: AuditEntry[] = [];
    const service = new ContactsService(
      {
        async customerIsActive() {
          return true;
        },
        async findPrimary() {
          return { id: "22222222-2222-4222-8222-222222222222" };
        },
        async create() {
          return {
            id: "33333333-3333-4333-8333-333333333333",
            customerId: "11111111-1111-4111-8111-111111111111",
            displayName: "Ada Lovelace",
            isPrimary: true,
          };
        },
      } as never,
      recorder(audits),
    );

    await service.create(
      orgId,
      actorId,
      "11111111-1111-4111-8111-111111111111",
      { firstName: "Ada", lastName: "Lovelace", isPrimary: true },
      meta,
    );
    assert.deepEqual(
      audits.map((entry) => entry.action),
      ["contacts.created", "contacts.primary.changed"],
    );
  });
});

describe("customer permissions", () => {
  it("denies a customer update without customers:update", () => {
    const middleware = requirePermission("customers:update");
    const req = {
      auth: {
        userId: actorId,
        email: "admin@itcs.local",
        organizationId: orgId,
        roles: ["viewer"],
        permissions: ["customers:read"],
      },
    } as Request;
    let forwarded: unknown;
    const next: NextFunction = (error?: unknown) => {
      forwarded = error;
    };
    middleware(req, {} as Response, next);
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

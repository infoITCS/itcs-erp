import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { requirePermission } from "../src/middleware/authorize";
import { buildCustomerListWhere } from "../src/modules/customers/list-filter";
import { CustomersService } from "../src/modules/customers/service";
import { createCustomerSchema, customerListQuerySchema, updateCustomerSchema } from "../src/modules/customers/validation";
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
    const erpFilters = customerListQuerySchema.safeParse({ status: "HOLD", customerType: "WHOLESALE" });
    assert.equal(erpFilters.success, true);
  });

  it("accepts nested address/contact financial data and defaults tax exemption", () => {
    const parsed = createCustomerSchema.safeParse({
      ...validCustomer,
      customerType: "B2B",
      status: "HOLD",
      creditLimit: "250000.00",
      openingBalance: "-1250.50",
      addresses: [{ purpose: "BILLING", line1: "1 Main Street", city: "Karachi", countryCode: "PK" }],
      contacts: [{ firstName: "Ayesha", lastName: "Siddiqui", role: "BILLING", whatsappOptIn: true }],
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.taxExempt, false);
      assert.equal(parsed.data.contacts?.[0]?.whatsappOptIn, true);
    }
  });

  it("validates entity-specific identity, business fields, tax exemption and preferences", () => {
    const individual = createCustomerSchema.safeParse({
      ...validCustomer,
      entityType: "INDIVIDUAL",
      customerType: "B2C",
      customerCategory: "RETAIL",
      identityDocumentType: "CNIC",
      identityDocumentNumber: "12345-1234567-1",
      preferredPaymentMethod: "BANK_TRANSFER",
      preferredCommunicationChannel: "WHATSAPP",
      emailMarketingOptIn: true,
    });
    assert.equal(individual.success, true);

    const exemptWithoutCode = createCustomerSchema.safeParse({ ...validCustomer, taxExempt: true });
    assert.equal(exemptWithoutCode.success, false);
    const badEmployeeCount = createCustomerSchema.safeParse({ ...validCustomer, employeeCount: -1 });
    assert.equal(badEmployeeCount.success, false);
    const badCnic = createCustomerSchema.safeParse({
      ...validCustomer,
      entityType: "INDIVIDUAL",
      identityDocumentType: "CNIC",
      identityDocumentNumber: "1234",
    });
    assert.equal(badCnic.success, false);
  });

  it("rejects multiple primary nested rows and allows nullable edit fields", () => {
    const duplicatePrimary = createCustomerSchema.safeParse({
      ...validCustomer,
      contacts: [
        { firstName: "Ayesha", lastName: "One", isPrimary: true },
        { firstName: "Bilal", lastName: "Two", isPrimary: true },
      ],
    });
    assert.equal(duplicatePrimary.success, false);
    const cleared = updateCustomerSchema.safeParse({ email: null, taxNumber: null, notes: null, paymentTermId: null });
    assert.equal(cleared.success, true);
  });
});

describe("customer list filters", () => {
  it("always scopes the query to the organization and hides deleted rows", () => {
    const where = buildCustomerListWhere({ organizationId: orgId, q: "north", status: "ACTIVE" });
    assert.equal(where.organizationId, orgId);
    assert.equal(where.deletedAt, null);
    assert.equal(where.status, "ACTIVE");
    assert.ok(Array.isArray(where.OR));
    assert.equal(JSON.stringify(where.OR).includes("taxNumber"), true);
  });

  it("keeps deleted rows only when includeDeleted is set", () => {
    const where = buildCustomerListWhere({ organizationId: orgId, includeDeleted: true, customerType: "INDIVIDUAL" });
    assert.equal(where.deletedAt, undefined);
    assert.equal(where.customerType, "INDIVIDUAL");
  });
});

describe("customer service", () => {
  it("creates an organization payment term and records an audit event", async () => {
    const audits: AuditEntry[] = [];
    const service = new CustomersService(
      {
        async createPaymentTerm(_organizationId: string, input: { name: string; dueDays: number; requiresPrepayment: boolean }) {
          return { id: "11111111-1111-4111-8111-111111111111", code: "CUSTOMER_TEST", ...input };
        },
      } as never,
      recorder(audits),
    );

    const result = await service.createPaymentTerm(orgId, actorId, { name: "Milestone billing", dueDays: 45, requiresPrepayment: true }, meta);
    assert.equal(result.name, "Milestone billing");
    assert.equal(result.dueDays, 45);
    assert.equal(audits[0]?.action, "customers.payment_term.created");
  });

  it("rejects a duplicate email before creating or auditing a customer", async () => {
    const audits: AuditEntry[] = [];
    let created = false;
    const service = new CustomersService(
      {
        async currencyIsActive() {
          return true;
        },
        async emailExists() {
          return true;
        },
        async create() {
          created = true;
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

    await assert.rejects(
      service.create(orgId, actorId, { ...validCustomer, email: "billing@northwind.test" } as never, meta),
      /customer with this email already exists/i,
    );
    assert.equal(created, false);
    assert.equal(audits.length, 0);
  });

  it("creates a customer and records an audit event when the email is unique", async () => {
    const audits: AuditEntry[] = [];
    const service = new CustomersService(
      {
        async currencyIsActive() {
          return true;
        },
        async emailExists() {
          return false;
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
    assert.equal(result.possibleDuplicate, false);
    assert.equal(result.customer.customerNumber, "CUS-2026-00001");
    assert.equal(audits[0]?.action, "customers.created");
    assert.equal(JSON.stringify(audits).includes("CUS-2026-00001"), true);
  });

  it("rejects updating a customer to another customer's email", async () => {
    let updated = false;
    const service = new CustomersService(
      {
        async findById() {
          return { id: "11111111-1111-4111-8111-111111111111", displayName: "Northwind", status: "ACTIVE" };
        },
        async emailExists() {
          return true;
        },
        async update() {
          updated = true;
          return {};
        },
      } as never,
      recorder([]),
    );

    await assert.rejects(
      service.update(
        orgId,
        actorId,
        "11111111-1111-4111-8111-111111111111",
        { email: "billing@northwind.test" } as never,
        meta,
      ),
      /customer with this email already exists/i,
    );
    assert.equal(updated, false);
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

  it("permanently deletes a soft-deleted customer and records an audit event", async () => {
    const audits: AuditEntry[] = [];
    let deleted = false;
    const service = new CustomersService(
      {
        async permanentlyDelete() {
          deleted = true;
          return { id: "11111111-1111-4111-8111-111111111111", customerNumber: "CUS-2026-00001", displayName: "Northwind" };
        },
      } as never,
      recorder(audits),
    );

    const result = await service.permanentlyRemove(orgId, actorId, "11111111-1111-4111-8111-111111111111", meta);
    assert.deepEqual(result, { id: "11111111-1111-4111-8111-111111111111" });
    assert.equal(deleted, true);
    assert.equal(audits[0]?.action, "customers.permanently_deleted");
    assert.equal(audits[0]?.newValues.customerNumber, "CUS-2026-00001");
  });

  it("does not permanently delete an active customer", async () => {
    const service = new CustomersService(
      { async permanentlyDelete() { return null; } } as never,
      recorder([]),
    );

    await assert.rejects(
      service.permanentlyRemove(orgId, actorId, "11111111-1111-4111-8111-111111111111", meta),
      /deleted customer not found/i,
    );
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

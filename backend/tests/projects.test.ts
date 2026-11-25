import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProjectActivity, emptyCustomerActivityRows, type CustomerActivityRows } from "../src/modules/projects/activity";
import { buildProjectListWhere } from "../src/modules/projects/list-filter";
import { decodeProjectCursor, encodeProjectCursor, toProjectPage } from "../src/modules/projects/page";
import {
  createProjectSchema,
  projectListQuerySchema,
  updateProjectSchema,
} from "../src/modules/projects/validation";

const orgId = "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f";
const customerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const contactId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("project validation", () => {
  it("requires a name and accepts optional customer and supplier contacts", () => {
    const parsed = createProjectSchema.safeParse({
      name: "ERP rollout",
      customerId,
      contactId,
      customerContactEmail: "buyer@example.com",
      supplierCompany: "Systems Ltd",
      supplierContactName: "Ali",
      supplierContactEmail: "ali@example.com",
      supplierContactPhone: "+92 300 1234567",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.name, "ERP rollout");
      assert.equal(parsed.data.supplierCompany, "Systems Ltd");
    }
    assert.equal(createProjectSchema.safeParse({}).success, false);
  });

  it("rejects invalid statuses, emails, and empty updates", () => {
    assert.equal(createProjectSchema.safeParse({ name: "Bad status", status: "WON" }).success, false);
    assert.equal(
      createProjectSchema.safeParse({ name: "Bad email", supplierContactEmail: "not-email" }).success,
      false,
    );
    assert.equal(updateProjectSchema.safeParse({}).success, false);
    assert.equal(updateProjectSchema.safeParse({ status: "IN_PROGRESS" }).success, true);
    assert.equal(updateProjectSchema.safeParse({ invoiceId: customerId }).success, true);
  });

  it("validates list filters and uppercases nothing unexpected", () => {
    const parsed = projectListQuerySchema.safeParse({
      status: "IN_PROGRESS",
      customerId,
      includeDeleted: "true",
      sort: "name",
      limit: "10",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.includeDeleted, true);
      assert.equal(parsed.data.sort, "name");
    }
    assert.equal(projectListQuerySchema.safeParse({ limit: "101" }).success, false);
  });
});

describe("project list filters", () => {
  it("scopes rows to the organization and hides deleted rows by default", () => {
    const where = buildProjectListWhere({
      organizationId: orgId,
      q: "rollout",
      status: "IN_PROGRESS",
      customerId,
      ownerUserId: "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11",
    });
    assert.equal(where.organizationId, orgId);
    assert.equal(where.deletedAt, null);
    assert.equal(where.status, "IN_PROGRESS");
    assert.equal(where.customerId, customerId);
    assert.ok(Array.isArray(where.OR));
  });

  it("keeps deleted rows when requested", () => {
    const where = buildProjectListWhere({ organizationId: orgId, includeDeleted: true });
    assert.equal(where.deletedAt, undefined);
  });
});

describe("project paging", () => {
  it("round-trips a cursor and reports the next page", () => {
    const cursor = { sort: "name" as const, value: "ERP rollout", id: "11111111-1111-4111-8111-111111111111" };
    assert.deepEqual(decodeProjectCursor(encodeProjectCursor(cursor)), cursor);

    const page = toProjectPage(
      [
        {
          id: cursor.id,
          createdAt: new Date("2026-11-25T00:00:00.000Z"),
          name: "ERP rollout",
          projectNumber: "PRJ-2026-00001",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          createdAt: new Date("2026-11-24T00:00:00.000Z"),
          name: "Portal",
          projectNumber: "PRJ-2026-00002",
        },
      ],
      1,
      "name",
    );
    assert.equal(page.items.length, 1);
    assert.equal(page.pageInfo.hasNextPage, true);
    assert.ok(page.pageInfo.nextCursor);
  });
});

describe("project customer activity", () => {
  const rows: CustomerActivityRows = {
    customer: {
      id: customerId,
      customerNumber: "CUS-1",
      displayName: "Acme Corp",
      email: "buyer@example.com",
      currencyCode: "PKR",
    },
    leads: [],
    opportunities: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        opportunityNumber: "OPP-1",
        title: "Opportunity ref",
        stage: "WON",
        estimatedValue: "2000.00",
        currencyCode: "PKR",
        expectedCloseDate: new Date("2026-11-18T00:00:00.000Z"),
        createdAt: new Date("2026-11-18T00:00:00.000Z"),
        leadId: null,
      },
    ],
    tenders: [],
    quotes: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        quoteNumber: "QT-1",
        status: "SENT",
        total: "1000.00",
        currencyCode: "PKR",
        issueDate: new Date("2026-11-20T00:00:00.000Z"),
        customerReference: "Quote ref",
        createdAt: new Date("2026-11-20T00:00:00.000Z"),
      },
    ],
    salesOrders: [],
    invoices: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        invoiceNumber: "INV-1",
        status: "PARTIALLY_PAID",
        total: "1000.00",
        amountPaid: "250.00",
        currencyCode: "PKR",
        issueDate: new Date("2026-11-22T00:00:00.000Z"),
        dueDate: new Date("2026-11-30T00:00:00.000Z"),
        customerReference: "Invoice ref",
        sourceSalesOrderId: null,
        createdAt: new Date("2026-11-22T00:00:00.000Z"),
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        invoiceNumber: "INV-2",
        status: "PAID",
        total: "500.00",
        amountPaid: "500.00",
        currencyCode: "PKR",
        issueDate: new Date("2026-11-23T00:00:00.000Z"),
        dueDate: null,
        customerReference: null,
        sourceSalesOrderId: null,
        createdAt: new Date("2026-11-23T00:00:00.000Z"),
      },
    ],
    payments: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        paymentNumber: "PMT-1",
        amount: "250.00",
        currencyCode: "PKR",
        receivedDate: new Date("2026-11-24T00:00:00.000Z"),
        invoiceId: "22222222-2222-4222-8222-222222222222",
        method: "BANK_TRANSFER",
        reference: "Receipt ref",
        createdAt: new Date("2026-11-24T00:00:00.000Z"),
      },
    ],
    contacts: [],
  };

  const links = {
    leadId: null,
    opportunityId: null,
    quoteId: null,
    salesOrderId: null,
    invoiceId: "22222222-2222-4222-8222-222222222222",
    contactId: null,
  };

  it("summarizes invoice status, totals, and outstanding balance", () => {
    const activity = buildProjectActivity(rows, links, { permissions: [], roles: ["admin"] });
    assert.equal(activity.invoiceSummary.count, 2);
    assert.equal(activity.invoiceSummary.partiallyPaid, 1);
    assert.equal(activity.invoiceSummary.paidCount, 1);
    assert.equal(activity.invoiceSummary.open, 1);
    assert.equal(activity.invoiceSummary.total, "1500.00");
    assert.equal(activity.invoiceSummary.paid, "750.00");
    assert.equal(activity.invoiceSummary.balance, "750.00");
    assert.equal(activity.groups.invoice.available, true);
    assert.equal(activity.groups.invoice.items[0].linkedToProject, true);
  });

  it("computes live income, outstanding, and profit from customer documents", () => {
    const activity = buildProjectActivity(rows, links, { permissions: [], roles: ["admin"] });
    assert.equal(activity.financials.source, "live");
    assert.equal(activity.financials.income, "1500.00");
    assert.equal(activity.financials.cost, "0.00");
    assert.equal(activity.financials.profit, "1500.00");
    assert.equal(activity.financials.marginPercent, "100.00");
    assert.equal(activity.financials.breakdown.invoiceTotal, "1500.00");
    assert.equal(activity.financials.breakdown.paymentsReceived, "250.00");
    assert.equal(activity.financials.breakdown.outstanding, "750.00");
    assert.equal(activity.financials.breakdown.quoteTotal, "1000.00");
    assert.equal(activity.financials.breakdown.expenseTotal, "0.00");
  });

  it("excludes void invoices from live income", () => {
    const withVoid = {
      ...rows,
      invoices: [
        ...rows.invoices,
        {
          ...rows.invoices[0],
          id: "66666666-6666-4666-8666-666666666666",
          invoiceNumber: "INV-VOID",
          status: "VOID" as const,
          total: "900.00",
          amountPaid: "0.00",
        },
      ],
    };
    const activity = buildProjectActivity(withVoid, links, { permissions: [], roles: ["admin"] });
    assert.equal(activity.invoiceSummary.count, 3);
    assert.equal(activity.invoiceSummary.void, 1);
    assert.equal(activity.financials.income, "1500.00");
    assert.equal(activity.financials.breakdown.outstanding, "750.00");
  });

  it("sorts the timeline newest first", () => {
    const activity = buildProjectActivity(rows, links, { permissions: [], roles: ["admin"] });
    assert.deepEqual(
      activity.timeline.map((entry) => entry.kind),
      ["payment", "invoice", "invoice", "quote", "opportunity"],
    );
    assert.equal(activity.timeline[0].date, "2026-11-24");
  });

  it("hides modules without read permission", () => {
    const activity = buildProjectActivity(rows, links, { permissions: ["invoices:read"], roles: [] });
    assert.equal(activity.groups.invoice.available, true);
    assert.equal(activity.groups.quote.available, false);
    assert.equal(activity.groups.quote.count, 0);
    assert.equal(activity.groups.payment.available, false);
    assert.deepEqual(
      activity.timeline.map((entry) => entry.kind),
      ["invoice", "invoice"],
    );
  });

  it("handles a project without a customer", () => {
    const activity = buildProjectActivity(emptyCustomerActivityRows(), links, { permissions: [], roles: ["admin"] });
    assert.equal(activity.customer, null);
    assert.equal(activity.timeline.length, 0);
    assert.equal(activity.invoiceSummary.balance, "0.00");
    assert.equal(activity.financials.income, "0.00");
    assert.equal(activity.financials.profit, "0.00");
    assert.equal(activity.financials.marginPercent, "0.00");
  });

  it("does not mark unrelated records as directly linked when project links are empty", () => {
    const emptyLinks = {
      leadId: null,
      opportunityId: null,
      quoteId: null,
      salesOrderId: null,
      invoiceId: null,
      contactId: null,
    };
    const activity = buildProjectActivity(rows, emptyLinks, { permissions: [], roles: ["admin"] });
    assert.equal(activity.groups.invoice.items.every((entry) => !entry.linkedToProject), true);
    assert.equal(activity.groups.opportunity.items.every((entry) => !entry.linkedToProject), true);
  });
});

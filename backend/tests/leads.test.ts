import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuditEntry } from "../src/modules/audit-logs/types";
import { buildLeadListWhere } from "../src/modules/leads/list-filter";
import { decodeLeadCursor, encodeLeadCursor, toLeadPage } from "../src/modules/leads/page";
import { LeadsService } from "../src/modules/leads/service";
import { assertLeadTransition, canTransitionLead, isConverted } from "../src/modules/leads/status";
import {
  changeLeadStatusSchema,
  convertLeadSchema,
  createLeadSchema,
  leadListQuerySchema,
  updateLeadSchema,
} from "../src/modules/leads/validation";

const orgId = "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f";
const actorId = "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11";
const leadId = "11111111-1111-4111-8111-111111111111";
const customerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const contactId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const opportunityId = "22222222-2222-4222-8222-222222222222";
const meta = { ipAddress: "127.0.0.1", userAgent: "test" };

const validLead = {
  firstName: "Ayesha",
  lastName: "Khan",
  countryCode: "pk",
  currencyCode: "pkr",
  source: "WEBSITE",
};

function recorder(audits: AuditEntry[]) {
  return {
    async record(entry: AuditEntry) {
      audits.push(entry);
    },
  };
}

function leadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: leadId,
    organizationId: orgId,
    leadNumber: "LEAD-2026-00001",
    firstName: "Ayesha",
    lastName: "Khan",
    displayName: "Ayesha Khan",
    companyName: "Northwind",
    jobTitle: "CTO",
    email: "ayesha@example.com",
    phone: "+923001234567",
    website: null,
    countryCode: "PK",
    currencyCode: "PKR",
    source: "WEBSITE",
    status: "QUALIFIED",
    priority: "NORMAL",
    estimatedValue: "1000",
    ownerUserId: actorId,
    nextAction: null,
    nextActionDueAt: null,
    description: null,
    notes: null,
    qualifiedAt: new Date(),
    unqualifiedAt: null,
    unqualifiedReason: null,
    convertedAt: null,
    wonAt: null,
    convertedCustomerId: null,
    convertedContactId: null,
    createdById: actorId,
    updatedById: actorId,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    owner: null,
    convertedCustomer: null,
    convertedContact: null,
    opportunity: null,
    ...overrides,
  };
}

describe("lead validation", () => {
  it("requires a name, country, currency and source", () => {
    assert.equal(createLeadSchema.safeParse(validLead).success, true);
    assert.equal(createLeadSchema.safeParse({ ...validLead, source: undefined }).success, false);
    assert.equal(createLeadSchema.safeParse({ ...validLead, firstName: "" }).success, false);
  });

  it("uppercases country and currency codes", () => {
    const parsed = createLeadSchema.safeParse(validLead);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.countryCode, "PK");
      assert.equal(parsed.data.currencyCode, "PKR");
    }
  });

  it("does not allow clearing the display name on update", () => {
    assert.equal(updateLeadSchema.safeParse({ displayName: null }).success, false);
    assert.equal(updateLeadSchema.safeParse({ displayName: "New name" }).success, true);
  });

  it("allows only manual statuses on the status endpoint", () => {
    assert.equal(changeLeadStatusSchema.safeParse({ status: "QUALIFIED" }).success, true);
    assert.equal(changeLeadStatusSchema.safeParse({ status: "CONVERTED" }).success, false);
    assert.equal(changeLeadStatusSchema.safeParse({ status: "WON" }).success, false);
  });

  it("requires the correct payload for each conversion mode", () => {
    const opportunity = { title: "Follow-up deal" };
    assert.equal(
      convertLeadSchema.safeParse({
        mode: "ACCOUNT",
        customer: { legalName: "Northwind", customerType: "COMPANY", entityType: "COMPANY", email: null, phone: null, website: null },
        opportunity,
      }).success,
      true,
    );
    assert.equal(
      convertLeadSchema.safeParse({
        mode: "ACCOUNT",
        customer: { customerType: "COMPANY" },
        opportunity,
      }).success,
      false,
    );
    assert.equal(
      convertLeadSchema.safeParse({
        mode: "PROSPECT",
        opportunity: { ...opportunity, prospectDisplayName: "Northwind" },
      }).success,
      true,
    );
    assert.equal(convertLeadSchema.safeParse({ mode: "PROSPECT", opportunity }).success, false);
  });

  it("rejects an oversized lead page", () => {
    assert.equal(leadListQuerySchema.safeParse({ limit: "101" }).success, false);
    assert.equal(leadListQuerySchema.safeParse({ limit: "50", status: "WON" }).success, true);
  });
});

describe("lead status transitions", () => {
  it("moves a new lead to contacted, qualified or unqualified", () => {
    assert.equal(canTransitionLead("NEW", "CONTACTED"), true);
    assert.equal(canTransitionLead("NEW", "QUALIFIED"), true);
    assert.equal(canTransitionLead("NEW", "UNQUALIFIED"), true);
    assert.equal(canTransitionLead("NEW", "CONVERTED"), false);
  });

  it("keeps converted and won leads terminal for manual changes", () => {
    assert.equal(canTransitionLead("CONVERTED", "QUALIFIED"), false);
    assert.equal(canTransitionLead("WON", "CONTACTED"), false);
    assert.equal(isConverted("CONVERTED"), true);
    assert.equal(isConverted("WON"), true);
    assert.equal(isConverted("QUALIFIED"), false);
  });

  it("throws for an invalid transition", () => {
    assert.throws(() => assertLeadTransition("NEW", "WON"));
    assert.doesNotThrow(() => assertLeadTransition("CONTACTED", "QUALIFIED"));
  });
});

describe("lead pagination", () => {
  it("round-trips the cursor", () => {
    const cursor = encodeLeadCursor({ sort: "createdAt", value: "2026-01-01T00:00:00.000Z", id: leadId });
    assert.deepEqual(decodeLeadCursor(cursor), {
      sort: "createdAt",
      value: "2026-01-01T00:00:00.000Z",
      id: leadId,
    });
    assert.equal(decodeLeadCursor("not-a-cursor"), null);
  });

  it("only exposes the next cursor when there is another page", () => {
    const rows = [
      { id: "a", createdAt: new Date("2026-01-03T00:00:00Z"), displayName: "A", leadNumber: "L-3", estimatedValue: "3" },
      { id: "b", createdAt: new Date("2026-01-02T00:00:00Z"), displayName: "B", leadNumber: "L-2", estimatedValue: "2" },
      { id: "c", createdAt: new Date("2026-01-01T00:00:00Z"), displayName: "C", leadNumber: "L-1", estimatedValue: "1" },
    ];
    const page = toLeadPage(rows, 2, "createdAt");
    assert.equal(page.items.length, 2);
    assert.equal(page.pageInfo.hasNextPage, true);
    assert.equal(decodeLeadCursor(page.pageInfo.nextCursor ?? "")?.id, "b");
    assert.equal(toLeadPage(rows.slice(0, 2), 2, "createdAt").pageInfo.nextCursor, null);
  });
});

describe("lead list filters", () => {
  it("scopes to the organization and hides deleted leads by default", () => {
    const where = buildLeadListWhere({ organizationId: orgId, q: "northwind" });
    assert.equal(where.organizationId, orgId);
    assert.equal(where.deletedAt, null);
    assert.ok(Array.isArray(where.OR));
  });

  it("keeps deleted leads only when asked and applies field filters", () => {
    const where = buildLeadListWhere({
      organizationId: orgId,
      includeDeleted: true,
      status: "QUALIFIED",
      source: "REFERRAL",
    });
    assert.equal(where.deletedAt, undefined);
    assert.equal(where.status, "QUALIFIED");
    assert.equal(where.source, "REFERRAL");
  });
});

describe("lead analytics", () => {
  it("computes conversion and win rates from lead and opportunity groupings", async () => {
    const service = new LeadsService(
      {
        async findOrganization() {
          return { baseCurrencyCode: "PKR" };
        },
        async statusCounts() {
          return [
            { status: "QUALIFIED", _count: { _all: 1 }, _sum: { estimatedValue: "500" } },
            { status: "CONVERTED", _count: { _all: 2 }, _sum: { estimatedValue: "2000" } },
            { status: "UNQUALIFIED", _count: { _all: 1 }, _sum: { estimatedValue: "100" } },
          ];
        },
        async sourceStatusCounts() {
          return [
            { source: "WEBSITE", status: "QUALIFIED", _count: { _all: 1 }, _sum: { estimatedValue: "500" } },
            { source: "WEBSITE", status: "CONVERTED", _count: { _all: 2 }, _sum: { estimatedValue: "2000" } },
            { source: "REFERRAL", status: "UNQUALIFIED", _count: { _all: 1 }, _sum: { estimatedValue: "100" } },
          ];
        },
        async opportunitySourceStageCounts() {
          return [
            { leadSource: "WEBSITE", stage: "PROPOSAL", _count: { _all: 1 }, _sum: { estimatedValueBase: "1200" } },
            { leadSource: "WEBSITE", stage: "WON", _count: { _all: 1 }, _sum: { estimatedValueBase: "800" } },
            { leadSource: "REFERRAL", stage: "LOST", _count: { _all: 1 }, _sum: { estimatedValueBase: "0" } },
          ];
        },
      } as never,
      {} as never,
      {} as never,
      recorder([]),
    );

    const report = await service.analytics(orgId, "all");
    assert.equal(report.baseCurrencyCode, "PKR");
    assert.equal(report.totals.leads, 4);
    assert.equal(report.totals.convertedOrWon, 2);
    assert.equal(report.totals.conversionRate, 50);
    assert.equal(report.totals.winRate, 50);
    assert.equal(report.totals.pipelineValueBase, 1200);
    assert.equal(report.totals.wonValueBase, 800);
    const website = report.bySource.find((row) => row.source === "WEBSITE");
    assert.equal(website?.leads, 3);
    assert.equal(website?.conversionRate, 66.7);
    assert.equal(website?.winRate, 100);
  });
});

describe("lead conversion", () => {
  it("rejects converting a lead that is not qualified", async () => {
    const service = new LeadsService(
      {
        async findById() {
          return leadRow({ status: "NEW" });
        },
      } as never,
      {} as never,
      {} as never,
      recorder([]),
    );

    await assert.rejects(() =>
      service.convert(
        orgId,
        actorId,
        leadId,
        { mode: "PROSPECT", opportunity: { title: "Deal", prospectDisplayName: "Northwind" } } as never,
        meta,
      ),
    );
  });

  it("creates the customer, contact, and opportunity then marks the lead converted", async () => {
    const audits: AuditEntry[] = [];
    let convertedLeadId: string | undefined;
    let opportunityInput: { customerId?: string; contactId?: string; leadId?: string } | undefined;

    const service = new LeadsService(
      {
        async findById() {
          return leadRow();
        },
        async currencyIsActive() {
          return true;
        },
        async findActiveOrgUser() {
          return { id: actorId };
        },
        async findOrganization() {
          return { baseCurrencyCode: "PKR" };
        },
        async findExchangeRateValue() {
          return null;
        },
        async convert(
          _organizationId: string,
          id: string,
          _actorId: string,
          input: {
            createCustomer?: (tx: never) => Promise<{ id: string; contacts?: Array<{ id: string; isPrimary: boolean }> }>;
            createOpportunity: (tx: never, link: { customerId?: string; contactId?: string }) => Promise<string>;
          },
        ) {
          convertedLeadId = id;
          const customer = await input.createCustomer?.({} as never);
          const contact = customer?.contacts?.[0]?.id;
          const opportunity = await input.createOpportunity({} as never, {
            customerId: customer?.id,
            contactId: contact,
          });
          return { customerId: customer?.id ?? null, contactId: contact ?? null, opportunityId: opportunity };
        },
      } as never,
      {
        async createIn(
          _tx: never,
          _organizationId: string,
          _actorId: string,
          input: { customerId?: string; contactId?: string; leadId?: string },
        ) {
          opportunityInput = input;
          return opportunityId;
        },
        async findById() {
          return { id: opportunityId, opportunityNumber: "OPP-2026-00001" };
        },
      } as never,
      {
        async validateCreate() {
          return undefined;
        },
        async createWithin() {
          return { id: customerId, contacts: [{ id: contactId, isPrimary: true }] };
        },
      } as never,
      recorder(audits),
    );

    const result = await service.convert(
      orgId,
      actorId,
      leadId,
      {
        mode: "ACCOUNT",
        customer: {
          legalName: "Northwind",
          customerType: "COMPANY",
          entityType: "COMPANY",
          email: null,
          phone: null,
          website: null,
        },
        opportunity: { title: "Northwind firewall" },
      } as never,
      meta,
    );

    assert.equal(convertedLeadId, leadId);
    assert.equal(result.id, leadId);
    assert.equal(opportunityInput?.leadId, leadId);
    assert.equal(opportunityInput?.customerId, customerId);
    assert.equal(opportunityInput?.contactId, contactId);
    assert.deepEqual(
      audits.map((entry) => entry.action),
      ["leads.converted", "customers.created", "opportunities.created"],
    );
  });
});

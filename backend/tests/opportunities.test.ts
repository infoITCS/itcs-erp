import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { requirePermission } from "../src/middleware/authorize";
import type { AuditEntry } from "../src/modules/audit-logs/types";
import { computeCurrencySnapshot } from "../src/modules/opportunities/currency-snapshot";
import { buildOpportunityListWhere } from "../src/modules/opportunities/list-filter";
import { OpportunitiesService } from "../src/modules/opportunities/service";
import { assertCanChangeStage, isOpenStage, isTerminalStage, resolveProbability } from "../src/modules/opportunities/stages";
import {
  changeStageSchema,
  convertOpportunitySchema,
  createOpportunitySchema,
  opportunityListQuerySchema,
} from "../src/modules/opportunities/validation";

const orgId = "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f";
const actorId = "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11";
const customerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const opportunityId = "11111111-1111-4111-8111-111111111111";
const meta = { ipAddress: "127.0.0.1", userAgent: "test" };

const validOpportunity = {
  title: "Firewall refresh",
  currencyCode: "PKR",
  prospectDisplayName: "Prospective Co",
};

function recorder(audits: AuditEntry[]) {
  return {
    async record(entry: AuditEntry) {
      audits.push(entry);
    },
  };
}

describe("opportunity validation", () => {
  it("requires a prospect display name when no customer is linked", () => {
    const parsed = createOpportunitySchema.safeParse({ title: "Deal", currencyCode: "pkr" });
    assert.equal(parsed.success, false);
  });

  it("accepts a customer-linked opportunity without prospect fields and uppercases currency", () => {
    const parsed = createOpportunitySchema.safeParse({
      title: "Deal",
      currencyCode: "pkr",
      customerId,
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.currencyCode, "PKR");
    }
  });

  it("rejects an oversized opportunity page", () => {
    assert.equal(opportunityListQuerySchema.safeParse({ limit: "101" }).success, false);
  });

  it("rejects WON/LOST on the generic stage-change endpoint", () => {
    assert.equal(changeStageSchema.safeParse({ stage: "WON" }).success, false);
    assert.equal(changeStageSchema.safeParse({ stage: "QUALIFICATION" }).success, true);
  });

  it("requires exactly a customerId for LINK and a customer payload for CREATE", () => {
    assert.equal(convertOpportunitySchema.safeParse({ mode: "LINK", customerId }).success, true);
    assert.equal(convertOpportunitySchema.safeParse({ mode: "LINK" }).success, false);
    assert.equal(
      convertOpportunitySchema.safeParse({
        mode: "CREATE",
        customer: { customerType: "COMPANY", legalName: "New Co", displayName: "New Co", countryCode: "pk", currencyCode: "pkr" },
      }).success,
      true,
    );
  });
});

describe("opportunity stages", () => {
  it("classifies open and terminal stages", () => {
    assert.equal(isOpenStage("NEW"), true);
    assert.equal(isOpenStage("WON"), false);
    assert.equal(isTerminalStage("LOST"), true);
    assert.equal(isTerminalStage("PROPOSAL"), false);
  });

  it("blocks stage changes once an opportunity is won or lost", () => {
    assert.throws(() => assertCanChangeStage("WON"));
    assert.throws(() => assertCanChangeStage("LOST"));
    assert.doesNotThrow(() => assertCanChangeStage("NEGOTIATION"));
  });

  it("preserves probability unless a stage default is requested", () => {
    assert.equal(resolveProbability(55, "PROPOSAL", undefined, undefined), 55);
    assert.equal(resolveProbability(55, "PROPOSAL", 70, undefined), 70);
    assert.equal(resolveProbability(55, "PROPOSAL", undefined, true), 60);
    assert.equal(resolveProbability(55, "PROPOSAL", 70, true), 60);
  });
});

describe("opportunity currency snapshot", () => {
  it("uses rate 1 for the same currency", async () => {
    const snapshot = await computeCurrencySnapshot("1000", "PKR", "PKR", async () => null);
    assert.equal(snapshot.exchangeRateToBase, "1.00000000");
    assert.equal(snapshot.estimatedValueBase, "1000.0000");
  });

  it("multiplies by the direct rate (base=from, quote=orgBase)", async () => {
    const snapshot = await computeCurrencySnapshot("100", "USD", "PKR", async (base, quote) =>
      base === "USD" && quote === "PKR" ? "280" : null,
    );
    assert.equal(snapshot.exchangeRateToBase, "280.00000000");
    assert.equal(snapshot.estimatedValueBase, "28000.0000");
  });

  it("divides by the inverse rate (base=orgBase, quote=from)", async () => {
    const snapshot = await computeCurrencySnapshot("28000", "USD", "PKR", async (base, quote) =>
      base === "PKR" && quote === "USD" ? "0.00357143" : null,
    );
    assert.equal(snapshot.estimatedValueBase, "7839996.8640");
  });

  it("rejects a currency pair with no configured rate", async () => {
    await assert.rejects(() => computeCurrencySnapshot("100", "EUR", "PKR", async () => null));
  });
});

describe("opportunity list filters", () => {
  it("always scopes the query to the organization and hides deleted rows", () => {
    const where = buildOpportunityListWhere({ organizationId: orgId, q: "firewall", stage: "NEW" });
    assert.equal(where.organizationId, orgId);
    assert.equal(where.deletedAt, null);
    assert.equal(where.stage, "NEW");
    assert.ok(Array.isArray(where.OR));
  });

  it("keeps deleted rows only when includeDeleted is set", () => {
    const where = buildOpportunityListWhere({ organizationId: orgId, includeDeleted: true, customerId });
    assert.equal(where.deletedAt, undefined);
    assert.equal(where.customerId, customerId);
  });
});

describe("opportunity service", () => {
  it("creates an opportunity, computes the currency snapshot, and records audit", async () => {
    const audits: AuditEntry[] = [];
    const service = new OpportunitiesService(
      {
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
        async create(_organizationId: string, _actorId: string, input: { estimatedValueBase: string }) {
          return {
            id: opportunityId,
            opportunityNumber: "OPP-2026-00001",
            title: "Firewall refresh",
            stage: "NEW",
            currencyCode: "PKR",
            estimatedValue: "1000",
            estimatedValueBase: input.estimatedValueBase,
          };
        },
      } as never,
      {} as never,
      recorder(audits),
    );

    const opportunity = await service.create(orgId, actorId, validOpportunity as never, meta);
    assert.equal(opportunity.opportunityNumber, "OPP-2026-00001");
    assert.equal(audits[0]?.action, "opportunities.created");
  });

  it("requires an active, linked customer before marking an opportunity won", async () => {
    const service = new OpportunitiesService(
      {
        async findById() {
          return {
            id: opportunityId,
            stage: "NEGOTIATION",
            probabilityPercent: 80,
            customerId: null,
            customer: null,
          };
        },
      } as never,
      {} as never,
      recorder([]),
    );

    try {
      await service.markWon(orgId, actorId, opportunityId, {}, meta);
      assert.fail("expected a validation error");
    } catch (error) {
      const errors = (error as { errors?: Record<string, string[]> }).errors;
      assert.ok(errors?.customerId?.[0]?.includes("Link this opportunity to a customer"));
    }
  });

  it("rejects marking an opportunity won when the linked customer is not active", async () => {
    const service = new OpportunitiesService(
      {
        async findById() {
          return {
            id: opportunityId,
            stage: "NEGOTIATION",
            probabilityPercent: 80,
            customerId,
            customer: { id: customerId, status: "HOLD" },
          };
        },
      } as never,
      {} as never,
      recorder([]),
    );

    try {
      await service.markWon(orgId, actorId, opportunityId, {}, meta);
      assert.fail("expected a validation error");
    } catch (error) {
      const errors = (error as { errors?: Record<string, string[]> }).errors;
      assert.ok(errors?.customerId?.[0]?.includes("must be active"));
    }
  });

  it("keeps the entered probability when marking won unless the stage default is requested", async () => {
    const audits: AuditEntry[] = [];
    const marked: number[] = [];
    const service = new OpportunitiesService(
      {
        async findById() {
          return {
            id: opportunityId,
            stage: "NEGOTIATION",
            probabilityPercent: 80,
            customerId,
            customer: { id: customerId, status: "ACTIVE" },
          };
        },
        async markWon(_organizationId: string, _id: string, _actorId: string, probabilityPercent: number) {
          marked.push(probabilityPercent);
          return { id: opportunityId, stage: "WON", probabilityPercent };
        },
      } as never,
      {} as never,
      recorder(audits),
    );

    const kept = await service.markWon(orgId, actorId, opportunityId, {}, meta);
    const overridden = await service.markWon(
      orgId,
      actorId,
      opportunityId,
      { applyStageDefault: true } as never,
      meta,
    );
    assert.equal(marked[0], 80);
    assert.equal(marked[1], 100);
    assert.equal((kept as { stage: string }).stage, "WON");
    assert.equal((overridden as { probabilityPercent: number }).probabilityPercent, 100);
    assert.equal(audits[0]?.action, "opportunities.won");
  });

  it("requires a lost reason and keeps the entered probability unless the stage default is requested", async () => {
    const audits: AuditEntry[] = [];
    let lostData: { probabilityPercent: number; lostReason: string } | undefined;
    const service = new OpportunitiesService(
      {
        async findById() {
          return { id: opportunityId, stage: "PROPOSAL", probabilityPercent: 60, customerId: null, customer: null };
        },
        async markLost(_organizationId: string, _id: string, _actorId: string, data: { probabilityPercent: number; lostReason: string }) {
          lostData = data;
          return { id: opportunityId, stage: "LOST", probabilityPercent: data.probabilityPercent };
        },
      } as never,
      {} as never,
      recorder(audits),
    );

    await service.markLost(orgId, actorId, opportunityId, { lostReason: "PRICE" } as never, meta);
    assert.equal(lostData?.probabilityPercent, 60);
    assert.equal(lostData?.lostReason, "PRICE");
    await service.markLost(
      orgId,
      actorId,
      opportunityId,
      { lostReason: "PRICE", applyStageDefault: true } as never,
      meta,
    );
    assert.equal(lostData?.probabilityPercent, 0);
    assert.equal(audits[0]?.action, "opportunities.lost");
  });

  it("rejects changing stage on a won or lost opportunity until it is reopened", async () => {
    const service = new OpportunitiesService(
      {
        async findById() {
          return { id: opportunityId, stage: "WON", probabilityPercent: 100, customerId, customer: { status: "ACTIVE" } };
        },
      } as never,
      {} as never,
      recorder([]),
    );

    await assert.rejects(() =>
      service.changeStage(orgId, actorId, opportunityId, { stage: "PROPOSAL" } as never, meta),
    );
  });

  it("reopens a lost opportunity, clearing lost fields and recording audit", async () => {
    const audits: AuditEntry[] = [];
    let reopenArgs: unknown[] = [];
    const service = new OpportunitiesService(
      {
        async findById() {
          return { id: opportunityId, stage: "LOST", probabilityPercent: 0, customerId: null, customer: null };
        },
        async reopen(...args: unknown[]) {
          reopenArgs = args;
          return { id: opportunityId, stage: "NEW", probabilityPercent: 10 };
        },
      } as never,
      {} as never,
      recorder(audits),
    );

    await service.reopen(orgId, actorId, opportunityId, {} as never, meta);
    // Prospect (no customer) reopens into QUALIFICATION and keeps the current probability.
    assert.deepEqual(reopenArgs.slice(3), ["QUALIFICATION", 0]);
    await service.reopen(orgId, actorId, opportunityId, { applyStageDefault: true } as never, meta);
    assert.deepEqual(reopenArgs.slice(3), ["QUALIFICATION", 20]);
    assert.equal(audits[0]?.action, "opportunities.reopened");
  });

  it("rejects reopening an opportunity that is still open", async () => {
    const service = new OpportunitiesService(
      {
        async findById() {
          return { id: opportunityId, stage: "PROPOSAL", probabilityPercent: 60, customerId: null, customer: null };
        },
      } as never,
      {} as never,
      recorder([]),
    );

    await assert.rejects(() => service.reopen(orgId, actorId, opportunityId, {} as never, meta));
  });

  it("links an existing customer when converting in LINK mode", async () => {
    const audits: AuditEntry[] = [];
    const service = new OpportunitiesService(
      {
        async findById() {
          return { id: opportunityId, customerId: null };
        },
        async findCustomerForLink() {
          return { id: customerId, status: "ACTIVE", displayName: "Northwind" };
        },
        async linkExistingCustomer() {
          return { id: opportunityId, customerId };
        },
      } as never,
      {} as never,
      recorder(audits),
    );

    await service.convert(orgId, actorId, opportunityId, { mode: "LINK", customerId } as never, meta);
    assert.equal(audits[0]?.action, "opportunities.converted");
  });

  it("rejects converting with a new customer when the email already exists, requiring a link instead", async () => {
    const service = new OpportunitiesService(
      {
        async findById() {
          return { id: opportunityId, customerId: null, prospectEmail: "known@example.com" };
        },
      } as never,
      {
        async validateCreate() {
          return undefined;
        },
        async emailTaken(_organizationId: string, email: string) {
          return email === "dup@example.com" || email === "known@example.com";
        },
      } as never,
      recorder([]),
    );

    await assert.rejects(
      () =>
        service.convert(
          orgId,
          actorId,
          opportunityId,
          {
            mode: "CREATE",
            customer: {
              customerType: "COMPANY",
              legalName: "Dup Co",
              displayName: "Dup Co",
              email: "dup@example.com",
              countryCode: "PK",
              currencyCode: "PKR",
            },
          } as never,
          meta,
        ),
      /convert using mode LINK/,
    );
  });

  it("requires LINK when the prospect email matches a customer even if the new payload omits email", async () => {
    const service = new OpportunitiesService(
      {
        async findById() {
          return { id: opportunityId, customerId: null, prospectEmail: "known@example.com" };
        },
      } as never,
      {
        async validateCreate() {
          return undefined;
        },
        async emailTaken(_organizationId: string, email: string) {
          return email === "known@example.com";
        },
      } as never,
      recorder([]),
    );

    await assert.rejects(
      () =>
        service.convert(
          orgId,
          actorId,
          opportunityId,
          {
            mode: "CREATE",
            customer: {
              customerType: "COMPANY",
              legalName: "Dup Co",
              displayName: "Dup Co",
              countryCode: "PK",
              currencyCode: "PKR",
            },
          } as never,
          meta,
        ),
      /convert using mode LINK/,
    );
  });

  it("rejects a contact on an opportunity that has no customer", async () => {
    const service = new OpportunitiesService(
      {
        async currencyIsActive() {
          return true;
        },
        async findActiveOrgUser() {
          return { id: actorId };
        },
      } as never,
      {} as never,
      recorder([]),
    );

    try {
      await service.create(
        orgId,
        actorId,
        { ...validOpportunity, contactId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" } as never,
        meta,
      );
      assert.fail("expected a validation error");
    } catch (error) {
      const errors = (error as { errors?: Record<string, string[]> }).errors;
      assert.ok(errors?.contactId?.[0]?.includes("Link a customer"));
    }
  });

  it("rejects converting an opportunity that is already linked to a customer", async () => {
    const service = new OpportunitiesService(
      {
        async findById() {
          return { id: opportunityId, customerId };
        },
      } as never,
      {} as never,
      recorder([]),
    );

    await assert.rejects(() => service.convert(orgId, actorId, opportunityId, { mode: "LINK", customerId } as never, meta));
  });

  it("soft-deletes an opportunity without removing the row", async () => {
    const audits: AuditEntry[] = [];
    let deleted = false;
    const service = new OpportunitiesService(
      {
        async findById() {
          return { id: opportunityId, opportunityNumber: "OPP-1", title: "Deal" };
        },
        async softDelete() {
          deleted = true;
          return true;
        },
      } as never,
      {} as never,
      recorder(audits),
    );

    await service.remove(orgId, actorId, opportunityId, meta);
    assert.equal(deleted, true);
    assert.equal(audits[0]?.action, "opportunities.deleted");
  });
});

describe("opportunities permissions", () => {
  it("allows opportunities:read and blocks opportunities:update", () => {
    const allow = requirePermission("opportunities:read");
    const deny = requirePermission("opportunities:update");
    const req = { auth: { permissions: ["opportunities:read"] } } as Request;
    let allowed = false;
    let denied: unknown;
    allow(req, {} as Response, (() => {
      allowed = true;
    }) as NextFunction);
    deny(req, {} as Response, ((error?: unknown) => {
      denied = error;
    }) as NextFunction);
    assert.equal(allowed, true);
    assert.equal((denied as { statusCode?: number }).statusCode, 403);
  });
});

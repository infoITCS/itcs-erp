import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ValidationFailedError } from "../src/common/errors/app-error";
import type { AuditEntry } from "../src/modules/audit-logs/types";
import type { OrganizationsRepository } from "../src/modules/organizations/repository";
import { OrganizationsService } from "../src/modules/organizations/service";
import { updateOrganizationSchema } from "../src/modules/organizations/validation";

const orgId = "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f";
const actorId = "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11";
const meta = { ipAddress: "127.0.0.1", userAgent: "test" };

function organization(overrides: Record<string, unknown> = {}) {
  return {
    id: orgId,
    code: "ITCS",
    name: "ITCS",
    status: "ACTIVE",
    baseCurrencyCode: "PKR",
    ...overrides,
  };
}

function fakeRepository(overrides: Record<string, unknown> = {}): OrganizationsRepository {
  return {
    listForUser: async () => [],
    findForUser: async () => organization(),
    currencyExists: async () => true,
    update: async (_organizationId: string, input: Record<string, unknown>) => ({
      ...organization(),
      ...input,
    }),
    archive: async () => undefined,
    ...overrides,
  } as unknown as OrganizationsRepository;
}

function recorder(entries: AuditEntry[]): { record: (entry: AuditEntry) => Promise<void> } {
  return {
    async record(entry) {
      entries.push(entry);
    },
  };
}

describe("organization validation", () => {
  it("accepts a partial update and normalizes the currency code", () => {
    const parsed = updateOrganizationSchema.safeParse({
      name: "  ITCS Pakistan  ",
      baseCurrencyCode: "usd",
    });

    assert.equal(parsed.success, true);
    assert.deepEqual(parsed.data, { name: "ITCS Pakistan", baseCurrencyCode: "USD" });
  });

  it("rejects empty updates and invalid currency codes", () => {
    assert.equal(updateOrganizationSchema.safeParse({}).success, false);
    assert.equal(updateOrganizationSchema.safeParse({ baseCurrencyCode: "US" }).success, false);
    assert.equal(updateOrganizationSchema.safeParse({ name: "   " }).success, false);
  });
});

describe("organization service", () => {
  it("updates the organization and records the before and after values", async () => {
    const audits: AuditEntry[] = [];
    const service = new OrganizationsService(fakeRepository(), recorder(audits));

    const updated = await service.update(
      orgId,
      actorId,
      { name: "ITCS Pakistan", baseCurrencyCode: "USD" },
      meta,
    );

    assert.equal(updated.name, "ITCS Pakistan");
    assert.equal(updated.baseCurrencyCode, "USD");
    assert.equal(audits[0]?.action, "organizations.updated");
    assert.deepEqual(audits[0]?.oldValues, {
      name: "ITCS",
      baseCurrencyCode: "PKR",
    });
    assert.deepEqual(audits[0]?.newValues, {
      name: "ITCS Pakistan",
      baseCurrencyCode: "USD",
    });
  });

  it("rejects an unknown base currency", async () => {
    const audits: AuditEntry[] = [];
    const service = new OrganizationsService(
      fakeRepository({ currencyExists: async () => false }),
      recorder(audits),
    );

    await assert.rejects(
      () => service.update(orgId, actorId, { baseCurrencyCode: "USD" }, meta),
      (error: unknown) =>
        error instanceof ValidationFailedError &&
        JSON.stringify(error.errors).includes("Choose an active currency"),
    );
    assert.equal(audits.length, 0);
  });

  it("archives the organization and records the deletion event", async () => {
    const audits: AuditEntry[] = [];
    let archivedId = "";
    const service = new OrganizationsService(
      fakeRepository({
        archive: async (id: string) => {
          archivedId = id;
        },
      }),
      recorder(audits),
    );

    await service.archive(orgId, actorId, meta);

    assert.equal(archivedId, orgId);
    assert.equal(audits[0]?.action, "organizations.deleted");
    assert.equal(audits[0]?.entityId, orgId);
    assert.equal(
      (audits[0]?.newValues as { archived?: boolean } | undefined)?.archived,
      true,
    );
  });
});

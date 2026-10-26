import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccountStatus } from "@prisma/client";
import { ValidationFailedError } from "../src/common/errors/app-error";
import type { AuditEntry } from "../src/modules/audit-logs/types";
import type { UsersRepository } from "../src/modules/users/repository";
import { UsersService } from "../src/modules/users/service";
import {
  createUserSchema,
  resetUserPasswordSchema,
  updateUserSchema,
} from "../src/modules/users/validation";

const orgId = "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f";
const actorId = "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11";
const targetId = "a8a4f9b6-1c2d-4e3f-8a9b-0c1d2e3f4a5b";
const meta = { ipAddress: "127.0.0.1", userAgent: "test" };

function listedUser(overrides: Record<string, unknown> = {}) {
  return {
    id: targetId,
    email: "user@itcs.local",
    firstName: "Target",
    lastName: "User",
    status: AccountStatus.ACTIVE,
    lastLoginAt: null,
    lockedAt: null,
    failedLoginCount: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    userRoles: [{ role: { code: "viewer", name: "Viewer" } }],
    ...overrides,
  };
}

function fakeRepository(overrides: Record<string, unknown> = {}): UsersRepository {
  return {
    list: async () => [],
    stats: async () => ({ total: 0, active: 0, inactive: 0, locked: 0, roles: 0 }),
    findInOrganization: async () => listedUser(),
    emailExists: async () => false,
    roleIdsByCode: async (_organizationId: string, codes: string[]) => codes.map((code) => `role-${code}`),
    create: async () => listedUser(),
    update: async () => undefined,
    deactivate: async () => undefined,
    setPassword: async () => undefined,
    countActiveAdmins: async () => 2,
    ...overrides,
  } as unknown as UsersRepository;
}

function recorder(entries: AuditEntry[]): { record: (entry: AuditEntry) => Promise<void> } {
  return {
    async record(entry) {
      entries.push(entry);
    },
  };
}

describe("user validation", () => {
  it("requires a strong password and at least one role", () => {
    const weak = createUserSchema.safeParse({
      email: "new@itcs.local",
      password: "short",
      firstName: "New",
      lastName: "User",
      roleCodes: ["viewer"],
    });
    assert.equal(weak.success, false);

    const noRoles = createUserSchema.safeParse({
      email: "new@itcs.local",
      password: "long-enough-password",
      firstName: "New",
      lastName: "User",
      roleCodes: [],
    });
    assert.equal(noRoles.success, false);

    const valid = createUserSchema.safeParse({
      email: "new@itcs.local",
      password: "long-enough-password",
      firstName: "New",
      lastName: "User",
      roleCodes: ["viewer"],
    });
    assert.equal(valid.success, true);
  });

  it("requires at least one field when updating and a strong reset password", () => {
    assert.equal(updateUserSchema.safeParse({}).success, false);
    assert.equal(updateUserSchema.safeParse({ firstName: "Changed" }).success, true);
    assert.equal(resetUserPasswordSchema.safeParse({ newPassword: "short" }).success, false);
    assert.equal(resetUserPasswordSchema.safeParse({ newPassword: "long-enough-password" }).success, true);
  });
});

describe("user service", () => {
  it("hashes a created password and records an audit entry without exposing the secret", async () => {
    const audits: AuditEntry[] = [];
    let storedHash = "";
    const service = new UsersService(
      fakeRepository({
        create: async (input: { passwordHash: string }) => {
          storedHash = input.passwordHash;
          return listedUser();
        },
      }),
      recorder(audits),
    );

    await service.create(
      orgId,
      actorId,
      {
        email: "New.User@ITCS.local",
        password: "long-enough-password",
        firstName: "Target",
        lastName: "User",
        roleCodes: ["viewer"],
      },
      meta,
    );

    assert.notEqual(storedHash, "long-enough-password");
    assert.match(storedHash, /^\$2[aby]\$/);
    assert.equal(audits[0]?.action, "users.created");
    assert.equal(JSON.stringify(audits).includes("long-enough-password"), false);
  });

  it("rejects removing the last administrator role", async () => {
    const audits: AuditEntry[] = [];
    const service = new UsersService(
      fakeRepository({
        findInOrganization: async () =>
          listedUser({ userRoles: [{ role: { code: "admin", name: "Administrator" } }] }),
        countActiveAdmins: async () => 1,
      }),
      recorder(audits),
    );

    await assert.rejects(
      () =>
        service.update(
          orgId,
          actorId,
          targetId,
          { roleCodes: ["viewer"] },
          meta,
        ),
      (error: unknown) =>
        error instanceof ValidationFailedError &&
        JSON.stringify(error.errors).includes("At least one administrator must remain"),
    );
    assert.equal(audits.length, 0);
  });

  it("rejects deactivating the last active administrator", async () => {
    const service = new UsersService(
      fakeRepository({
        findInOrganization: async () =>
          listedUser({ userRoles: [{ role: { code: "admin", name: "Administrator" } }] }),
        countActiveAdmins: async () => 1,
      }),
      recorder([]),
    );

    await assert.rejects(
      () =>
        service.update(
          orgId,
          actorId,
          targetId,
          { status: AccountStatus.INACTIVE },
          meta,
        ),
      (error: unknown) =>
        error instanceof ValidationFailedError &&
        JSON.stringify(error.errors).includes("At least one administrator must remain"),
    );
  });

  it("rejects resetting the password of an inactive user", async () => {
    const service = new UsersService(
      fakeRepository({
        findInOrganization: async () => listedUser({ status: AccountStatus.INACTIVE }),
      }),
      recorder([]),
    );

    await assert.rejects(
      () =>
        service.resetPassword(orgId, actorId, targetId, "another-long-password", meta),
      (error: unknown) =>
        error instanceof ValidationFailedError &&
        JSON.stringify(error.errors).includes("Reactivate this user"),
    );
  });

  it("rejects deactivating your own account", async () => {
    const service = new UsersService(fakeRepository(), recorder([]));

    await assert.rejects(
      () => service.deactivate(orgId, targetId, targetId, meta),
      (error: unknown) =>
        error instanceof ValidationFailedError &&
        JSON.stringify(error.errors).includes("remove your own access"),
    );
  });

  it("hashes a reset password and records the audit event", async () => {
    const audits: AuditEntry[] = [];
    let storedHash = "";
    const service = new UsersService(
      fakeRepository({
        setPassword: async (_organizationId: string, _userId: string, passwordHash: string) => {
          storedHash = passwordHash;
        },
      }),
      recorder(audits),
    );

    await service.resetPassword(orgId, actorId, targetId, "another-long-password", meta);

    assert.notEqual(storedHash, "another-long-password");
    assert.match(storedHash, /^\$2[aby]\$/);
    assert.equal(audits[0]?.action, "users.password.reset");
  });
});

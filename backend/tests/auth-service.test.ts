import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccountStatus } from "@prisma/client";
import { UnauthorizedError } from "../src/common/errors/app-error";
import { hashPassword } from "../src/modules/auth/password";
import { AuthService } from "../src/modules/auth/service";
import type { AuthStore, AuthUserRecord } from "../src/modules/auth/repository";
import type { AuditEntry } from "../src/modules/audit-logs/types";

const meta = { ipAddress: "127.0.0.1", userAgent: "test" };

function user(overrides: Partial<AuthUserRecord> = {}): AuthUserRecord {
  return {
    id: "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11",
    email: "admin@itcs.local",
    passwordHash: "",
    firstName: "System",
    lastName: "Admin",
    status: AccountStatus.ACTIVE,
    failedLoginCount: 0,
    organizationId: "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f",
    roles: ["admin"],
    permissions: ["users:read"],
    ...overrides,
  };
}

describe("authentication service", () => {
  it("rejects an unknown email without revealing that the account is missing", async () => {
    const audits: AuditEntry[] = [];
    const service = new AuthService(fakeStore(null), recorder(audits));

    await assert.rejects(
      () => service.login({ email: "missing@itcs.local", password: "correct-horse" }, meta),
      (error: unknown) => error instanceof UnauthorizedError && error.message === "Invalid email or password",
    );
    assert.equal(audits[0]?.action, "auth.login.failed");
    assert.equal(audits[0]?.userId, null);
  });

  it("locks the account on the fifth bad password and writes an audit row", async () => {
    const passwordHash = await hashPassword("correct-horse");
    const audits: AuditEntry[] = [];
    let failed = 0;
    let locked = false;
    const store = fakeStore(user({ passwordHash, failedLoginCount: 4 }), {
      async recordFailedLogin(_userId, failedLoginCount, lock) {
        failed = failedLoginCount;
        locked = lock;
      },
    });
    const service = new AuthService(store, recorder(audits));

    await assert.rejects(() => service.login({ email: "admin@itcs.local", password: "wrong-password" }, meta));
    assert.equal(failed, 5);
    assert.equal(locked, true);
    assert.equal(audits[0]?.newValues && JSON.stringify(audits[0].newValues).includes("true"), true);
    assert.equal(JSON.stringify(audits[0]?.newValues).includes("wrong-password"), false);
  });

  it("does not complete a password reset for an inactive account", async () => {
    const audits: AuditEntry[] = [];
    let completed = false;
    const service = new AuthService(
      fakeStore(user({ status: AccountStatus.INACTIVE }), {
        async findPasswordReset() {
          return {
            id: "reset-id",
            userId: "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11",
            expiresAt: new Date(Date.now() + 60_000),
            usedAt: null,
          };
        },
        async completePasswordReset() {
          completed = true;
        },
      }),
      recorder(audits),
    );

    await assert.rejects(() =>
      service.confirmPasswordReset(
        { token: "reset-token", password: "another-long-password" },
        meta,
      ),
    );
    assert.equal(completed, false);
  });

  it("returns an access token and records last-login success", async () => {
    const passwordHash = await hashPassword("correct-horse");
    const audits: AuditEntry[] = [];
    let loggedIn = false;
    const service = new AuthService(
      fakeStore(user({ passwordHash }), {
        async recordSuccessfulLogin() {
          loggedIn = true;
        },
      }),
      recorder(audits),
    );

    const result = await service.login({ email: "Admin@itcs.local", password: "correct-horse" }, meta);
    assert.match(result.accessToken, /^[\w-]+\.[\w-]+\.[\w-]+$/);
    assert.equal(result.user.email, "admin@itcs.local");
    assert.equal(loggedIn, true);
    assert.equal(audits.at(-1)?.action, "auth.login.succeeded");
    assert.equal(JSON.stringify(result).includes(passwordHash), false);
  });
});

function recorder(audits: AuditEntry[]) {
  return {
    async record(entry: AuditEntry) {
      audits.push(entry);
    },
  };
}

function fakeStore(
  record: AuthUserRecord | null,
  overrides: Partial<AuthStore> = {},
): AuthStore {
  return {
    async findByEmail() {
      return record;
    },
    async findById() {
      return record;
    },
    async recordFailedLogin() {
      return undefined;
    },
    async recordSuccessfulLogin() {
      return undefined;
    },
    async saveRefreshToken() {
      return "token-id";
    },
    async findRefreshToken() {
      return null;
    },
    async revokeRefreshToken() {
      return undefined;
    },
    async savePasswordReset() {
      return undefined;
    },
    async findPasswordReset() {
      return null;
    },
    async completePasswordReset() {
      return undefined;
    },
    async updatePassword() {
      return undefined;
    },
    async revokeAllRefreshTokens() {
      return undefined;
    },
    async findOrProvisionMicrosoftUser() {
      return record;
    },
    ...overrides,
  };
}

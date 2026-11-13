import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccountStatus } from "@prisma/client";
import { NotFoundError, ValidationFailedError } from "../src/common/errors/app-error";
import type { AuditEntry } from "../src/modules/audit-logs/types";
import { ADMIN_PERMISSION_CODES } from "../src/modules/permissions/catalog";
import type { ProfileRepository } from "../src/modules/profile/repository";
import { assertAvatarDataUrl, ProfileService } from "../src/modules/profile/service";
import { avatarBodySchema, updateProfileSchema } from "../src/modules/profile/validation";

const userId = "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11";
const organizationId = "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f";
const meta = { ipAddress: "127.0.0.1", userAgent: "test" };
const pngDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n2kAAAAASUVORK5CYII=";

function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: userId,
    email: "admin@itcs.local",
    firstName: "System",
    lastName: "Admin",
    phone: null,
    jobTitle: null,
    department: null,
    location: null,
    bio: null,
    avatarUrl: null,
    status: AccountStatus.ACTIVE,
    lastLoginAt: new Date("2026-11-01T08:30:00.000Z"),
    passwordChangedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    memberships: [
      {
        status: AccountStatus.ACTIVE,
        organization: {
          id: organizationId,
          code: "ITCS",
          name: "ITCS",
          status: "ACTIVE",
          baseCurrencyCode: "PKR",
        },
      },
    ],
    userRoles: [
      {
        role: {
          code: "admin",
          name: "Administrator",
          description: "Full access",
          isSystem: true,
          rolePermissions: [],
        },
      },
    ],
    ...overrides,
  };
}

function fakeRepository(overrides: Record<string, unknown> = {}): ProfileRepository {
  return {
    find: async () => profileRow(),
    update: async (_userId: string, _organizationId: string, data: Record<string, unknown>) =>
      profileRow(data),
    updateAvatar: async (_userId: string, _organizationId: string, avatarUrl: string | null) =>
      profileRow({ avatarUrl }),
    ...overrides,
  } as unknown as ProfileRepository;
}

function recorder(entries: AuditEntry[]) {
  return {
    async record(entry: AuditEntry) {
      entries.push(entry);
    },
  };
}

describe("profile validation", () => {
  it("requires at least one profile field and rejects malformed phone numbers", () => {
    assert.equal(updateProfileSchema.safeParse({}).success, false);
    assert.equal(updateProfileSchema.safeParse({ firstName: "Ayesha" }).success, true);
    assert.equal(updateProfileSchema.safeParse({ phone: "not-a-phone" }).success, false);
    assert.equal(updateProfileSchema.safeParse({ phone: "+92 300 1234567" }).success, true);
    assert.equal(updateProfileSchema.safeParse({ bio: "" }).success, true);
  });

  it("accepts only supported image data URLs", () => {
    assert.equal(avatarBodySchema.safeParse({ dataUrl: pngDataUrl }).success, true);
    assert.equal(
      avatarBodySchema.safeParse({
        dataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      }).success,
      false,
    );
    assert.equal(avatarBodySchema.safeParse({ dataUrl: "https://example.com/photo.png" }).success, false);
  });
});

describe("profile service", () => {
  it("returns effective access for an administrator", async () => {
    const service = new ProfileService(fakeRepository(), recorder([]));

    const profile = await service.get(userId, organizationId);

    assert.equal(profile.email, "admin@itcs.local");
    assert.equal(profile.organization?.baseCurrencyCode, "PKR");
    assert.equal(profile.organization?.membershipStatus, AccountStatus.ACTIVE);
    assert.equal(profile.permissions.length, ADMIN_PERMISSION_CODES.length);
    assert.equal(profile.roles[0]?.code, "admin");
  });

  it("trims updates, clears empty optional fields, and records an audit event", async () => {
    const audits: AuditEntry[] = [];
    let stored: Record<string, unknown> | undefined;
    const service = new ProfileService(
      fakeRepository({
        update: async (_userId: string, _organizationId: string, data: Record<string, unknown>) => {
          stored = data;
          return profileRow(data);
        },
      }),
      recorder(audits),
    );

    const profile = await service.update(
      userId,
      organizationId,
      {
        firstName: "  Ayesha ",
        lastName: " Khan ",
        phone: "",
        jobTitle: " Sales Manager ",
        bio: "",
      },
      meta,
    );

    assert.deepEqual(stored, {
      firstName: "Ayesha",
      lastName: "Khan",
      phone: null,
      jobTitle: "Sales Manager",
      bio: null,
    });
    assert.equal(profile.firstName, "Ayesha");
    assert.equal(audits[0]?.action, "profile.updated");
    assert.equal(audits[0]?.entityId, userId);
  });

  it("stores a validated avatar and audits the change without storing the image in the audit log", async () => {
    const audits: AuditEntry[] = [];
    let storedAvatar: string | null = null;
    const service = new ProfileService(
      fakeRepository({
        updateAvatar: async (
          _userId: string,
          _organizationId: string,
          avatarUrl: string | null,
        ) => {
          storedAvatar = avatarUrl;
          return profileRow({ avatarUrl });
        },
      }),
      recorder(audits),
    );

    const profile = await service.updateAvatar(userId, organizationId, pngDataUrl, meta);

    assert.equal(storedAvatar, pngDataUrl);
    assert.equal(profile.avatarUrl, pngDataUrl);
    assert.equal(audits[0]?.action, "profile.avatar.updated");
    assert.equal(JSON.stringify(audits).includes("base64"), false);
  });

  it("rejects image data whose bytes do not match the declared format", () => {
    assert.throws(
      () =>
        assertAvatarDataUrl(
          `data:image/png;base64,${Buffer.from("not an image").toString("base64")}`,
        ),
      (error: unknown) => error instanceof ValidationFailedError,
    );
  });

  it("rejects images larger than 512 KB", () => {
    const oversized = Buffer.alloc(512 * 1024 + 1, 0x89);
    assert.throws(
      () => assertAvatarDataUrl(`data:image/png;base64,${oversized.toString("base64")}`),
      (error: unknown) =>
        error instanceof ValidationFailedError &&
        JSON.stringify(error.errors).includes("smaller than 512 KB"),
    );
  });

  it("removes the avatar and records the audit event", async () => {
    const audits: AuditEntry[] = [];
    const service = new ProfileService(fakeRepository(), recorder(audits));

    const profile = await service.removeAvatar(userId, organizationId, meta);

    assert.equal(profile.avatarUrl, null);
    assert.equal(audits[0]?.action, "profile.avatar.removed");
  });

  it("returns a not-found error when the profile is outside the organization", async () => {
    const service = new ProfileService(
      fakeRepository({ find: async () => null }),
      recorder([]),
    );

    await assert.rejects(
      () => service.get(userId, organizationId),
      (error: unknown) => error instanceof NotFoundError,
    );
  });
});

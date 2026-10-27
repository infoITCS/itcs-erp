import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  ConflictError,
  ForbiddenError,
  ValidationFailedError,
} from "../src/common/errors/app-error";
import type { AuditEntry } from "../src/modules/audit-logs/types";
import { syncRbacCatalog } from "../src/modules/permissions/bootstrap";
import {
  ADMIN_PERMISSION_CODES,
  ERP_PERMISSION_CODES,
  READ_PERMISSION_CODES,
  ROLE_PRESETS,
} from "../src/modules/permissions/catalog";
import type { RolesRepository } from "../src/modules/roles/repository";
import { RolesService } from "../src/modules/roles/service";
import { createRoleSchema, updateRoleSchema } from "../src/modules/roles/validation";

const orgId = "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f";
const actorId = "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11";
const roleId = "a8a4f9b6-1c2d-4e3f-8a9b-0c1d2e3f4a5b";
const meta = { ipAddress: "127.0.0.1", userAgent: "test" };

function roleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: roleId,
    code: "regional-director",
    name: "Regional Director",
    description: "Regional sales leadership",
    isSystem: false,
    rolePermissions: [{ permission: { code: "users:read" } }],
    _count: { userRoles: 0 },
    ...overrides,
  };
}

function fakeRepository(overrides: Record<string, unknown> = {}): RolesRepository {
  return {
    list: async () => [roleRow()],
    findById: async () => roleRow(),
    codeExists: async () => false,
    nameExists: async () => false,
    permissionIdsByCode: async (codes: string[]) =>
      codes
        .filter((code) => ERP_PERMISSION_CODES.includes(code))
        .map((code) => ({ id: `permission-${code}`, code })),
    create: async (input: Record<string, unknown>) => roleRow(input),
    update: async () => undefined,
    delete: async () => undefined,
    ...overrides,
  } as unknown as RolesRepository;
}

function recorder(entries: AuditEntry[]): { record: (entry: AuditEntry) => Promise<void> } {
  return {
    async record(entry) {
      entries.push(entry);
    },
  };
}

describe("role validation", () => {
  it("validates role names, descriptions, and permission codes", () => {
    assert.equal(
      createRoleSchema.safeParse({ name: "Sales", permissions: ["customers:read"] }).success,
      true,
    );
    assert.equal(createRoleSchema.safeParse({ name: "S", permissions: [] }).success, false);
    assert.equal(
      createRoleSchema.safeParse({ name: "Sales", permissions: ["not-a-permission"] }).success,
      false,
    );
    assert.equal(updateRoleSchema.safeParse({}).success, false);
    assert.equal(updateRoleSchema.safeParse({ description: null }).success, true);
  });
});

describe("permission catalog", () => {
  it("keeps permission codes unique and assigns every code to the administrator", () => {
    const codes = new Set(ERP_PERMISSION_CODES);
    assert.equal(codes.size, ERP_PERMISSION_CODES.length);
    assert.deepEqual(ADMIN_PERMISSION_CODES, ERP_PERMISSION_CODES);

    const admin = ROLE_PRESETS.find((role) => role.code === "admin");
    const viewer = ROLE_PRESETS.find((role) => role.code === "viewer");
    assert.ok(admin);
    assert.ok(viewer);
    assert.deepEqual([...admin.permissions].sort(), [...ERP_PERMISSION_CODES].sort());
    assert.deepEqual([...viewer.permissions].sort(), [...READ_PERMISSION_CODES].sort());
  });

  it("only references permissions that exist in the catalog", () => {
    const codes = new Set(ERP_PERMISSION_CODES);
    for (const role of ROLE_PRESETS) {
      assert.equal(new Set(role.permissions).size, role.permissions.length);
      for (const code of role.permissions) {
        assert.equal(codes.has(code), true, `${role.code} references missing ${code}`);
      }
    }
  });
});

describe("RBAC synchronization", () => {
  it("creates missing presets but preserves existing role permission edits", async () => {
    const calls = {
      created: [] as Record<string, unknown>[],
      updated: [] as Record<string, unknown>[],
      permissionDeletes: 0,
      permissionCreates: 0,
    };
    const db = {
      permission: {
        createMany: async () => ({ count: 0 }),
        findMany: async () =>
          ERP_PERMISSION_CODES.map((code) => ({ id: `permission-${code}`, code })),
      },
      organization: { findMany: async () => [{ id: orgId }] },
      role: {
        findMany: async () => [
          {
            id: roleId,
            code: "viewer",
            name: "Viewer",
            description: "Customized viewer",
            isSystem: true,
          },
        ],
        create: async ({ data }: { data: Record<string, unknown> }) => {
          calls.created.push(data);
        },
        update: async ({ data }: { data: Record<string, unknown> }) => {
          calls.updated.push(data);
        },
      },
      rolePermission: {
        deleteMany: async () => {
          calls.permissionDeletes += 1;
        },
        createMany: async () => {
          calls.permissionCreates += 1;
        },
      },
    } as unknown as PrismaClient;

    await syncRbacCatalog(db);

    assert.equal(calls.created.length, ROLE_PRESETS.length - 1);
    assert.equal(calls.updated.length, 1);
    assert.equal(calls.permissionDeletes, 0);
    assert.equal(calls.permissionCreates, 0);
  });
});

describe("role service", () => {
  it("creates a custom role with a generated code and audit entry", async () => {
    const audits: AuditEntry[] = [];
    let createdInput: Record<string, unknown> | undefined;
    const service = new RolesService(
      fakeRepository({
        create: async (input: Record<string, unknown>) => {
          createdInput = input;
          return roleRow({ code: input.code, name: input.name });
        },
      }),
      recorder(audits),
    );

    await service.create(
      orgId,
      actorId,
      {
        name: "Regional Director",
        description: "Regional sales leadership",
        permissions: ["customers:read", "customers:create", "customers:read"],
      },
      meta,
    );

    assert.equal(createdInput?.code, "regional-director");
    assert.deepEqual(createdInput?.permissionIds, [
      "permission-customers:read",
      "permission-customers:create",
    ]);
    assert.equal(audits[0]?.action, "roles.created");
    assert.deepEqual((audits[0]?.newValues as Record<string, unknown>).permissions, [
      "customers:read",
      "customers:create",
    ]);
  });

  it("rejects duplicate names and unknown permissions", async () => {
    const duplicate = new RolesService(
      fakeRepository({ nameExists: async () => true }),
      recorder([]),
    );
    await assert.rejects(
      () =>
        duplicate.create(
          orgId,
          actorId,
          { name: "Sales Manager", permissions: [] },
          meta,
        ),
      (error: unknown) =>
        error instanceof ValidationFailedError &&
        JSON.stringify(error.errors).includes("already exists"),
    );

    const unknown = new RolesService(fakeRepository(), recorder([]));
    await assert.rejects(
      () =>
        unknown.create(
          orgId,
          actorId,
          { name: "Custom Role", permissions: ["customers:read", "missing:read"] },
          meta,
        ),
      (error: unknown) =>
        error instanceof ValidationFailedError &&
        JSON.stringify(error.errors).includes("do not exist"),
    );
  });

  it("protects system role metadata and deletion but allows permission changes", async () => {
    let updatedPermissions: string[] | undefined;
    const service = new RolesService(
      fakeRepository({
        findById: async () => roleRow({ isSystem: true }),
        update: async (_roleId: string, data: { permissionIds?: string[] }) => {
          updatedPermissions = data.permissionIds;
        },
      }),
      recorder([]),
    );

    await assert.rejects(
      () => service.update(orgId, actorId, roleId, { name: "Changed" }, meta),
      (error: unknown) => error instanceof ForbiddenError,
    );
    await assert.rejects(
      () => service.delete(orgId, actorId, roleId, meta),
      (error: unknown) => error instanceof ForbiddenError,
    );

    await service.update(
      orgId,
      actorId,
      roleId,
      { permissions: ["customers:read", "customers:create"] },
      meta,
    );
    assert.deepEqual(updatedPermissions, [
      "permission-customers:read",
      "permission-customers:create",
    ]);
  });

  it("prevents deleting a role that is still assigned to users", async () => {
    const service = new RolesService(
      fakeRepository({
        findById: async () => roleRow({ _count: { userRoles: 2 } }),
      }),
      recorder([]),
    );

    await assert.rejects(
      () => service.delete(orgId, actorId, roleId, meta),
      (error: unknown) => error instanceof ConflictError,
    );
  });

  it("appends a suffix when the generated role code already exists", async () => {
    let createdInput: Record<string, unknown> | undefined;
    const service = new RolesService(
      fakeRepository({
        codeExists: async (_organizationId: string, code: string) => code === "sales-director",
        create: async (input: Record<string, unknown>) => {
          createdInput = input;
          return roleRow({ code: input.code, name: input.name });
        },
      }),
      recorder([]),
    );

    await service.create(
      orgId,
      actorId,
      { name: "Sales Director", permissions: ["customers:read"] },
      meta,
    );

    assert.equal(createdInput?.code, "sales-director-2");
  });
});

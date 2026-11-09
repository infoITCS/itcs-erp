import type { PrismaClient } from "@prisma/client";
import { ERP_PERMISSIONS, ROLE_PRESETS } from "./catalog";
import { permissionCode } from "./types";

export async function syncRbacCatalog(db: PrismaClient): Promise<void> {
  const catalogCodes = ERP_PERMISSIONS.map((permission) =>
    permissionCode(permission.module, permission.action),
  );

  const existingCodes = new Set(
    (
      await db.permission.findMany({
        where: { code: { in: catalogCodes } },
        select: { code: true },
      })
    ).map((permission) => permission.code),
  );

  await db.permission.createMany({
    data: ERP_PERMISSIONS.map((permission) => ({
      code: permissionCode(permission.module, permission.action),
      module: permission.module,
      action: permission.action,
      description: permission.description,
    })),
    skipDuplicates: true,
  });

  // Only backfill permissions that did not exist before this run. This grants new
  // capabilities to existing system roles without undoing their custom edits.
  const newPermissionCodes = new Set(catalogCodes.filter((code) => !existingCodes.has(code)));

  const permissionRows = await db.permission.findMany({
    where: { code: { in: catalogCodes } },
    select: { id: true, code: true },
  });
  const permissionId = new Map(permissionRows.map((permission) => [permission.code, permission.id]));

  const organizations = await db.organization.findMany({ select: { id: true } });
  for (const organization of organizations) {
    await syncOrganizationRoles(db, organization.id, permissionId, newPermissionCodes);
  }
}

async function syncOrganizationRoles(
  db: PrismaClient,
  organizationId: string,
  permissionId: Map<string, string>,
  newPermissionCodes: Set<string>,
): Promise<void> {
  const existingRoles = await db.role.findMany({
    where: { organizationId },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      isSystem: true,
    },
  });

  for (const preset of ROLE_PRESETS) {
    const ids = preset.permissions.map((code) => {
      const id = permissionId.get(code);
      if (!id) {
        throw new Error(`Missing permission in catalog: ${code}`);
      }
      return id;
    });

    const existing = existingRoles.find((role) => role.code === preset.code);
    if (!existing) {
      await db.role.create({
        data: {
          organizationId,
          code: preset.code,
          name: preset.name,
          description: preset.description,
          isSystem: true,
          rolePermissions: { create: ids.map((id) => ({ permissionId: id })) },
        },
      });
      continue;
    }

    if (
      existing.name !== preset.name ||
      existing.description !== preset.description ||
      !existing.isSystem
    ) {
      await db.role.update({
        where: { id: existing.id },
        data: {
          name: preset.name,
          description: preset.description,
          isSystem: true,
        },
      });
    }

    if (existing.isSystem && newPermissionCodes.size > 0) {
      const newIds = preset.permissions
        .filter((code) => newPermissionCodes.has(code))
        .map((code) => permissionId.get(code))
        .filter((id): id is string => Boolean(id));
      if (newIds.length > 0) {
        await db.rolePermission.createMany({
          data: newIds.map((permissionId) => ({ roleId: existing.id, permissionId })),
          skipDuplicates: true,
        });
      }
    }
  }
}

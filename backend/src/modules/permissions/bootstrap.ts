import type { PrismaClient } from "@prisma/client";
import { ERP_PERMISSIONS, ROLE_PRESETS } from "./catalog";
import { permissionCode } from "./types";

export async function syncRbacCatalog(db: PrismaClient): Promise<void> {
  await db.permission.createMany({
    data: ERP_PERMISSIONS.map((permission) => ({
      code: permissionCode(permission.module, permission.action),
      module: permission.module,
      action: permission.action,
      description: permission.description,
    })),
    skipDuplicates: true,
  });

  const permissionRows = await db.permission.findMany({
    where: {
      code: {
        in: ERP_PERMISSIONS.map((permission) =>
          permissionCode(permission.module, permission.action),
        ),
      },
    },
    select: { id: true, code: true },
  });
  const permissionId = new Map(permissionRows.map((permission) => [permission.code, permission.id]));

  const organizations = await db.organization.findMany({ select: { id: true } });
  for (const organization of organizations) {
    await syncOrganizationRoles(db, organization.id, permissionId);
  }
}

async function syncOrganizationRoles(
  db: PrismaClient,
  organizationId: string,
  permissionId: Map<string, string>,
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
  }
}

import type { PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";

const roleSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  isSystem: true,
  rolePermissions: { select: { permission: { select: { code: true } } } },
  _count: { select: { userRoles: true } },
} as const;

export class RolesRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(organizationId: string) {
    return this.db.role.findMany({
      where: { organizationId },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      select: roleSelect,
    });
  }

  async findById(organizationId: string, roleId: string) {
    return this.db.role.findFirst({
      where: { id: roleId, organizationId },
      select: roleSelect,
    });
  }

  async codeExists(organizationId: string, code: string): Promise<boolean> {
    const role = await this.db.role.findUnique({
      where: { organizationId_code: { organizationId, code } },
      select: { id: true },
    });
    return role !== null;
  }

  async nameExists(organizationId: string, name: string, excludeId?: string): Promise<boolean> {
    const role = await this.db.role.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    return role !== null;
  }

  async permissionIdsByCode(codes: string[]): Promise<{ id: string; code: string }[]> {
    return this.db.permission.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
  }

  async create(input: {
    organizationId: string;
    code: string;
    name: string;
    description: string | null;
    permissionIds: string[];
  }) {
    return this.db.role.create({
      data: {
        organizationId: input.organizationId,
        code: input.code,
        name: input.name,
        description: input.description,
        isSystem: false,
        rolePermissions: {
          create: input.permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      select: roleSelect,
    });
  }

  async update(
    roleId: string,
    data: {
      name?: string;
      description?: string | null;
      permissionIds?: string[];
    },
  ): Promise<void> {
    await this.transaction(async (tx) => {
      if (data.name !== undefined || data.description !== undefined) {
        await tx.role.update({
          where: { id: roleId },
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
          },
        });
      }

      if (data.permissionIds !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        if (data.permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: data.permissionIds.map((permissionId) => ({ roleId, permissionId })),
          });
        }
      }
    });
  }

  async delete(roleId: string): Promise<void> {
    await this.db.role.delete({ where: { id: roleId } });
  }
}

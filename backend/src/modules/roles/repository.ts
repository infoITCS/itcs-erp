import type { PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";

export class RolesRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(organizationId: string) {
    return this.db.role.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        rolePermissions: { select: { permission: { select: { code: true } } } },
      },
    });
  }
}

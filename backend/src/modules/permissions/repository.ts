import type { PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";

export class PermissionsRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list() {
    return this.db.permission.findMany({
      orderBy: [{ module: "asc" }, { action: "asc" }],
      select: { id: true, code: true, module: true, action: true, description: true },
    });
  }
}

import type { PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";

export class OrganizationsRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async listForUser(userId: string) {
    return this.db.organizationMember.findMany({
      where: { userId, status: "ACTIVE", organization: { status: "ACTIVE" } },
      orderBy: { createdAt: "asc" },
      select: {
        organization: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            baseCurrencyCode: true,
          },
        },
      },
    });
  }
}

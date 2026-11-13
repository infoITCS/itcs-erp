import type { PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";

const organizationSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  baseCurrencyCode: true,
} as const;

export class OrganizationsRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async listForUser(userId: string) {
    return this.db.organizationMember.findMany({
      where: { userId, status: "ACTIVE", organization: { status: "ACTIVE" } },
      orderBy: { createdAt: "asc" },
      select: { organization: { select: organizationSelect } },
    });
  }

  async findForUser(userId: string, organizationId: string) {
    return this.db.organization.findFirst({
      where: {
        id: organizationId,
        status: "ACTIVE",
        members: { some: { userId, status: "ACTIVE" } },
      },
      select: organizationSelect,
    });
  }

  async currencyExists(code: string): Promise<boolean> {
    const currency = await this.db.currency.findFirst({
      where: { code, isActive: true },
      select: { code: true },
    });
    return Boolean(currency);
  }

  async update(
    organizationId: string,
    input: { name?: string; baseCurrencyCode?: string },
  ) {
    return this.db.organization.update({
      where: { id: organizationId },
      data: input,
      select: organizationSelect,
    });
  }

  async archive(organizationId: string): Promise<void> {
    const archivedAt = new Date();
    await this.db.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { status: "INACTIVE" },
      });
      await tx.organizationMember.updateMany({
        where: { organizationId },
        data: { status: "INACTIVE" },
      });
      await tx.refreshToken.updateMany({
        where: {
          revokedAt: null,
          user: { memberships: { some: { organizationId } } },
        },
        data: { revokedAt: archivedAt },
      });
    });
  }
}

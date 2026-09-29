import { AccountStatus, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { decodeCursor } from "../../common/pagination/cursor";

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export class UsersRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(organizationId: string, limit: number, cursor?: string) {
    const decoded = cursor ? decodeCursor(cursor) : null;
    return this.db.user.findMany({
      where: {
        memberships: { some: { organizationId, status: AccountStatus.ACTIVE } },
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: new Date(decoded.createdAt) } },
                { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: userSelect,
    });
  }

  async findInOrganization(organizationId: string, userId: string) {
    return this.db.user.findFirst({
      where: { id: userId, memberships: { some: { organizationId } } },
      select: {
        ...userSelect,
        failedLoginCount: true,
        lockedAt: true,
        userRoles: {
          where: { role: { organizationId } },
          select: { role: { select: { code: true, name: true } } },
        },
      },
    });
  }

  async emailExists(email: string): Promise<boolean> {
    const existing = await this.db.user.findUnique({ where: { email }, select: { id: true } });
    return existing !== null;
  }

  async create(input: {
    organizationId: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    roleIds: string[];
  }) {
    return this.transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          memberships: {
            create: { organizationId: input.organizationId, status: AccountStatus.ACTIVE },
          },
          userRoles: {
            create: input.roleIds.map((roleId) => ({ roleId })),
          },
        },
        select: userSelect,
      });
      return user;
    });
  }

  async roleIdsByCode(organizationId: string, codes: string[]): Promise<string[]> {
    const roles = await this.db.role.findMany({
      where: { organizationId, code: { in: codes } },
      select: { id: true, code: true },
    });
    return roles.map((role) => role.id);
  }

  async updateStatus(userId: string, status: AccountStatus) {
    return this.db.user.update({
      where: { id: userId },
      data: {
        status,
        ...(status === AccountStatus.ACTIVE
          ? { failedLoginCount: 0, lockedAt: null }
          : {}),
        ...(status === AccountStatus.LOCKED ? { lockedAt: new Date() } : {}),
      },
      select: userSelect,
    });
  }
}

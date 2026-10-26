import { AccountStatus, type Prisma, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { decodeCursor } from "../../common/pagination/cursor";

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
  lastLoginAt: true,
  lockedAt: true,
  failedLoginCount: true,
  createdAt: true,
} as const;

export interface UserListOptions {
  limit: number;
  cursor?: string;
  status?: AccountStatus;
  q?: string;
}

export interface UserUpdateData {
  firstName?: string;
  lastName?: string;
  status?: AccountStatus;
  roleIds?: string[];
}

export class UsersRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(organizationId: string, options: UserListOptions) {
    const decoded = options.cursor ? decodeCursor(options.cursor) : null;
    const search = options.q?.trim();
    const and: Prisma.UserWhereInput[] = [];

    if (search) {
      and.push({
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (decoded) {
      and.push({
        OR: [
          { createdAt: { lt: new Date(decoded.createdAt) } },
          { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
        ],
      });
    }

    return this.db.user.findMany({
      where: {
        memberships: { some: { organizationId } },
        ...(options.status ? { status: options.status } : {}),
        ...(and.length > 0 ? { AND: and } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: options.limit + 1,
      select: {
        ...userSelect,
        userRoles: {
          where: { role: { organizationId } },
          select: { role: { select: { code: true, name: true } } },
        },
      },
    });
  }

  async stats(organizationId: string) {
    const base: Prisma.UserWhereInput = { memberships: { some: { organizationId } } };
    const [total, active, inactive, locked, roles] = await Promise.all([
      this.db.user.count({ where: base }),
      this.db.user.count({ where: { ...base, status: AccountStatus.ACTIVE } }),
      this.db.user.count({ where: { ...base, status: AccountStatus.INACTIVE } }),
      this.db.user.count({ where: { ...base, status: AccountStatus.LOCKED } }),
      this.db.role.count({ where: { organizationId } }),
    ]);

    return { total, active, inactive, locked, roles };
  }

  async findInOrganization(organizationId: string, userId: string) {
    return this.db.user.findFirst({
      where: { id: userId, memberships: { some: { organizationId } } },
      select: {
        ...userSelect,
        memberships: {
          where: { organizationId },
          select: { status: true },
        },
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
      return tx.user.create({
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
    });
  }

  async roleIdsByCode(organizationId: string, codes: string[]): Promise<string[]> {
    const roles = await this.db.role.findMany({
      where: { organizationId, code: { in: codes } },
      select: { id: true, code: true },
    });
    return roles.map((role) => role.id);
  }

  async update(organizationId: string, userId: string, data: UserUpdateData) {
    return this.transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
          ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
          ...(data.status !== undefined
            ? {
                status: data.status,
                ...(data.status === AccountStatus.ACTIVE
                  ? { failedLoginCount: 0, lockedAt: null }
                  : {}),
                ...(data.status === AccountStatus.LOCKED ? { lockedAt: new Date() } : {}),
              }
            : {}),
        },
      });

      if (data.status !== undefined) {
        await tx.organizationMember.updateMany({
          where: { organizationId, userId },
          data: {
            status:
              data.status === AccountStatus.ACTIVE
                ? AccountStatus.ACTIVE
                : AccountStatus.INACTIVE,
          },
        });
        if (data.status !== AccountStatus.ACTIVE) {
          await tx.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      }

      if (data.roleIds !== undefined) {
        await tx.userRole.deleteMany({
          where: { userId, role: { organizationId } },
        });
        if (data.roleIds.length > 0) {
          await tx.userRole.createMany({
            data: data.roleIds.map((roleId) => ({ userId, roleId })),
          });
        }
      }
    });
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

  async setPassword(organizationId: string, userId: string, passwordHash: string): Promise<void> {
    await this.transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginCount: 0,
          status: AccountStatus.ACTIVE,
          lockedAt: null,
        },
      });
      await tx.organizationMember.updateMany({
        where: { organizationId, userId },
        data: { status: AccountStatus.ACTIVE },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async deactivate(organizationId: string, userId: string): Promise<void> {
    await this.transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: AccountStatus.INACTIVE },
      });
      await tx.organizationMember.updateMany({
        where: { organizationId, userId },
        data: { status: AccountStatus.INACTIVE },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async countActiveAdmins(organizationId: string): Promise<number> {
    return this.db.user.count({
      where: {
        status: AccountStatus.ACTIVE,
        memberships: { some: { organizationId, status: AccountStatus.ACTIVE } },
        userRoles: {
          some: { role: { organizationId, code: "admin" } },
        },
      },
    });
  }
}

import { AccountStatus, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";

export type AuthStore = Pick<
  AuthRepository,
  | "findByEmail"
  | "findById"
  | "recordFailedLogin"
  | "recordSuccessfulLogin"
  | "saveRefreshToken"
  | "findRefreshToken"
  | "revokeRefreshToken"
  | "savePasswordReset"
  | "findPasswordReset"
  | "completePasswordReset"
  | "updatePassword"
  | "revokeAllRefreshTokens"
  | "findOrProvisionMicrosoftUser"
>;

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  status: AccountStatus;
  failedLoginCount: number;
  organizationId: string | null;
  roles: string[];
  permissions: string[];
}

export interface StoredRefreshToken {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface StoredPasswordReset {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface NewRefreshToken {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface MicrosoftProvisionInput {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  organizationCode: string;
  defaultRoleCode: string;
}

export class AuthRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async findById(userId: string): Promise<AuthUserRecord | null> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      return null;
    }
    return this.findByEmail(user.email);
  }

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        status: true,
        failedLoginCount: true,
        memberships: {
          where: {
            status: AccountStatus.ACTIVE,
            organization: { status: "ACTIVE" },
          },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { organizationId: true },
        },
      },
    });

    if (!user) {
      return null;
    }

    const organizationId = user.memberships[0]?.organizationId ?? null;
    const access = organizationId
      ? await this.accessFor(user.id, organizationId)
      : { roles: [], permissions: [] };

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      failedLoginCount: user.failedLoginCount,
      organizationId,
      roles: access.roles,
      permissions: access.permissions,
    };
  }

  async accessFor(
    userId: string,
    organizationId: string,
  ): Promise<{ roles: string[]; permissions: string[] }> {
    const assignments = await this.db.userRole.findMany({
      where: { userId, role: { organizationId } },
      select: {
        role: {
          select: {
            code: true,
            rolePermissions: { select: { permission: { select: { code: true } } } },
          },
        },
      },
    });

    const roles = assignments.map((assignment) => assignment.role.code);
    const permissions = [
      ...new Set(
        assignments.flatMap((assignment) =>
          assignment.role.rolePermissions.map((link) => link.permission.code),
        ),
      ),
    ];

    return { roles, permissions };
  }

  async recordFailedLogin(userId: string, failedLoginCount: number, lock: boolean): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: {
        failedLoginCount,
        ...(lock ? { status: AccountStatus.LOCKED, lockedAt: new Date() } : {}),
      },
    });
  }

  async recordSuccessfulLogin(userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: 0,
        lastLoginAt: new Date(),
      },
    });
  }

  async saveRefreshToken(input: NewRefreshToken): Promise<string> {
    const created = await this.db.refreshToken.create({
      data: input,
      select: { id: true },
    });
    return created.id;
  }

  async findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null> {
    return this.db.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });
  }

  async revokeRefreshToken(id: string, replacedById?: string): Promise<void> {
    await this.db.refreshToken.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        ...(replacedById ? { replacedById } : {}),
      },
    });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async savePasswordReset(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  async findPasswordReset(tokenHash: string): Promise<StoredPasswordReset | null> {
    return this.db.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
  }

  async completePasswordReset(userId: string, tokenId: string, passwordHash: string): Promise<void> {
    const now = new Date();
    await this.transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginCount: 0,
          status: AccountStatus.ACTIVE,
          lockedAt: null,
        },
      });
      await tx.passwordResetToken.update({
        where: { id: tokenId },
        data: { usedAt: now },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const now = new Date();
    await this.transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginCount: 0,
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
  }

  async findOrProvisionMicrosoftUser(input: MicrosoftProvisionInput): Promise<AuthUserRecord | null> {
    await this.transaction(async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { code: input.organizationCode },
        select: { id: true, status: true },
      });
      if (!organization || organization.status !== "ACTIVE") {
        throw new Error("Organization is not available for Microsoft sign-in");
      }

      const role = await tx.role.findUnique({
        where: {
          organizationId_code: {
            organizationId: organization.id,
            code: input.defaultRoleCode,
          },
        },
        select: { id: true },
      });
      if (!role) {
        throw new Error("Microsoft default role is not configured");
      }

      const existing = await tx.user.findUnique({
        where: { email: input.email },
        select: { id: true, status: true },
      });

      if (!existing) {
        await tx.user.create({
          data: {
            email: input.email,
            passwordHash: input.passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            status: AccountStatus.ACTIVE,
            memberships: {
              create: { organizationId: organization.id, status: AccountStatus.ACTIVE },
            },
            userRoles: { create: [{ roleId: role.id }] },
          },
        });
        return;
      }

      const membership = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: existing.id,
          },
        },
        select: { id: true },
      });

      if (!membership) {
        await tx.organizationMember.create({
          data: {
            organizationId: organization.id,
            userId: existing.id,
            status:
              existing.status === AccountStatus.ACTIVE
                ? AccountStatus.ACTIVE
                : AccountStatus.INACTIVE,
          },
        });
        const existingRole = await tx.userRole.findFirst({
          where: { userId: existing.id, role: { organizationId: organization.id } },
          select: { userId: true },
        });
        if (!existingRole) {
          await tx.userRole.create({
            data: { userId: existing.id, roleId: role.id },
          });
        }
      }
    });

    return this.findByEmail(input.email);
  }
}

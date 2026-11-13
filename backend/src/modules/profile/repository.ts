import type { PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";

const profileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  jobTitle: true,
  department: true,
  location: true,
  bio: true,
  avatarUrl: true,
  status: true,
  lastLoginAt: true,
  passwordChangedAt: true,
  createdAt: true,
  memberships: {
    where: { organizationId: "" },
    select: {
      status: true,
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
  },
  userRoles: {
    where: { role: { organizationId: "" } },
    select: {
      role: {
        select: {
          code: true,
          name: true,
          description: true,
          isSystem: true,
          rolePermissions: { select: { permission: { select: { code: true } } } },
        },
      },
    },
  },
} as const;

function selectForOrganization(organizationId: string) {
  return {
    ...profileSelect,
    memberships: {
      ...profileSelect.memberships,
      where: { organizationId },
    },
    userRoles: {
      ...profileSelect.userRoles,
      where: { role: { organizationId } },
    },
  };
}

export interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  location?: string | null;
  bio?: string | null;
}

export class ProfileRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async find(userId: string, organizationId: string) {
    return this.db.user.findFirst({
      where: { id: userId, memberships: { some: { organizationId } } },
      select: selectForOrganization(organizationId),
    });
  }

  async update(userId: string, organizationId: string, data: ProfileUpdateData) {
    return this.db.user.update({
      where: { id: userId },
      data,
      select: selectForOrganization(organizationId),
    });
  }

  async updateAvatar(userId: string, organizationId: string, avatarUrl: string | null) {
    return this.db.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: selectForOrganization(organizationId),
    });
  }
}

export type ProfileRow = NonNullable<Awaited<ReturnType<ProfileRepository["find"]>>>;

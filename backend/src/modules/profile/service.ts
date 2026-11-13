import type { Prisma } from "@prisma/client";
import { NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import type { AuditWriter } from "../audit-logs/types";
import type { RequestMeta } from "../auth/types";
import { ADMIN_PERMISSION_CODES } from "../permissions/catalog";
import type { ProfileRepository, ProfileRow, ProfileUpdateData } from "./repository";
import type { UpdateProfileInput } from "./validation";

const AVATAR_BYTES_MAX = 512 * 1024;

function cleanOptional(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isPng(bytes: Buffer): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isJpeg(bytes: Buffer): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWebp(bytes: Buffer): boolean {
  return (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  );
}

export function assertAvatarDataUrl(dataUrl: string): string {
  const match = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new ValidationFailedError({
      dataUrl: ["Upload a PNG, JPEG, or WebP image"],
    });
  }

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > AVATAR_BYTES_MAX) {
    throw new ValidationFailedError({
      dataUrl: ["Profile images must be smaller than 512 KB"],
    });
  }

  const format = match[1];
  const valid =
    (format === "png" && isPng(bytes)) ||
    (format === "jpeg" && isJpeg(bytes)) ||
    (format === "webp" && isWebp(bytes));

  if (!valid) {
    throw new ValidationFailedError({
      dataUrl: ["The uploaded file is not a valid image"],
    });
  }

  return dataUrl;
}

function present(row: ProfileRow) {
  const roleLinks = row.userRoles.map((link) => link.role);
  const roles = roleLinks.map((role) => ({
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
  }));
  const permissions = roleLinks.some((role) => role.code === "admin")
    ? [...ADMIN_PERMISSION_CODES]
    : [
        ...new Set(
          roleLinks.flatMap((role) =>
            role.rolePermissions.map((link) => link.permission.code),
          ),
        ),
      ];

  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    jobTitle: row.jobTitle,
    department: row.department,
    location: row.location,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    status: row.status,
    lastLoginAt: row.lastLoginAt,
    passwordChangedAt: row.passwordChangedAt,
    createdAt: row.createdAt,
    roles,
    permissions,
    organization: row.memberships[0]
      ? {
          ...row.memberships[0].organization,
          membershipStatus: row.memberships[0].status,
        }
      : null,
  };
}

export class ProfileService {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly audit: AuditWriter,
  ) {}

  async get(userId: string, organizationId: string) {
    const profile = await this.repository.find(userId, organizationId);
    if (!profile) {
      throw new NotFoundError("Profile not found");
    }
    return present(profile);
  }

  async update(
    userId: string,
    organizationId: string,
    input: UpdateProfileInput,
    meta: RequestMeta,
  ) {
    const existing = await this.repository.find(userId, organizationId);
    if (!existing) {
      throw new NotFoundError("Profile not found");
    }

    const data: ProfileUpdateData = {};
    if (input.firstName !== undefined) {
      data.firstName = input.firstName.trim();
    }
    if (input.lastName !== undefined) {
      data.lastName = input.lastName.trim();
    }
    if (input.phone !== undefined) {
      data.phone = cleanOptional(input.phone);
    }
    if (input.jobTitle !== undefined) {
      data.jobTitle = cleanOptional(input.jobTitle);
    }
    if (input.department !== undefined) {
      data.department = cleanOptional(input.department);
    }
    if (input.location !== undefined) {
      data.location = cleanOptional(input.location);
    }
    if (input.bio !== undefined) {
      data.bio = cleanOptional(input.bio);
    }

    const updated = await this.repository.update(userId, organizationId, data);
    await this.audit.record({
      organizationId,
      userId,
      action: "profile.updated",
      module: "profile",
      entityType: "user",
      entityId: userId,
      oldValues: {
        firstName: existing.firstName,
        lastName: existing.lastName,
        phone: existing.phone,
        jobTitle: existing.jobTitle,
        department: existing.department,
        location: existing.location,
        bio: existing.bio,
      },
      newValues: { ...data } as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return present(updated);
  }

  async updateAvatar(
    userId: string,
    organizationId: string,
    dataUrl: string,
    meta: RequestMeta,
  ) {
    const existing = await this.repository.find(userId, organizationId);
    if (!existing) {
      throw new NotFoundError("Profile not found");
    }

    const avatarUrl = assertAvatarDataUrl(dataUrl);
    const updated = await this.repository.updateAvatar(userId, organizationId, avatarUrl);
    await this.audit.record({
      organizationId,
      userId,
      action: "profile.avatar.updated",
      module: "profile",
      entityType: "user",
      entityId: userId,
      oldValues: { hadAvatar: Boolean(existing.avatarUrl) },
      newValues: { avatarUpdated: true },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return present(updated);
  }

  async removeAvatar(userId: string, organizationId: string, meta: RequestMeta) {
    const existing = await this.repository.find(userId, organizationId);
    if (!existing) {
      throw new NotFoundError("Profile not found");
    }

    const updated = await this.repository.updateAvatar(userId, organizationId, null);
    await this.audit.record({
      organizationId,
      userId,
      action: "profile.avatar.removed",
      module: "profile",
      entityType: "user",
      entityId: userId,
      oldValues: { hadAvatar: Boolean(existing.avatarUrl) },
      newValues: { avatarUpdated: false },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return present(updated);
  }
}

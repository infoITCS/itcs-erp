import { AccountStatus } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import { toCursorPage } from "../../common/pagination/cursor";
import type { AuditWriter } from "../audit-logs/types";
import { hashPassword } from "../auth/password";
import type { RequestMeta } from "../auth/types";
import type { UsersRepository } from "./repository";

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleCodes: string[];
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  status?: AccountStatus;
  roleCodes?: string[];
}

export interface UserListInput {
  limit: number;
  cursor?: string;
  status?: AccountStatus;
  q?: string;
}

export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly audit: AuditWriter,
  ) {}

  async list(organizationId: string, input: UserListInput) {
    const rows = await this.repository.list(organizationId, input);
    return toCursorPage(rows, input.limit);
  }

  async stats(organizationId: string) {
    return this.repository.stats(organizationId);
  }

  async get(organizationId: string, userId: string) {
    const user = await this.repository.findInOrganization(organizationId, userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return user;
  }

  async create(
    organizationId: string,
    actorId: string,
    input: CreateUserInput,
    meta: RequestMeta,
  ) {
    const email = input.email.toLowerCase();
    if (await this.repository.emailExists(email)) {
      throw new ConflictError("A user with this email already exists");
    }

    const roleIds = await this.roleIds(organizationId, input.roleCodes);
    const created = await this.repository.create({
      organizationId,
      email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      roleIds,
    });

    await this.audit.record({
      organizationId,
      userId: actorId,
      action: "users.created",
      module: "users",
      entityType: "user",
      entityId: created.id,
      newValues: { email, firstName: input.firstName, lastName: input.lastName, roleCodes: input.roleCodes },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.get(organizationId, created.id);
  }

  async update(
    organizationId: string,
    actorId: string,
    userId: string,
    input: UpdateUserInput,
    meta: RequestMeta,
  ) {
    const existing = await this.get(organizationId, userId);
    const existingRoles = existing.userRoles.map((link) => link.role.code);

    if (actorId === userId && input.status !== undefined && input.status !== AccountStatus.ACTIVE) {
      throw new ValidationFailedError({ status: ["You cannot deactivate your own account"] });
    }
    if (actorId === userId && input.roleCodes && !input.roleCodes.includes("admin")) {
      throw new ValidationFailedError({ roleCodes: ["You cannot remove your own administrator role"] });
    }

    if (
      existingRoles.includes("admin") &&
      ((input.roleCodes && !input.roleCodes.includes("admin")) ||
        (input.status !== undefined && input.status !== AccountStatus.ACTIVE)) &&
      (await this.repository.countActiveAdmins(organizationId)) <= 1
    ) {
      throw new ValidationFailedError({ roleCodes: ["At least one administrator must remain"] });
    }

    const roleIds =
      input.roleCodes !== undefined
        ? await this.roleIds(organizationId, input.roleCodes)
        : undefined;

    await this.repository.update(organizationId, userId, {
      firstName: input.firstName,
      lastName: input.lastName,
      status: input.status,
      roleIds,
    });

    await this.audit.record({
      organizationId,
      userId: actorId,
      action: "users.updated",
      module: "users",
      entityType: "user",
      entityId: userId,
      oldValues: {
        firstName: existing.firstName,
        lastName: existing.lastName,
        status: existing.status,
        roleCodes: existingRoles,
      },
      newValues: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.roleCodes !== undefined ? { roleCodes: input.roleCodes } : {}),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.get(organizationId, userId);
  }

  async updateStatus(
    organizationId: string,
    actorId: string,
    userId: string,
    status: AccountStatus,
    meta: RequestMeta,
  ) {
    return this.update(organizationId, actorId, userId, { status }, meta);
  }

  async deactivate(
    organizationId: string,
    actorId: string,
    userId: string,
    meta: RequestMeta,
  ) {
    const existing = await this.get(organizationId, userId);
    if (actorId === userId) {
      throw new ValidationFailedError({ _form: ["You cannot remove your own access"] });
    }
    if (
      existing.userRoles.some((link) => link.role.code === "admin") &&
      (await this.repository.countActiveAdmins(organizationId)) <= 1
    ) {
      throw new ValidationFailedError({ _form: ["At least one administrator must remain"] });
    }

    await this.repository.deactivate(organizationId, userId);
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: "users.access.removed",
      module: "users",
      entityType: "user",
      entityId: userId,
      oldValues: { email: existing.email, status: existing.status },
      newValues: { status: AccountStatus.INACTIVE },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async resetPassword(
    organizationId: string,
    actorId: string,
    userId: string,
    newPassword: string,
    meta: RequestMeta,
  ) {
    const existing = await this.get(organizationId, userId);
    if (existing.status === AccountStatus.INACTIVE) {
      throw new ValidationFailedError({
        status: ["Reactivate this user before resetting the password"],
      });
    }
    await this.repository.setPassword(
      organizationId,
      userId,
      await hashPassword(newPassword),
    );
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: "users.password.reset",
      module: "users",
      entityType: "user",
      entityId: userId,
      oldValues: { email: existing.email },
      newValues: { passwordChanged: true },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return this.get(organizationId, userId);
  }

  private async roleIds(organizationId: string, roleCodes: string[]): Promise<string[]> {
    const roleIds = await this.repository.roleIdsByCode(organizationId, roleCodes);
    if (roleIds.length !== roleCodes.length) {
      throw new ValidationFailedError({ roleCodes: ["One or more roles do not exist in this organization"] });
    }
    return roleIds;
  }
}

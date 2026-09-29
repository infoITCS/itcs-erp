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

export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly audit: AuditWriter,
  ) {}

  async list(organizationId: string, limit: number, cursor?: string) {
    const rows = await this.repository.list(organizationId, limit, cursor);
    return toCursorPage(rows, limit);
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

    const roleIds = await this.repository.roleIdsByCode(organizationId, input.roleCodes);
    if (roleIds.length !== input.roleCodes.length) {
      throw new ValidationFailedError({ roleCodes: ["One or more roles do not exist in this organization"] });
    }

    const user = await this.repository.create({
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
      entityId: user.id,
      newValues: { email, firstName: input.firstName, lastName: input.lastName, roleCodes: input.roleCodes },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return user;
  }

  async updateStatus(
    organizationId: string,
    actorId: string,
    userId: string,
    status: AccountStatus,
    meta: RequestMeta,
  ) {
    const existing = await this.get(organizationId, userId);
    const updated = await this.repository.updateStatus(userId, status);
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: "users.status.changed",
      module: "users",
      entityType: "user",
      entityId: userId,
      oldValues: { status: existing.status },
      newValues: { status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return updated;
  }
}

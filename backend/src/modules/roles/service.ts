import { randomUUID } from "node:crypto";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationFailedError,
} from "../../common/errors/app-error";
import type { AuditWriter } from "../audit-logs/types";
import type { RequestMeta } from "../auth/types";
import type { RolesRepository } from "./repository";
import type { RoleInput, UpdateRoleInput } from "./types";

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  rolePermissions: { permission: { code: string } }[];
  _count: { userRoles: number };
}

export class RolesService {
  constructor(
    private readonly repository: RolesRepository,
    private readonly audit: AuditWriter,
  ) {}

  async list(organizationId: string) {
    const roles = await this.repository.list(organizationId);
    return roles.map((role) => this.present(role));
  }

  async get(organizationId: string, roleId: string) {
    const role = await this.repository.findById(organizationId, roleId);
    if (!role) {
      throw new NotFoundError("Role not found");
    }
    return this.present(role);
  }

  async create(
    organizationId: string,
    actorId: string,
    input: RoleInput,
    meta: RequestMeta,
  ) {
    const name = input.name.trim();
    if (await this.repository.nameExists(organizationId, name)) {
      throw new ValidationFailedError({ name: ["A role with this name already exists"] });
    }

    const permissions = [...new Set(input.permissions)];
    const permissionIds = await this.resolvePermissionIds(permissions);
    const code = await this.uniqueCode(organizationId, name);
    const description = input.description?.trim() || null;

    const created = await this.repository.create({
      organizationId,
      code,
      name,
      description,
      permissionIds,
    });

    await this.audit.record({
      organizationId,
      userId: actorId,
      action: "roles.created",
      module: "roles",
      entityType: "role",
      entityId: created.id,
      newValues: { code, name, description, permissions },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.get(organizationId, created.id);
  }

  async update(
    organizationId: string,
    actorId: string,
    roleId: string,
    input: UpdateRoleInput,
    meta: RequestMeta,
  ) {
    const existing = await this.get(organizationId, roleId);
    if (existing.isSystem && (input.name !== undefined || input.description !== undefined)) {
      throw new ForbiddenError("System role names and descriptions cannot be edited");
    }

    let name: string | undefined;
    if (input.name !== undefined) {
      name = input.name.trim();
      if (name !== existing.name && (await this.repository.nameExists(organizationId, name, roleId))) {
        throw new ValidationFailedError({ name: ["A role with this name already exists"] });
      }
    }

    const permissions =
      input.permissions !== undefined ? [...new Set(input.permissions)] : undefined;
    const permissionIds =
      permissions !== undefined ? await this.resolvePermissionIds(permissions) : undefined;

    await this.repository.update(roleId, {
      name,
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      permissionIds,
    });

    await this.audit.record({
      organizationId,
      userId: actorId,
      action: "roles.updated",
      module: "roles",
      entityType: "role",
      entityId: roleId,
      oldValues: {
        name: existing.name,
        description: existing.description,
        permissions: existing.permissions,
      },
      newValues: {
        ...(name !== undefined ? { name } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(permissions !== undefined ? { permissions } : {}),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.get(organizationId, roleId);
  }

  async delete(
    organizationId: string,
    actorId: string,
    roleId: string,
    meta: RequestMeta,
  ): Promise<void> {
    const existing = await this.get(organizationId, roleId);
    if (existing.isSystem) {
      throw new ForbiddenError("System roles cannot be deleted");
    }
    if (existing.userCount > 0) {
      throw new ConflictError("Remove this role from all users before deleting it");
    }

    await this.repository.delete(roleId);
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: "roles.deleted",
      module: "roles",
      entityType: "role",
      entityId: roleId,
      oldValues: {
        code: existing.code,
        name: existing.name,
        description: existing.description,
        permissions: existing.permissions,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  private present(role: RoleRow) {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role._count.userRoles,
      permissions: role.rolePermissions.map((link) => link.permission.code).sort(),
    };
  }

  private async resolvePermissionIds(codes: string[]): Promise<string[]> {
    const rows = await this.repository.permissionIdsByCode(codes);
    if (rows.length !== codes.length) {
      throw new ValidationFailedError({
        permissions: ["One or more permissions do not exist"],
      });
    }
    return rows.map((row) => row.id);
  }

  private async uniqueCode(organizationId: string, name: string): Promise<string> {
    const base = slugify(name);
    let code = base;
    let suffix = 2;
    while (await this.repository.codeExists(organizationId, code)) {
      code = `${base.slice(0, 56)}-${suffix}`;
      suffix += 1;
    }
    return code;
  }
}

function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52);
  return base || `role-${randomUUID().slice(0, 8)}`;
}

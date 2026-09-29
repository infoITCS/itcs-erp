import type { RolesRepository } from "./repository";

export class RolesService {
  constructor(private readonly repository: RolesRepository) {}

  async list(organizationId: string) {
    const roles = await this.repository.list(organizationId);
    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.rolePermissions.map((link) => link.permission.code),
    }));
  }
}

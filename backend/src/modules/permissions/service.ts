import {
  PERMISSION_ACTION_META,
  PERMISSION_MODULES,
  type PermissionAction,
  type PermissionModule,
} from "./catalog";
import type { PermissionsRepository } from "./repository";

export class PermissionsService {
  constructor(private readonly repository: PermissionsRepository) {}

  async list() {
    const permissions = await this.repository.list();
    return permissions.map((permission) => {
      const module = PERMISSION_MODULES[permission.module as PermissionModule];
      const action = PERMISSION_ACTION_META[permission.action as PermissionAction];
      return {
        ...permission,
        moduleName: module?.name ?? permission.module,
        group: module?.group ?? "Other",
        moduleDescription: module?.description ?? "",
        moduleSortOrder: module?.sortOrder ?? 999,
        actionLabel: action?.label ?? permission.action,
        actionSortOrder: action?.sortOrder ?? 999,
        risk: action?.risk ?? "standard",
      };
    });
  }
}

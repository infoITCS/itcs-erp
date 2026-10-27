import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export type PermissionRisk = "standard" | "sensitive" | "critical";

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

export interface Permission {
  id: string;
  code: string;
  module: string;
  action: string;
  description: string;
  moduleName: string;
  group: string;
  moduleDescription: string;
  moduleSortOrder: number;
  actionLabel: string;
  actionSortOrder: number;
  risk: PermissionRisk;
}

export interface CreateRoleInput {
  name: string;
  description?: string | null;
  permissions: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string | null;
  permissions?: string[];
}

export function listRoles(): Promise<Role[]> {
  return http
    .get<ApiSuccess<Role[]>>("/api/v1/roles")
    .then((response) => response.data.data ?? []);
}

export function listPermissions(): Promise<Permission[]> {
  return http
    .get<ApiSuccess<Permission[]>>("/api/v1/permissions")
    .then((response) => response.data.data ?? []);
}

export function createRole(input: CreateRoleInput): Promise<Role> {
  return http
    .post<ApiSuccess<Role>>("/api/v1/roles", input)
    .then((response) => response.data.data as Role);
}

export function updateRole(roleId: string, input: UpdateRoleInput): Promise<Role> {
  return http
    .patch<ApiSuccess<Role>>(`/api/v1/roles/${roleId}`, input)
    .then((response) => response.data.data as Role);
}

export function deleteRole(roleId: string): Promise<unknown> {
  return http.delete(`/api/v1/roles/${roleId}`).then((response) => response.data);
}

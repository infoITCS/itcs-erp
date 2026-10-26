import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export type AccountStatus = "ACTIVE" | "INACTIVE" | "LOCKED";

export interface RoleLink {
  role: { code: string; name: string };
}

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: AccountStatus;
  lastLoginAt: string | null;
  lockedAt: string | null;
  failedLoginCount: number;
  createdAt: string;
  userRoles: RoleLink[];
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  locked: number;
  roles: number;
}

export interface UserPage {
  items: UserSummary[];
  pageInfo: {
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
}

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

export function listUsers(params: {
  q?: string;
  status?: AccountStatus;
  cursor?: string;
  limit?: number;
}): Promise<UserPage> {
  return http
    .get<ApiSuccess<UserPage>>("/api/v1/users", { params })
    .then((response) => response.data.data as UserPage);
}

export function getUserStats(): Promise<UserStats> {
  return http
    .get<ApiSuccess<UserStats>>("/api/v1/users/stats")
    .then((response) => response.data.data as UserStats);
}

export function createUser(input: CreateUserInput): Promise<UserSummary> {
  return http
    .post<ApiSuccess<UserSummary>>("/api/v1/users", input)
    .then((response) => response.data.data as UserSummary);
}

export function updateUser(userId: string, input: UpdateUserInput): Promise<UserSummary> {
  return http
    .patch<ApiSuccess<UserSummary>>(`/api/v1/users/${userId}`, input)
    .then((response) => response.data.data as UserSummary);
}

export function resetUserPassword(userId: string, newPassword: string): Promise<UserSummary> {
  return http
    .post<ApiSuccess<UserSummary>>(`/api/v1/users/${userId}/reset-password`, { newPassword })
    .then((response) => response.data.data as UserSummary);
}

export function removeUser(userId: string): Promise<unknown> {
  return http.delete(`/api/v1/users/${userId}`).then((response) => response.data);
}

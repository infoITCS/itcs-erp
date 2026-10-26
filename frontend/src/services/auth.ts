import { http } from "@/lib/http.ts";
import type { SessionUser } from "@/lib/token-store.ts";
import type { ApiSuccess } from "@/types/api.ts";

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export interface AuthProviders {
  password: boolean;
  microsoft: boolean;
  microsoftDomain?: string;
}

export function login(input: LoginInput): Promise<ApiSuccess<LoginResult>> {
  return http.post<ApiSuccess<LoginResult>>("/api/v1/auth/login", input).then((response) => response.data);
}

export function refreshSession(refreshToken: string): Promise<ApiSuccess<LoginResult>> {
  return http
    .post<ApiSuccess<LoginResult>>("/api/v1/auth/refresh", { refreshToken })
    .then((response) => response.data);
}

export function logout(refreshToken: string): Promise<ApiSuccess<unknown>> {
  return http
    .post<ApiSuccess<unknown>>("/api/v1/auth/logout", { refreshToken })
    .then((response) => response.data);
}

export function logoutAll(): Promise<ApiSuccess<unknown>> {
  return http.post<ApiSuccess<unknown>>("/api/v1/auth/logout-all").then((response) => response.data);
}

export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ApiSuccess<unknown>> {
  return http.post<ApiSuccess<unknown>>("/api/v1/auth/change-password", input).then((response) => response.data);
}

export function getProviders(): Promise<ApiSuccess<AuthProviders>> {
  return http.get<ApiSuccess<AuthProviders>>("/api/v1/auth/providers").then((response) => response.data);
}

export function exchangeMicrosoftTicket(ticket: string): Promise<ApiSuccess<LoginResult>> {
  return http
    .post<ApiSuccess<LoginResult>>("/api/v1/auth/microsoft/exchange", { ticket })
    .then((response) => response.data);
}

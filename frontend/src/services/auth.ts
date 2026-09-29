import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    organizationId: string;
    roles: string[];
  };
}

export function login(input: LoginInput): Promise<ApiSuccess<LoginResult>> {
  return http.post<ApiSuccess<LoginResult>>("/api/v1/auth/login", input).then((response) => response.data);
}

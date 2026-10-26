import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
}

export function listRoles(): Promise<Role[]> {
  return http
    .get<ApiSuccess<Role[]>>("/api/v1/roles")
    .then((response) => response.data.data ?? []);
}

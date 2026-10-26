import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export interface Organization {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  baseCurrencyCode: string;
}

export function listOrganizations(): Promise<Organization[]> {
  return http
    .get<ApiSuccess<Organization[]>>("/api/v1/organizations")
    .then((response) => response.data.data ?? []);
}

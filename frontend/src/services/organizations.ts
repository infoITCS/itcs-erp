import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export interface Organization {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  baseCurrencyCode: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  baseCurrencyCode?: string;
}

export function listOrganizations(): Promise<Organization[]> {
  return http
    .get<ApiSuccess<Organization[]>>("/api/v1/organizations")
    .then((response) => response.data.data ?? []);
}

export function updateOrganization(
  organizationId: string,
  input: UpdateOrganizationInput,
): Promise<Organization> {
  return http
    .patch<ApiSuccess<Organization>>(`/api/v1/organizations/${organizationId}`, input)
    .then((response) => response.data.data as Organization);
}

export function deleteOrganization(organizationId: string): Promise<void> {
  return http
    .delete<ApiSuccess<never>>(`/api/v1/organizations/${organizationId}`)
    .then(() => undefined);
}

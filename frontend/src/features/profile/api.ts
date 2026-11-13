import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export type AccountStatus = "ACTIVE" | "INACTIVE" | "LOCKED";

export interface ProfileRole {
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

export interface ProfileOrganization {
  id: string;
  code: string;
  name: string;
  status: string;
  baseCurrencyCode: string;
  membershipStatus: string;
}

export interface Profile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  location: string | null;
  bio: string | null;
  avatarUrl: string | null;
  status: AccountStatus;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  createdAt: string;
  roles: ProfileRole[];
  permissions: string[];
  organization: ProfileOrganization | null;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  location?: string;
  bio?: string;
}

function profileData(response: { data: ApiSuccess<Profile> }): Profile {
  return response.data.data as Profile;
}

export function getProfile(): Promise<Profile> {
  return http.get<ApiSuccess<Profile>>("/api/v1/profile").then(profileData);
}

export function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  return http.patch<ApiSuccess<Profile>>("/api/v1/profile", input).then(profileData);
}

export function updateProfileAvatar(dataUrl: string): Promise<Profile> {
  return http.put<ApiSuccess<Profile>>("/api/v1/profile/avatar", { dataUrl }).then(profileData);
}

export function removeProfileAvatar(): Promise<Profile> {
  return http.delete<ApiSuccess<Profile>>("/api/v1/profile/avatar").then(profileData);
}

import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export interface ContactCustomer {
  id: string;
  customerNumber: string;
  displayName: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface ContactRow {
  id: string;
  customerId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  jobTitle: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  status: "ACTIVE" | "INACTIVE";
  notes: string | null;
  createdAt: string;
  customer: ContactCustomer;
}

export interface Page<T> {
  items: T[];
  pageInfo: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}

export interface ContactWrite {
  firstName: string;
  lastName: string;
  displayName?: string;
  jobTitle?: string;
  department?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  isPrimary?: boolean;
  status?: "ACTIVE" | "INACTIVE";
  notes?: string;
}

function data<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data as T);
}

export function listOrgContacts(params: Record<string, string | number | boolean | undefined>): Promise<Page<ContactRow>> {
  return data(http.get<ApiSuccess<Page<ContactRow>>>("/api/v1/contacts", { params }));
}

export function createContact(customerId: string, body: ContactWrite): Promise<ContactRow> {
  return data(http.post(`/api/v1/customers/${customerId}/contacts`, body));
}

export function deleteContact(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/contacts/${id}`));
}

export function updateContact(id: string, body: Partial<ContactWrite>): Promise<ContactRow> {
  return data(http.patch(`/api/v1/contacts/${id}`, body));
}

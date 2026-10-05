import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export interface CustomerSummary {
  id: string;
  customerNumber: string;
  customerType: "COMPANY" | "INDIVIDUAL";
  legalName: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  countryCode: string;
  currencyCode: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  contacts?: Array<{ id: string; displayName: string; email: string | null }>;
}

export interface CustomerAddress {
  id: string;
  purpose: "BILLING" | "SHIPPING";
  isPrimary: boolean;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  countryCode: string;
}

export interface CustomerDetail extends CustomerSummary {
  website: string | null;
  taxNumber: string | null;
  notes: string | null;
  addresses: CustomerAddress[];
}

export interface Contact {
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
}

export interface Page<T> {
  items: T[];
  pageInfo: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}

export interface CustomerWrite {
  customerType: "COMPANY" | "INDIVIDUAL";
  legalName: string;
  displayName: string;
  email?: string;
  phone?: string;
  website?: string;
  countryCode: string;
  currencyCode: string;
  taxNumber?: string;
  status?: "ACTIVE" | "INACTIVE";
  notes?: string;
}

export interface AddressWrite {
  purpose: "BILLING" | "SHIPPING";
  isPrimary?: boolean;
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  countryCode: string;
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

export interface AuditEvent {
  id: string;
  action: string;
  module: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

function data<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data as T);
}

export function listCustomers(params: Record<string, string | number | undefined>): Promise<Page<CustomerSummary>> {
  return data(http.get<ApiSuccess<Page<CustomerSummary>>>("/api/v1/customers", { params }));
}

export function getCustomer(id: string): Promise<CustomerDetail> {
  return data(http.get<ApiSuccess<CustomerDetail>>(`/api/v1/customers/${id}`));
}

export function createCustomer(body: CustomerWrite): Promise<{ customer: CustomerDetail; possibleDuplicate: boolean }> {
  return data(http.post("/api/v1/customers", body));
}

export function updateCustomer(id: string, body: CustomerWrite): Promise<CustomerDetail> {
  return data(http.patch(`/api/v1/customers/${id}`, body));
}

export function deleteCustomer(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/customers/${id}`));
}

export function restoreCustomer(id: string): Promise<CustomerDetail> {
  return data(http.post(`/api/v1/customers/${id}/restore`));
}

export function createAddress(customerId: string, body: AddressWrite): Promise<CustomerAddress> {
  return data(http.post(`/api/v1/customers/${customerId}/addresses`, body));
}

export function deleteAddress(customerId: string, addressId: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/customers/${customerId}/addresses/${addressId}`));
}

export function listContacts(customerId: string): Promise<Page<Contact>> {
  return data(http.get(`/api/v1/customers/${customerId}/contacts`, { params: { limit: 100 } }));
}

export function createContact(customerId: string, body: ContactWrite): Promise<Contact> {
  return data(http.post(`/api/v1/customers/${customerId}/contacts`, body));
}

export function updateContact(id: string, body: Partial<ContactWrite>): Promise<Contact> {
  return data(http.patch(`/api/v1/contacts/${id}`, body));
}

export function deleteContact(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/contacts/${id}`));
}

export function listCustomerAudit(customerId: string): Promise<Page<AuditEvent>> {
  return data(
    http.get("/api/v1/audit-logs", {
      params: { subjectId: customerId, limit: 20 },
    }),
  );
}

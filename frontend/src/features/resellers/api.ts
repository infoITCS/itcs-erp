import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export type ResellerStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface ResellerSummary {
  id: string;
  resellerNumber: string;
  legalName: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  countryCode: string;
  currencyCode: string;
  status: ResellerStatus;
  priceListCode: string;
  createdAt: string;
  contacts?: Array<{ id: string; displayName: string; email: string | null }>;
  _count?: { customers: number };
}

export interface ResellerAddress {
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

export interface ResellerContact {
  id: string;
  resellerId: string;
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

export interface ResellerDetail extends ResellerSummary {
  website: string | null;
  taxNumber: string | null;
  defaultDiscountPercent: string | null;
  defaultCommissionPercent: string | null;
  notes: string | null;
  addresses: ResellerAddress[];
  contacts: ResellerContact[];
}

export interface LinkedCustomer {
  id: string;
  customerNumber: string;
  displayName: string;
  legalName: string;
  status: "ACTIVE" | "INACTIVE";
  email: string | null;
  countryCode: string;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  pageInfo: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}

export interface ResellerWrite {
  legalName: string;
  displayName: string;
  email?: string;
  phone?: string;
  website?: string;
  countryCode: string;
  currencyCode: string;
  taxNumber?: string;
  status?: ResellerStatus;
  priceListCode?: string;
  defaultDiscountPercent?: string;
  defaultCommissionPercent?: string;
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

export function listResellers(params: Record<string, string | number | undefined>): Promise<Page<ResellerSummary>> {
  return data(http.get<ApiSuccess<Page<ResellerSummary>>>("/api/v1/resellers", { params }));
}

export function getReseller(id: string): Promise<ResellerDetail> {
  return data(http.get<ApiSuccess<ResellerDetail>>(`/api/v1/resellers/${id}`));
}

export function createReseller(body: ResellerWrite): Promise<ResellerDetail> {
  return data(http.post("/api/v1/resellers", body));
}

export function updateReseller(id: string, body: Partial<ResellerWrite>): Promise<ResellerDetail> {
  return data(http.patch(`/api/v1/resellers/${id}`, body));
}

export function deleteReseller(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/resellers/${id}`));
}

export function restoreReseller(id: string): Promise<ResellerDetail> {
  return data(http.post(`/api/v1/resellers/${id}/restore`));
}

export function createAddress(resellerId: string, body: AddressWrite): Promise<ResellerAddress> {
  return data(http.post(`/api/v1/resellers/${resellerId}/addresses`, body));
}

export function deleteAddress(resellerId: string, addressId: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/resellers/${resellerId}/addresses/${addressId}`));
}

export function listContacts(resellerId: string): Promise<Page<ResellerContact>> {
  return data(http.get(`/api/v1/resellers/${resellerId}/contacts`, { params: { limit: 100 } }));
}

export function createContact(resellerId: string, body: ContactWrite): Promise<ResellerContact> {
  return data(http.post(`/api/v1/resellers/${resellerId}/contacts`, body));
}

export function updateContact(id: string, body: Partial<ContactWrite>): Promise<ResellerContact> {
  return data(http.patch(`/api/v1/reseller-contacts/${id}`, body));
}

export function deleteContact(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/reseller-contacts/${id}`));
}

export function listResellerCustomers(resellerId: string): Promise<Page<LinkedCustomer>> {
  return data(http.get(`/api/v1/resellers/${resellerId}/customers`, { params: { limit: 100 } }));
}

export function assignCustomer(resellerId: string, customerId: string): Promise<LinkedCustomer> {
  return data(http.post(`/api/v1/resellers/${resellerId}/customers/${customerId}`));
}

export function unassignCustomer(resellerId: string, customerId: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/resellers/${resellerId}/customers/${customerId}`));
}

export function listResellerAudit(resellerId: string): Promise<Page<AuditEvent>> {
  return data(http.get("/api/v1/audit-logs", { params: { subjectId: resellerId, limit: 20 } }));
}

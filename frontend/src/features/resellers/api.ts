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
  defaultDiscountPercent: string | null;
  defaultCommissionPercent: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contacts?: Array<{ id: string; displayName: string; email: string | null }>;
  _count?: { customers: number };
}

export interface ResellerAddress {
  id: string;
  resellerId: string;
  purpose: "BILLING" | "SHIPPING";
  isPrimary: boolean;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  countryCode: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResellerDetail extends ResellerSummary {
  website: string | null;
  taxNumber: string | null;
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
  resellerId: string | null;
}

export interface Page<T> {
  items: T[];
  pageInfo: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}

export interface ResellerListParams {
  q?: string;
  status?: ResellerStatus;
  country?: string;
  from?: string;
  to?: string;
  sort?: "createdAt" | "displayName" | "resellerNumber";
  order?: "asc" | "desc";
  includeDeleted?: boolean;
  cursor?: string;
  limit?: number;
}

export interface ResellerFormOptions {
  currencies: Array<{ code: string; name: string }>;
  countries: string[];
  priceLists: string[];
}

export interface ResellerWrite {
  legalName: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  countryCode: string;
  currencyCode: string;
  taxNumber?: string | null;
  status?: ResellerStatus;
  priceListCode?: string;
  defaultDiscountPercent?: string | null;
  defaultCommissionPercent?: string | null;
  notes?: string | null;
  addresses?: AddressWrite[];
  primaryContact?: ContactWrite;
}

export interface AddressWrite {
  purpose: "BILLING" | "SHIPPING";
  isPrimary?: boolean;
  label?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode?: string | null;
  countryCode: string;
}

export type AddressUpdate = Partial<AddressWrite>;

export interface ContactWrite {
  firstName: string;
  lastName: string;
  displayName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  isPrimary?: boolean;
  status?: "ACTIVE" | "INACTIVE";
  notes?: string | null;
}

export interface AuditEvent {
  id: string;
  action: string;
  module: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  user?: { firstName?: string; lastName?: string; email?: string } | null;
}

function data<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data as T);
}

export function listResellers(params: ResellerListParams = {}): Promise<Page<ResellerSummary>> {
  return data(http.get<ApiSuccess<Page<ResellerSummary>>>("/api/v1/resellers", { params }));
}

export function getResellerFormOptions(): Promise<ResellerFormOptions> {
  return data(http.get<ApiSuccess<ResellerFormOptions>>("/api/v1/resellers/form-options"));
}

export function getReseller(id: string): Promise<ResellerDetail> {
  return data(http.get<ApiSuccess<ResellerDetail>>(`/api/v1/resellers/${id}`));
}

export function createReseller(body: ResellerWrite): Promise<ResellerDetail> {
  return data(http.post<ApiSuccess<ResellerDetail>>("/api/v1/resellers", body));
}

export function updateReseller(id: string, body: Partial<ResellerWrite>): Promise<ResellerDetail> {
  return data(http.patch<ApiSuccess<ResellerDetail>>(`/api/v1/resellers/${id}`, body));
}

export function deleteReseller(id: string): Promise<{ id: string; deletedAt: string }> {
  return data(http.delete<ApiSuccess<{ id: string; deletedAt: string }>>(`/api/v1/resellers/${id}`));
}

export function restoreReseller(id: string): Promise<ResellerDetail> {
  return data(http.post<ApiSuccess<ResellerDetail>>(`/api/v1/resellers/${id}/restore`));
}

export function listAddresses(resellerId: string): Promise<ResellerAddress[]> {
  return data(http.get<ApiSuccess<ResellerAddress[]>>(`/api/v1/resellers/${resellerId}/addresses`));
}

export function createAddress(resellerId: string, body: AddressWrite): Promise<ResellerAddress> {
  return data(http.post<ApiSuccess<ResellerAddress>>(`/api/v1/resellers/${resellerId}/addresses`, body));
}

export function updateAddress(resellerId: string, addressId: string, body: AddressUpdate): Promise<ResellerAddress> {
  return data(http.patch<ApiSuccess<ResellerAddress>>(`/api/v1/resellers/${resellerId}/addresses/${addressId}`, body));
}

export function deleteAddress(resellerId: string, addressId: string): Promise<{ id: string }> {
  return data(http.delete<ApiSuccess<{ id: string }>>(`/api/v1/resellers/${resellerId}/addresses/${addressId}`));
}

export function listContacts(resellerId: string, params: { limit?: number; cursor?: string; includeDeleted?: boolean } = {}): Promise<Page<ResellerContact>> {
  return data(http.get<ApiSuccess<Page<ResellerContact>>>(`/api/v1/resellers/${resellerId}/contacts`, { params }));
}

export function createContact(resellerId: string, body: ContactWrite): Promise<ResellerContact> {
  return data(http.post<ApiSuccess<ResellerContact>>(`/api/v1/resellers/${resellerId}/contacts`, body));
}

export function updateContact(id: string, body: Partial<ContactWrite>): Promise<ResellerContact> {
  return data(http.patch<ApiSuccess<ResellerContact>>(`/api/v1/reseller-contacts/${id}`, body));
}

export function deleteContact(id: string): Promise<{ id: string }> {
  return data(http.delete<ApiSuccess<{ id: string }>>(`/api/v1/reseller-contacts/${id}`));
}

export function listResellerCustomers(resellerId: string, params: { limit?: number; cursor?: string } = {}): Promise<Page<LinkedCustomer>> {
  return data(http.get<ApiSuccess<Page<LinkedCustomer>>>(`/api/v1/resellers/${resellerId}/customers`, { params }));
}

export function assignCustomer(resellerId: string, customerId: string): Promise<LinkedCustomer> {
  return data(http.post<ApiSuccess<LinkedCustomer>>(`/api/v1/resellers/${resellerId}/customers/${customerId}`));
}

export function unassignCustomer(resellerId: string, customerId: string): Promise<{ id: string }> {
  return data(http.delete<ApiSuccess<{ id: string }>>(`/api/v1/resellers/${resellerId}/customers/${customerId}`));
}

export function listResellerAudit(resellerId: string, params: { limit?: number; cursor?: string } = {}): Promise<Page<AuditEvent>> {
  return data(http.get<ApiSuccess<Page<AuditEvent>>>(`/api/v1/resellers/${resellerId}/audit`, { params }));
}

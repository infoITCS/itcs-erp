import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";
import type { CurrencyRef, Page, PaymentTermRef, TaxCodeOption } from "../sales/shared.tsx";

export const VENDOR_PERMISSIONS = {
  read: "vendors:read",
  create: "vendors:create",
  update: "vendors:update",
  delete: "vendors:delete",
  restore: "vendors:restore",
} as const;

export type VendorStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export const VENDOR_STATUSES: VendorStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED"];

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
};

export interface VendorOption {
  id: string;
  code?: string | null;
  name?: string;
  displayName?: string;
  legalName?: string | null;
  currencyCode: string;
  paymentTermId?: string | null;
  status: VendorStatus;
  email?: string | null;
}

export interface VendorFormOptions {
  currencies: CurrencyRef[];
  paymentTerms: PaymentTermRef[];
  taxCodes: TaxCodeOption[];
  statuses: Array<{ value: VendorStatus; label: string }>;
}

export interface Vendor {
  id: string;
  organizationId?: string;
  code?: string | null;
  name: string;
  legalName?: string | null;
  displayName?: string | null;
  status: VendorStatus;
  vendorType?: string | null;
  category?: string | null;
  currencyCode: string;
  paymentTermId?: string | null;
  taxCodeId?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  bankAccount?: string | null;
  notes?: string | null;
  paymentTerm?: PaymentTermRef | null;
  taxCode?: TaxCodeOption | null;
  createdById?: string;
  updatedById?: string;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorWrite {
  code?: string;
  name: string;
  legalName?: string;
  displayName?: string;
  status: VendorStatus;
  vendorType?: string;
  category?: string;
  currencyCode: string;
  paymentTermId?: string;
  taxCodeId?: string;
  taxId?: string;
  registrationNumber?: string;
  website?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  countryCode?: string;
  bankAccount?: string;
  notes?: string;
}

function data<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data as T);
}

export function listVendors(params: Record<string, string | number | boolean | undefined>): Promise<Page<Vendor>> {
  return data(http.get<ApiSuccess<Page<Vendor>>>("/api/v1/vendors", { params }));
}

export function getVendorFormOptions(): Promise<VendorFormOptions> {
  return data(http.get<ApiSuccess<VendorFormOptions>>("/api/v1/vendors/form-options"));
}

export function getVendor(id: string): Promise<Vendor> {
  return data(http.get<ApiSuccess<Vendor>>(`/api/v1/vendors/${id}`));
}

export function createVendor(body: VendorWrite): Promise<Vendor> {
  return data(http.post("/api/v1/vendors", body));
}

export function updateVendor(id: string, body: Partial<VendorWrite>): Promise<Vendor> {
  return data(http.patch(`/api/v1/vendors/${id}`, body));
}

export function deleteVendor(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/vendors/${id}`));
}

export function restoreVendor(id: string): Promise<Vendor> {
  return data(http.post(`/api/v1/vendors/${id}/restore`));
}

import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export const TENDER_STATUSES = [
  "DRAFT",
  "OPEN",
  "SUBMITTED",
  "WON",
  "LOST",
  "CANCELLED",
] as const;

export type TenderStatus = (typeof TENDER_STATUSES)[number];

export const CLOSED_TENDER_STATUSES: TenderStatus[] = ["WON", "LOST", "CANCELLED"];

export interface TenderCustomerRef {
  id: string;
  customerNumber: string;
  displayName: string;
  status: "ACTIVE" | "INACTIVE" | "HOLD";
  email: string | null;
}

export interface TenderContactRef {
  id: string;
  displayName: string;
  email: string | null;
}

export interface TenderOwnerRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Tender {
  id: string;
  organizationId: string;
  tenderNumber: string;
  title: string;
  description: string | null;
  referenceNumber: string | null;
  status: TenderStatus;
  customerId: string;
  contactId: string | null;
  ownerUserId: string;
  estimatedValue: string;
  currencyCode: string;
  exchangeRateToBase: string | null;
  estimatedValueBase: string | null;
  baseCurrencyCode: string | null;
  submissionDeadline: string | null;
  expectedAwardDate: string | null;
  notes: string | null;
  createdById: string;
  updatedById: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: TenderCustomerRef | null;
  contact: TenderContactRef | null;
  owner: TenderOwnerRef | null;
}

export interface TenderFormOptions {
  customers: TenderCustomerRef[];
  owners: TenderOwnerRef[];
  statuses: TenderStatus[];
}

export interface Page<T> {
  items: T[];
  pageInfo: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}

export interface TenderListParams {
  q?: string;
  status?: TenderStatus;
  customerId?: string;
  ownerUserId?: string;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
  cursor?: string;
  limit?: number;
  sort?: "createdAt" | "title" | "tenderNumber";
  order?: "asc" | "desc";
}

export interface TenderCreateWrite {
  title: string;
  description?: string;
  referenceNumber?: string;
  status?: TenderStatus;
  customerId: string;
  contactId?: string;
  ownerUserId?: string;
  estimatedValue?: string;
  currencyCode: string;
  submissionDeadline?: string;
  expectedAwardDate?: string;
  notes?: string;
}

export interface TenderUpdateWrite {
  title?: string;
  description?: string | null;
  referenceNumber?: string | null;
  status?: TenderStatus;
  customerId?: string;
  contactId?: string | null;
  ownerUserId?: string;
  estimatedValue?: string;
  currencyCode?: string;
  submissionDeadline?: string | null;
  expectedAwardDate?: string | null;
  notes?: string | null;
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

export function listTenders(
  params: Record<string, string | number | boolean | undefined>,
): Promise<Page<Tender>> {
  return data(http.get<ApiSuccess<Page<Tender>>>("/api/v1/tenders", { params }));
}

export function getTenderFormOptions(): Promise<TenderFormOptions> {
  return data(http.get<ApiSuccess<TenderFormOptions>>("/api/v1/tenders/form-options"));
}

export function getTender(id: string): Promise<Tender> {
  return data(http.get<ApiSuccess<Tender>>(`/api/v1/tenders/${id}`));
}

export function createTender(body: TenderCreateWrite): Promise<Tender> {
  return data(http.post("/api/v1/tenders", body));
}

export function updateTender(id: string, body: TenderUpdateWrite): Promise<Tender> {
  return data(http.patch(`/api/v1/tenders/${id}`, body));
}

export function deleteTender(id: string): Promise<{ id: string; deletedAt: string }> {
  return data(http.delete(`/api/v1/tenders/${id}`));
}

export function restoreTender(id: string): Promise<Tender> {
  return data(http.post(`/api/v1/tenders/${id}/restore`));
}

export function listTenderAudit(id: string): Promise<Page<AuditEvent>> {
  return data(http.get(`/api/v1/tenders/${id}/audit`, { params: { limit: 20 } }));
}

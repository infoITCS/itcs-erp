import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";
import type {
  AuditEvent,
  CurrencyRef,
  CustomerOption,
  DocumentLine,
  DocumentLineInput,
  OwnerRef,
  Page,
  PaymentTermRef,
  ProductOption,
  TaxCodeOption,
} from "../sales/shared.tsx";

export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";

export const QUOTE_STATUSES: QuoteStatus[] = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
];

export const MANUAL_QUOTE_STATUSES: QuoteStatus[] = ["SENT", "REJECTED", "EXPIRED", "CANCELLED"];

export const QUOTE_STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["REJECTED", "EXPIRED", "CANCELLED"],
  ACCEPTED: [],
  REJECTED: ["DRAFT"],
  EXPIRED: ["DRAFT"],
  CANCELLED: [],
};

export const QUOTES_PERMISSIONS = {
  read: "quotes:read",
  create: "quotes:create",
  update: "quotes:update",
  delete: "quotes:delete",
  restore: "quotes:restore",
  convert: "sales-orders:create",
};

export interface QuoteCustomerRef {
  id: string;
  customerNumber: string;
  displayName: string;
  email: string | null;
  status: string;
}

export interface Quote {
  id: string;
  organizationId: string;
  quoteNumber: string;
  customerId: string;
  contactId: string | null;
  opportunityId: string | null;
  ownerUserId: string;
  status: QuoteStatus;
  issueDate: string;
  validUntil: string | null;
  customerReference: string | null;
  currencyCode: string;
  exchangeRateToBase: string | null;
  baseCurrencyCode: string | null;
  paymentTermId: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  totalBase: string | null;
  notes: string | null;
  terms: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  createdById: string;
  updatedById: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: QuoteCustomerRef;
  contact?: { id: string; displayName: string; email: string | null } | null;
  opportunity?: { id: string; opportunityNumber: string; title: string; stage: string } | null;
  owner?: OwnerRef | null;
  currency?: CurrencyRef | null;
  paymentTerm?: PaymentTermRef | null;
  lines?: DocumentLine[];
  salesOrders?: Array<{ id: string; salesOrderNumber: string; status: string; total: string }>;
  _count?: { lines: number; salesOrders: number };
}

export interface QuoteFormOptions {
  customers: CustomerOption[];
  owners: OwnerRef[];
  currencies: CurrencyRef[];
  paymentTerms: PaymentTermRef[];
  taxCodes: TaxCodeOption[];
  products: ProductOption[];
  statuses: Array<{ value: QuoteStatus; label: string }>;
}

export interface QuoteCreateWrite {
  customerId: string;
  contactId?: string;
  opportunityId?: string;
  ownerUserId?: string;
  issueDate?: string;
  validUntil?: string;
  customerReference?: string;
  currencyCode?: string;
  paymentTermId?: string;
  notes?: string;
  terms?: string;
  lines: DocumentLineInput[];
}

export interface QuoteUpdateWrite extends Partial<Omit<QuoteCreateWrite, "lines">> {
  lines?: DocumentLineInput[];
}

export interface QuoteListParams {
  q?: string;
  status?: string;
  customerId?: string;
  ownerUserId?: string;
  includeDeleted?: boolean;
  cursor?: string;
  limit?: number;
}

function data<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data as T);
}

export function listQuotes(params: Record<string, string | number | boolean | undefined>): Promise<Page<Quote>> {
  return data(http.get<ApiSuccess<Page<Quote>>>("/api/v1/quotes", { params }));
}

export function getQuoteFormOptions(): Promise<QuoteFormOptions> {
  return data(http.get<ApiSuccess<QuoteFormOptions>>("/api/v1/quotes/form-options"));
}

export function getQuote(id: string): Promise<Quote> {
  return data(http.get<ApiSuccess<Quote>>(`/api/v1/quotes/${id}`));
}

export function createQuote(body: QuoteCreateWrite): Promise<Quote> {
  return data(http.post("/api/v1/quotes", body));
}

export function updateQuote(id: string, body: QuoteUpdateWrite): Promise<Quote> {
  return data(http.patch(`/api/v1/quotes/${id}`, body));
}

export function deleteQuote(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/quotes/${id}`));
}

export function restoreQuote(id: string): Promise<Quote> {
  return data(http.post(`/api/v1/quotes/${id}/restore`));
}

export function changeQuoteStatus(id: string, status: QuoteStatus): Promise<Quote> {
  return data(http.post(`/api/v1/quotes/${id}/status`, { status }));
}

export function convertQuoteToOrder(id: string): Promise<Quote> {
  return data(http.post(`/api/v1/quotes/${id}/convert-to-order`, {}));
}

export function listQuoteAudit(id: string): Promise<Page<AuditEvent>> {
  return data(http.get(`/api/v1/quotes/${id}/audit`, { params: { limit: 20 } }));
}

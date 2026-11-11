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

export type SalesOrderStatus = "DRAFT" | "CONFIRMED" | "PROCESSING" | "FULFILLED" | "CLOSED" | "CANCELLED";

export const SALES_ORDER_STATUSES: SalesOrderStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "PROCESSING",
  "FULFILLED",
  "CLOSED",
  "CANCELLED",
];

export const SALES_ORDER_STATUS_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "FULFILLED", "CANCELLED"],
  PROCESSING: ["FULFILLED", "CANCELLED"],
  FULFILLED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export interface SalesOrder {
  id: string;
  organizationId: string;
  salesOrderNumber: string;
  sourceQuoteId: string | null;
  customerId: string;
  contactId: string | null;
  opportunityId: string | null;
  ownerUserId: string;
  status: SalesOrderStatus;
  orderDate: string;
  expectedDeliveryDate: string | null;
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
  confirmedAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  closedAt: string | null;
  createdById: string;
  updatedById: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; customerNumber: string; displayName: string; email: string | null; status: string };
  contact?: { id: string; displayName: string; email: string | null } | null;
  opportunity?: { id: string; opportunityNumber: string; title: string; stage: string } | null;
  sourceQuote?: { id: string; quoteNumber: string; status: string; total: string } | null;
  owner?: OwnerRef | null;
  currency?: CurrencyRef | null;
  paymentTerm?: PaymentTermRef | null;
  lines?: DocumentLine[];
  invoices?: Array<{ id: string; invoiceNumber: string; status: string; issueDate: string; dueDate: string | null; total: string }>;
  _count?: { lines: number; invoices: number };
}

export interface SalesOrderFormOptions {
  customers: CustomerOption[];
  owners: OwnerRef[];
  currencies: CurrencyRef[];
  paymentTerms: PaymentTermRef[];
  taxCodes: TaxCodeOption[];
  products: ProductOption[];
  quotes: Array<{ id: string; quoteNumber: string; customerId: string; currencyCode: string; total: string }>;
  statuses: Array<{ value: SalesOrderStatus; label: string }>;
}

export interface SalesOrderCreateWrite {
  customerId: string;
  sourceQuoteId?: string;
  ownerUserId?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  customerReference?: string;
  currencyCode?: string;
  paymentTermId?: string;
  notes?: string;
  terms?: string;
  lines: DocumentLineInput[];
}

export interface SalesOrderUpdateWrite extends Partial<Omit<SalesOrderCreateWrite, "lines">> {
  lines?: DocumentLineInput[];
}

export interface InvoiceDraft {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
}

function data<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data as T);
}

export function listSalesOrders(params: Record<string, string | number | boolean | undefined>): Promise<Page<SalesOrder>> {
  return data(http.get<ApiSuccess<Page<SalesOrder>>>("/api/v1/sales-orders", { params }));
}

export function getSalesOrderFormOptions(): Promise<SalesOrderFormOptions> {
  return data(http.get<ApiSuccess<SalesOrderFormOptions>>("/api/v1/sales-orders/form-options"));
}

export function getSalesOrder(id: string): Promise<SalesOrder> {
  return data(http.get<ApiSuccess<SalesOrder>>(`/api/v1/sales-orders/${id}`));
}

export function createSalesOrder(body: SalesOrderCreateWrite): Promise<SalesOrder> {
  return data(http.post("/api/v1/sales-orders", body));
}

export function updateSalesOrder(id: string, body: SalesOrderUpdateWrite): Promise<SalesOrder> {
  return data(http.patch(`/api/v1/sales-orders/${id}`, body));
}

export function deleteSalesOrder(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/sales-orders/${id}`));
}

export function restoreSalesOrder(id: string): Promise<SalesOrder> {
  return data(http.post(`/api/v1/sales-orders/${id}/restore`));
}

export function changeSalesOrderStatus(id: string, status: SalesOrderStatus): Promise<SalesOrder> {
  return data(http.post(`/api/v1/sales-orders/${id}/status`, { status }));
}

export function convertSalesOrderToInvoice(
  id: string,
  body: { issueDate?: string; dueDate?: string } = {},
): Promise<{ salesOrder: SalesOrder; invoice: InvoiceDraft }> {
  return data(http.post(`/api/v1/sales-orders/${id}/convert-to-invoice`, body));
}

export function listSalesOrderAudit(id: string): Promise<Page<AuditEvent>> {
  return data(http.get(`/api/v1/sales-orders/${id}/audit`, { params: { limit: 20 } }));
}

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

export type InvoiceStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";

export const INVOICE_STATUSES: InvoiceStatus[] = ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"];

export const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ["SENT", "VOID"],
  SENT: ["PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"],
  PARTIALLY_PAID: ["PAID", "OVERDUE", "VOID"],
  OVERDUE: ["PARTIALLY_PAID", "PAID", "VOID"],
  PAID: [],
  VOID: [],
};

export interface Invoice {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  sourceSalesOrderId: string | null;
  customerId: string;
  contactId: string | null;
  opportunityId: string | null;
  ownerUserId: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
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
  amountPaid: string;
  notes: string | null;
  terms: string | null;
  sentAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  createdById: string;
  updatedById: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; customerNumber: string; displayName: string; email: string | null; status: string };
  contact?: { id: string; displayName: string; email: string | null } | null;
  opportunity?: { id: string; opportunityNumber: string; title: string; stage: string } | null;
  sourceSalesOrder?: { id: string; salesOrderNumber: string; status: string; total: string } | null;
  owner?: OwnerRef | null;
  currency?: CurrencyRef | null;
  paymentTerm?: PaymentTermRef | null;
  lines?: DocumentLine[];
  _count?: { lines: number };
}

export interface InvoiceFormOptions {
  customers: CustomerOption[];
  owners: OwnerRef[];
  currencies: CurrencyRef[];
  paymentTerms: PaymentTermRef[];
  taxCodes: TaxCodeOption[];
  products: ProductOption[];
  salesOrders: Array<{ id: string; salesOrderNumber: string; customerId: string; currencyCode: string; total: string }>;
  statuses: Array<{ value: InvoiceStatus; label: string }>;
}

export interface InvoiceCreateWrite {
  customerId: string;
  sourceSalesOrderId?: string;
  ownerUserId?: string;
  issueDate?: string;
  dueDate?: string;
  customerReference?: string;
  currencyCode?: string;
  paymentTermId?: string;
  notes?: string;
  terms?: string;
  lines: DocumentLineInput[];
}

export interface InvoiceUpdateWrite extends Partial<Omit<InvoiceCreateWrite, "lines">> {
  lines?: DocumentLineInput[];
}

function data<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data as T);
}

export function listInvoices(params: Record<string, string | number | boolean | undefined>): Promise<Page<Invoice>> {
  return data(http.get<ApiSuccess<Page<Invoice>>>("/api/v1/invoices", { params }));
}

export function getInvoiceFormOptions(): Promise<InvoiceFormOptions> {
  return data(http.get<ApiSuccess<InvoiceFormOptions>>("/api/v1/invoices/form-options"));
}

export function getInvoice(id: string): Promise<Invoice> {
  return data(http.get<ApiSuccess<Invoice>>(`/api/v1/invoices/${id}`));
}

export function createInvoice(body: InvoiceCreateWrite): Promise<Invoice> {
  return data(http.post("/api/v1/invoices", body));
}

export function updateInvoice(id: string, body: InvoiceUpdateWrite): Promise<Invoice> {
  return data(http.patch(`/api/v1/invoices/${id}`, body));
}

export function deleteInvoice(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/invoices/${id}`));
}

export function restoreInvoice(id: string): Promise<Invoice> {
  return data(http.post(`/api/v1/invoices/${id}/restore`));
}

export function changeInvoiceStatus(
  id: string,
  body: { status: InvoiceStatus; amountPaid?: string },
): Promise<Invoice> {
  return data(http.post(`/api/v1/invoices/${id}/status`, body));
}

export function listInvoiceAudit(id: string): Promise<Page<AuditEvent>> {
  return data(http.get(`/api/v1/invoices/${id}/audit`, { params: { limit: 20 } }));
}

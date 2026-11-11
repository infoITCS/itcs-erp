import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";
import type { AuditEvent, Page } from "../sales/shared.tsx";

export type PaymentMethod = "BANK_TRANSFER" | "CASH" | "CARD" | "CHEQUE" | "MOBILE_WALLET" | "OTHER";

export const PAYMENT_METHODS: PaymentMethod[] = [
  "BANK_TRANSFER",
  "CASH",
  "CARD",
  "CHEQUE",
  "MOBILE_WALLET",
  "OTHER",
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CARD: "Card",
  CHEQUE: "Cheque",
  MOBILE_WALLET: "Mobile wallet",
  OTHER: "Other",
};

export interface PaymentInvoiceRef {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string | null;
  total: string;
  amountPaid: string;
  currencyCode: string;
}

export interface PaymentCustomerRef {
  id: string;
  customerNumber: string;
  displayName: string;
  email?: string | null;
  status?: string;
}

export interface PaymentUserRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Payment {
  id: string;
  organizationId: string;
  paymentNumber: string;
  invoiceId: string;
  customerId: string;
  receivedDate: string;
  method: PaymentMethod;
  amount: string;
  currencyCode: string;
  reference: string | null;
  notes: string | null;
  createdById: string;
  updatedById: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  invoice?: PaymentInvoiceRef | null;
  customer?: PaymentCustomerRef | null;
  currency?: { code: string; symbol: string | null } | null;
  createdBy?: PaymentUserRef | null;
  updatedBy?: PaymentUserRef | null;
}

export interface PaymentInvoiceOption extends PaymentInvoiceRef {
  customerId: string;
  balance: string;
  customer: { id: string; customerNumber: string; displayName: string };
}

export interface PaymentFormOptions {
  invoices: PaymentInvoiceOption[];
  methods: Array<{ value: PaymentMethod; label: string }>;
}

export interface PaymentCreateWrite {
  invoiceId: string;
  receivedDate?: string;
  method: PaymentMethod;
  amount: string;
  reference?: string;
  notes?: string;
}

export interface PaymentUpdateWrite {
  receivedDate?: string;
  method?: PaymentMethod;
  amount?: string;
  reference?: string | null;
  notes?: string | null;
}

function data<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data as T);
}

export function listPayments(params: Record<string, string | number | undefined>): Promise<Page<Payment>> {
  return data(http.get<ApiSuccess<Page<Payment>>>("/api/v1/payments", { params }));
}

export function getPaymentFormOptions(): Promise<PaymentFormOptions> {
  return data(http.get<ApiSuccess<PaymentFormOptions>>("/api/v1/payments/form-options"));
}

export function getPayment(id: string): Promise<Payment> {
  return data(http.get<ApiSuccess<Payment>>(`/api/v1/payments/${id}`));
}

export function createPayment(body: PaymentCreateWrite): Promise<Payment> {
  return data(http.post("/api/v1/payments", body));
}

export function updatePayment(id: string, body: PaymentUpdateWrite): Promise<Payment> {
  return data(http.patch(`/api/v1/payments/${id}`, body));
}

export function deletePayment(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/payments/${id}`));
}

export function listPaymentAudit(id: string): Promise<Page<AuditEvent>> {
  return data(http.get(`/api/v1/payments/${id}/audit`, { params: { limit: 20 } }));
}

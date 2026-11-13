import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export interface DashboardValueSummary {
  openCount: number;
  openValueBase: string;
}

export interface DashboardInvoiceSummary {
  openCount: number;
  overdueCount: number;
  outstandingBase: string;
  overdueBase: string;
}

export interface DashboardPaymentSummary {
  countThisMonth: number;
  receivedThisMonthBase: string;
}

export interface DashboardLeadSummary {
  totalCount: number;
  openCount: number;
  newCount: number;
  qualifiedCount: number;
}

export interface DashboardStageRow {
  stage: string;
  count: number;
  valueBase: string;
}

export interface DashboardOpportunitySummary {
  openCount: number;
  pipelineValueBase: string;
  weightedPipelineBase: string;
  wonThisMonthCount: number;
  wonThisMonthBase: string;
  stageBreakdown: DashboardStageRow[];
}

export interface DashboardRecentInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string | null;
  total: string;
  totalBase: string | null;
  amountPaid: string;
  currencyCode: string;
  customer: { displayName: string } | null;
}

export interface DashboardRecentPayment {
  id: string;
  paymentNumber: string;
  receivedDate: string;
  method: string;
  amount: string;
  currencyCode: string;
  customer: { displayName: string } | null;
  invoice: { invoiceNumber: string } | null;
}

export interface DashboardRecentLead {
  id: string;
  leadNumber: string;
  displayName: string;
  companyName: string | null;
  status: string;
  priority: string;
  estimatedValue: string;
  currencyCode: string;
  createdAt: string;
}

export interface DashboardSummary {
  generatedAt: string;
  baseCurrencyCode: string;
  sales: {
    quotes: DashboardValueSummary | null;
    orders: DashboardValueSummary | null;
    invoices: DashboardInvoiceSummary | null;
    payments: DashboardPaymentSummary | null;
  } | null;
  crm: {
    leads: DashboardLeadSummary | null;
    opportunities: DashboardOpportunitySummary | null;
  } | null;
  recent: {
    invoices: DashboardRecentInvoice[];
    payments: DashboardRecentPayment[];
    leads: DashboardRecentLead[];
  };
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return http
    .get<ApiSuccess<DashboardSummary>>("/api/v1/dashboard")
    .then((response) => response.data.data as DashboardSummary);
}

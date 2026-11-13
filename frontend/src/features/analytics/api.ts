import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export type AnalyticsRange = "30d" | "90d" | "12m" | "all";

export interface MoneyMetric {
  valueBase: string;
  count: number;
  previousValueBase: string;
  deltaPercent: number | null;
}

export interface OutstandingMetric {
  openCount: number;
  overdueCount: number;
  outstandingBase: string;
  overdueBase: string;
}

export interface PipelineMetric {
  openCount: number;
  pipelineValueBase: string;
  weightedPipelineBase: string;
}

export interface WinRateMetric {
  wonCount: number;
  lostCount: number;
  wonValueBase: string;
  winRatePercent: number;
}

export interface LeadsMetric {
  total: number;
  open: number;
  newCount: number;
  qualifiedCount: number;
  convertedCount: number;
  conversionRatePercent: number;
}

export interface CustomersMetric {
  total: number;
  newThisPeriod: number;
}

export interface QuotesMetric {
  openCount: number;
  openValueBase: string;
  acceptedCount: number;
}

export interface TrendPoint {
  period: string;
  invoicedBase: string;
  collectedBase: string;
}

export interface StageRow {
  stage: string;
  count: number;
  valueBase: string;
}

export interface SourceRow {
  source: string;
  total: number;
  qualified: number;
  converted: number;
}

export interface AgingRow {
  bucket: string;
  count: number;
  valueBase: string;
}

export interface TopCustomer {
  id: string;
  name: string;
  invoicedBase: string;
  invoiceCount: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

export interface AnalyticsReport {
  generatedAt: string;
  baseCurrencyCode: string;
  range: AnalyticsRange;
  period: { from: string | null; to: string };
  kpis: {
    revenue: MoneyMetric | null;
    invoiced: MoneyMetric | null;
    outstanding: OutstandingMetric | null;
    pipeline: PipelineMetric | null;
    winRate: WinRateMetric | null;
    leads: LeadsMetric | null;
    customers: CustomersMetric | null;
    quotes: QuotesMetric | null;
  };
  revenueTrend: TrendPoint[];
  pipelineByStage: StageRow[];
  leadsBySource: SourceRow[];
  invoiceAging: AgingRow[];
  topCustomers: TopCustomer[];
  statusMix: {
    quotes: StatusCount[];
    orders: StatusCount[];
    invoices: StatusCount[];
  };
  funnel: FunnelStage[];
}

export function getAnalytics(range: AnalyticsRange): Promise<AnalyticsReport> {
  return http
    .get<ApiSuccess<AnalyticsReport>>("/api/v1/analytics", { params: { range } })
    .then((response) => response.data.data as AnalyticsReport);
}

import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { NavIcon } from "@/components/layouts/NavIcon.tsx";
import { getAnalytics, type AnalyticsReport } from "@/features/analytics/api.ts";
import { RevenueAreaChart } from "@/features/analytics/charts.tsx";
import { formatMoney, StatusPill } from "@/features/sales/shared.tsx";
import { useHasPermission, useSessionUser } from "@/hooks/useSession.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { fetchHealth } from "@/services/health.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  getDashboardSummary,
  type DashboardOpportunitySummary,
  type DashboardRecentInvoice,
  type DashboardRecentLead,
  type DashboardRecentPayment,
  type DashboardSummary,
} from "./api.ts";

type Tone = "brand" | "emerald" | "amber" | "indigo" | "sky" | "rose";

interface Kpi {
  label: string;
  value: string;
  detail: string;
  path: string;
  iconPath: string;
  tone: Tone;
  badge?: string;
  alert?: string;
  subDetail?: string;
}

const toneStyles: Record<
  Tone,
  {
    iconBg: string;
    iconText: string;
    border: string;
    text: string;
    pill: string;
  }
> = {
  brand: {
    iconBg: "bg-brand-50",
    iconText: "text-brand-700",
    border: "hover:border-brand-300",
    text: "text-brand-800",
    pill: "bg-brand-50 text-brand-700 border-brand-200",
  },
  emerald: {
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-700",
    border: "hover:border-emerald-300",
    text: "text-emerald-800",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  amber: {
    iconBg: "bg-amber-50",
    iconText: "text-amber-700",
    border: "hover:border-amber-300",
    text: "text-amber-800",
    pill: "bg-amber-50 text-amber-700 border-amber-200",
  },
  indigo: {
    iconBg: "bg-indigo-50",
    iconText: "text-indigo-700",
    border: "hover:border-indigo-300",
    text: "text-indigo-800",
    pill: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  sky: {
    iconBg: "bg-sky-50",
    iconText: "text-sky-700",
    border: "hover:border-sky-300",
    text: "text-sky-800",
    pill: "bg-sky-50 text-sky-700 border-sky-200",
  },
  rose: {
    iconBg: "bg-rose-50",
    iconText: "text-rose-700",
    border: "hover:border-rose-300",
    text: "text-rose-800",
    pill: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

function money(value: string | number, currency: string): string {
  return formatMoney(value, currency);
}

function dateOnly(value: string | null | undefined): string {
  if (!value) return "Not set";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value.slice(0, 10);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function monthLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, 1)).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

function humanize(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function Panel({
  title,
  subtitle,
  badge,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:shadow-md ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>
              {badge}
            </div>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6">
          <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
        </svg>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function ExecutiveKpiCard({
  label,
  value,
  detail,
  path,
  iconPath,
  tone,
  badge,
  alert,
  subDetail,
}: Kpi) {
  const styles = toneStyles[tone];
  return (
    <Link
      to={path}
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md ${styles.border}`}
    >
      <div className="relative flex items-start justify-between gap-3">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset transition ${styles.iconBg} ${styles.iconText} ring-slate-900/5 group-hover:scale-110`}
        >
          <NavIcon to={iconPath} className="h-5 w-5" />
        </span>
        {badge ? (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-inset ${styles.pill}`}
          >
            {badge}
          </span>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 transition group-hover:text-slate-700">
            View →
          </span>
        )}
      </div>

      <div className="relative mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        <p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950 tabular-nums">
          {value}
        </p>
      </div>

      <div className="relative mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
        <span className={`font-medium ${styles.text}`}>{detail}</span>
        {subDetail ? <span className="text-slate-400">{subDetail}</span> : null}
      </div>

      {alert ? (
        <div className="relative mt-2 flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          <span>{alert}</span>
        </div>
      ) : null}
    </Link>
  );
}

function CashFlowIntelligenceCard({
  analyticsData,
  currency,
}: {
  analyticsData?: AnalyticsReport;
  currency: string;
}) {
  const trend = analyticsData?.revenueTrend ?? [];
  const chartData = trend.map((point) => ({
    label: monthLabel(point.period),
    invoiced: Number(point.invoicedBase),
    collected: Number(point.collectedBase),
  }));

  const totalInvoiced = trend.reduce((sum, p) => sum + Number(p.invoicedBase), 0);
  const totalCollected = trend.reduce((sum, p) => sum + Number(p.collectedBase), 0);
  const realizationRatio = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

  return (
    <Panel
      title="Revenue & Cash Realization Dynamics"
      subtitle="Trailing 12-month billing trajectory versus actual cash collections"
      badge={
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
          Monthly Velocity
        </span>
      }
      action={
        <Link
          to="/analytics"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
        >
          Detailed Analytics →
        </Link>
      }
    >
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/40 text-center">
        <div className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Total Invoiced (12M)
          </p>
          <p className="mt-1 text-base font-bold tabular-nums text-slate-900 sm:text-lg">
            {money(totalInvoiced, currency)}
          </p>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-blue-600">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span>Billed Out</span>
          </div>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Total Collected (12M)
          </p>
          <p className="mt-1 text-base font-bold tabular-nums text-slate-900 sm:text-lg">
            {money(totalCollected, currency)}
          </p>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-cyan-600">
            <span className="h-2 w-2 rounded-full bg-cyan-500" />
            <span>Cash Inflow</span>
          </div>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Cash Collection Ratio
          </p>
          <p className="mt-1 text-base font-bold tabular-nums text-slate-900 sm:text-lg">
            {realizationRatio.toFixed(1)}%
          </p>
          <p className="mt-1 text-[11px] font-medium text-emerald-600">
            {realizationRatio >= 80 ? "Healthy Inflow" : "Follow-ups Advised"}
          </p>
        </div>
      </div>

      <div className="p-6">
        {chartData.length === 0 ? (
          <EmptyState
            title="Awaiting Transaction History"
            description="As quotes turn into invoices and payments are received, trailing velocity curves will graph here."
          />
        ) : (
          <RevenueAreaChart data={chartData} format={(val) => money(val, currency)} />
        )}
      </div>
    </Panel>
  );
}

function PipelineIntelligenceCard({
  opportunities,
  currency,
}: {
  opportunities: DashboardOpportunitySummary;
  currency: string;
}) {
  const maxCount = Math.max(...opportunities.stageBreakdown.map((row) => row.count), 1);
  return (
    <Panel
      title="Commercial Pipeline Radar"
      subtitle="Deal stage distribution and probability-weighted pipeline"
      action={
        <Link
          to="/opportunities"
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Pipeline →
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-3 p-5 pb-0">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Gross Pipeline
          </p>
          <p className="mt-1 truncate text-lg font-bold tabular-nums text-slate-950">
            {money(opportunities.pipelineValueBase, currency)}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
            {opportunities.openCount} open deals
          </p>
        </div>
        <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700">
            Probability Weighted
          </p>
          <p className="mt-1 truncate text-lg font-bold tabular-nums text-indigo-950">
            {money(opportunities.weightedPipelineBase, currency)}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-indigo-600/90">Expected realization</p>
        </div>
      </div>

      <div className="space-y-3.5 p-5">
        {opportunities.stageBreakdown.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
            No open deals in the pipeline.
          </p>
        ) : (
          opportunities.stageBreakdown.map((row) => (
            <div key={row.stage}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-slate-800">{humanize(row.stage)}</span>
                <span className="tabular-nums font-medium text-slate-600">
                  {row.count} deal{row.count === 1 ? "" : "s"} · {money(row.valueBase, currency)}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-600 transition-all duration-500"
                  style={{ width: `${Math.max((row.count / maxCount) * 100, 6)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mx-5 mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            🏆
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
              Won This Month
            </p>
            <p className="text-sm font-bold tabular-nums text-emerald-950">
              {money(opportunities.wonThisMonthBase, currency)}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
          {opportunities.wonThisMonthCount} Closed Won
        </span>
      </div>
    </Panel>
  );
}

function SalesThroughputPanel({
  summary,
  currency,
  canReadQuotes,
  canReadOrders,
}: {
  summary: DashboardSummary["sales"];
  currency: string;
  canReadQuotes: boolean;
  canReadOrders: boolean;
}) {
  const rows = [
    summary?.quotes && canReadQuotes
      ? {
          label: "Active Proposals / Quotes",
          count: summary.quotes.openCount,
          value: summary.quotes.openValueBase,
          path: "/quotes",
          iconPath: "/quotes",
          tone: "brand" as Tone,
          status: "Customer Evaluation",
        }
      : null,
    summary?.orders && canReadOrders
      ? {
          label: "Confirmed Sales Orders",
          count: summary.orders.openCount,
          value: summary.orders.openValueBase,
          path: "/sales-orders",
          iconPath: "/sales-orders",
          tone: "sky" as Tone,
          status: "Fulfilment & Delivery",
        }
      : null,
  ].filter((row) => row !== null);

  if (rows.length === 0) return null;

  return (
    <Panel
      title="Sales Execution Throughput"
      subtitle="Commercial documents progressing through quote-to-cash"
    >
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.label}>
            <Link
              to={row.path}
              className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50/80"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl p-2.5 ring-1 ring-inset ${toneStyles[row.tone].iconBg} ${toneStyles[row.tone].iconText}`}
                >
                  <NavIcon to={row.iconPath} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {row.count} document{row.count === 1 ? "" : "s"} · {row.status}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-slate-900">
                  {money(row.value, currency)}
                </p>
                <span className="text-[11px] font-semibold text-brand-700">Review →</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function UnifiedActivityHub({
  invoices,
  payments,
  leads,
  currency,
  canReadInvoices,
  canReadPayments,
  canReadLeads,
  canCreateInvoice,
  canCreatePayment,
  canCreateLead,
}: {
  invoices: DashboardRecentInvoice[];
  payments: DashboardRecentPayment[];
  leads: DashboardRecentLead[];
  currency: string;
  canReadInvoices: boolean;
  canReadPayments: boolean;
  canReadLeads: boolean;
  canCreateInvoice: boolean;
  canCreatePayment: boolean;
  canCreateLead: boolean;
}) {
  const tabs: Array<{ id: "invoices" | "payments" | "leads"; label: string; count: number }> = [];
  if (canReadInvoices) {
    tabs.push({ id: "invoices", label: "Invoices", count: invoices.length });
  }
  if (canReadPayments) {
    tabs.push({ id: "payments", label: "Receipts", count: payments.length });
  }
  if (canReadLeads) {
    tabs.push({ id: "leads", label: "Leads", count: leads.length });
  }

  const [activeTab, setActiveTab] = useState<"invoices" | "payments" | "leads">(
    tabs[0]?.id ?? "invoices",
  );

  if (tabs.length === 0) return null;

  const currentTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : (tabs[0]?.id ?? "invoices");

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 bg-slate-50/60 px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Enterprise Activity Ledger</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Real-time feed across billing, collections, and lead acquisitions
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-200/60 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                currentTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Invoices */}
      {currentTab === "invoices" && canReadInvoices && (
        <div>
          {invoices.length === 0 ? (
            <EmptyState
              title="No invoices recorded"
              description="Billing documents generated for customer orders will appear here."
              action={
                canCreateInvoice ? (
                  <Link
                    to="/invoices/new"
                    className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Create Invoice
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/30 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-3">Invoice Number</th>
                    <th className="px-4 py-3">Customer Account</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-6 py-3 text-right">Total & Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((invoice) => {
                    const balance = Math.max(
                      Number(invoice.total) - Number(invoice.amountPaid),
                      0,
                    );
                    return (
                      <tr key={invoice.id} className="transition hover:bg-slate-50/80">
                        <td className="px-6 py-3.5">
                          <Link
                            to={`/invoices/${invoice.id}`}
                            className="font-semibold text-brand-700 hover:underline"
                          >
                            {invoice.invoiceNumber}
                          </Link>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Issued {dateOnly(invoice.issueDate)}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="max-w-[200px] truncate font-medium text-slate-800">
                            {invoice.customer?.displayName ?? "Direct Customer"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusPill status={invoice.status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <p
                            className={
                              invoice.status === "OVERDUE"
                                ? "font-bold text-rose-600"
                                : "text-slate-600"
                            }
                          >
                            {dateOnly(invoice.dueDate)}
                          </p>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <p className="font-bold tabular-nums text-slate-900">
                            {money(invoice.total, invoice.currencyCode || currency)}
                          </p>
                          {balance > 0 ? (
                            <p className="mt-0.5 text-[11px] font-semibold text-amber-600">
                              {money(balance, invoice.currencyCode || currency)} due
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[11px] font-semibold text-emerald-600">
                              ✓ Paid in full
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-slate-100 bg-slate-50/30 px-6 py-3 text-right">
                <Link
                  to="/invoices"
                  className="text-xs font-semibold text-brand-700 hover:text-brand-900"
                >
                  View All Invoices Ledger →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Payments */}
      {currentTab === "payments" && canReadPayments && (
        <div>
          {payments.length === 0 ? (
            <EmptyState
              title="No payments posted"
              description="Customer receipts will appear here once cleared against open accounts."
              action={
                canCreatePayment ? (
                  <Link
                    to="/payments/new"
                    className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Record Payment
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div>
              <ul className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-slate-50/80"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200">
                        <NavIcon to="/payments" className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {payment.customer?.displayName ?? "Customer Payment"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Receipt {payment.paymentNumber}
                          {payment.invoice ? ` · Applied to ${payment.invoice.invoiceNumber}` : ""}{" "}
                          · {dateOnly(payment.receivedDate)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-emerald-700">
                        +{money(payment.amount, payment.currencyCode || currency)}
                      </p>
                      <span className="inline-block mt-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        {humanize(payment.method)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100 bg-slate-50/30 px-6 py-3 text-right">
                <Link
                  to="/payments"
                  className="text-xs font-semibold text-brand-700 hover:text-brand-900"
                >
                  View All Collections →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Leads */}
      {currentTab === "leads" && canReadLeads && (
        <div>
          {leads.length === 0 ? (
            <EmptyState
              title="No leads in pipeline"
              description="New prospect inquiries captured from campaigns or outreach appear here."
              action={
                canCreateLead ? (
                  <Link
                    to="/leads/new"
                    className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Add Lead
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div>
              <ul className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <li
                    key={lead.id}
                    className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-slate-50/80"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                        {lead.displayName.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <Link
                          to={`/leads/${lead.id}`}
                          className="font-semibold text-slate-900 hover:text-indigo-700"
                        >
                          {lead.displayName}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {lead.companyName ? `${lead.companyName} · ` : ""}
                          {lead.leadNumber} · Added {dateTime(lead.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <StatusPill status={lead.status} />
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        Priority: {humanize(lead.priority)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100 bg-slate-50/30 px-6 py-3 text-right">
                <Link
                  to="/leads"
                  className="text-xs font-semibold text-brand-700 hover:text-brand-900"
                >
                  View All Prospect Pipeline →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-44 animate-pulse rounded-3xl bg-slate-900/10" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-36 animate-pulse rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
          >
            <div className="h-9 w-9 rounded-xl bg-slate-100" />
            <div className="mt-4 h-2.5 w-24 rounded bg-slate-100" />
            <div className="mt-2.5 h-6 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl border border-slate-200/80 bg-white" />
    </div>
  );
}

export default function DashboardPage() {
  const user = useSessionUser();
  const canCreateInvoice = useHasPermission("invoices:create");
  const canCreatePayment = useHasPermission("payments:create");
  const canCreateLead = useHasPermission("leads:create");

  const canReadInvoices = useHasPermission("invoices:read");
  const canReadPayments = useHasPermission("payments:read");
  const canReadLeads = useHasPermission("leads:read");
  const canReadOpportunities = useHasPermission("opportunities:read");
  const canReadQuotes = useHasPermission("quotes:read");
  const canReadOrders = useHasPermission("sales-orders:read");
  const canReadReports = useHasPermission(["reports:read", "reports:export"]);
  const canReadCashFlow = canReadReports || (canReadInvoices && canReadPayments);

  const summary = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: getDashboardSummary,
    staleTime: 60_000,
  });

  const analyticsQuery = useQuery({
    queryKey: ["analytics", "dashboard-12m"],
    queryFn: () => getAnalytics("12m"),
    staleTime: 60_000,
    enabled: canReadCashFlow,
  });

  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: fetchHealth,
  });

  const role = user?.roles.includes("admin") ? "Administrator" : user?.roles[0] ?? "Member";
  const today = new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date());

  const data = summary.data;
  const currency = data?.baseCurrencyCode ?? "USD";
  const sales = data?.sales;
  const crm = data?.crm;

  const kpis: Kpi[] = [];

  // 1. Cash Inflow / Collected
  if (sales?.payments && canReadPayments) {
    kpis.push({
      label: "Realized Cash Inflow",
      value: money(sales.payments.receivedThisMonthBase, currency),
      detail: `${sales.payments.countThisMonth} cleared receipt${sales.payments.countThisMonth === 1 ? "" : "s"}`,
      path: "/payments",
      iconPath: "/payments",
      tone: "emerald",
      badge: "This Month",
      subDetail: "Settled",
    });
  }

  // 2. Outstanding AR
  if (sales?.invoices && canReadInvoices) {
    kpis.push({
      label: "Accounts Receivable",
      value: money(sales.invoices.outstandingBase, currency),
      detail: `${sales.invoices.openCount} pending invoice${sales.invoices.openCount === 1 ? "" : "s"}`,
      path: "/invoices",
      iconPath: "/invoices",
      tone: Number(sales.invoices.overdueBase) > 0 ? "rose" : "amber",
      badge: "Total Exposure",
      alert:
        Number(sales.invoices.overdueBase) > 0
          ? `${money(sales.invoices.overdueBase, currency)} overdue`
          : undefined,
      subDetail: "Open AR",
    });
  }

  // 3. Pipeline Value
  if (crm?.opportunities && canReadOpportunities) {
    kpis.push({
      label: "Active Pipeline Value",
      value: money(crm.opportunities.pipelineValueBase, currency),
      detail: `${crm.opportunities.openCount} active negotiation${crm.opportunities.openCount === 1 ? "" : "s"}`,
      path: "/opportunities",
      iconPath: "/opportunities",
      tone: "indigo",
      badge: "Unclosed Deals",
      subDetail: `Weighted: ${money(crm.opportunities.weightedPipelineBase, currency)}`,
    });
  }

  // 4. Win Rate / Deals Won
  if (crm?.opportunities && canReadOpportunities) {
    kpis.push({
      label: "Commercial Win Volume",
      value: money(crm.opportunities.wonThisMonthBase, currency),
      detail: `${crm.opportunities.wonThisMonthCount} closed won deal${crm.opportunities.wonThisMonthCount === 1 ? "" : "s"} this month`,
      path: "/opportunities",
      iconPath: "/opportunities",
      tone: "brand",
      badge: "Closed Won",
      subDetail: "Won Volume",
    });
  } else if (crm?.leads && canReadLeads) {
    kpis.push({
      label: "Active Prospect Pipeline",
      value: String(crm.leads.openCount),
      detail: `${crm.leads.newCount} new inquiries · ${crm.leads.qualifiedCount} qualified`,
      path: "/leads",
      iconPath: "/leads",
      tone: "sky",
      badge: "Inbound",
    });
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      {/* 1. Header */}
      <header className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
                <span className="h-2 w-2 rounded-full bg-brand-600" />
                Operations Overview
              </span>
              <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                Base · {currency}
              </span>
              <span className="rounded-md bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-800 ring-1 ring-inset ring-brand-100">
                {role}
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
              {user ? `Welcome back, ${user.firstName}` : "Dashboard"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Sales, receivables and commercial pipeline activity across your organization.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{today}</span>
              {data ? (
                <>
                  <span>·</span>
                  <span>Updated {dateTime(data.generatedAt)}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                health.isError
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  health.isError ? "bg-rose-500" : "bg-emerald-500"
                }`}
              />
              {health.isPending
                ? "Checking API..."
                : health.isError
                  ? "API Offline"
                  : "API Operational"}
            </span>

            {canReadReports ? (
              <Link
                to="/analytics"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Analytics →
              </Link>
            ) : null}

            <button
              type="button"
              onClick={() => {
                void summary.refetch();
                if (canReadCashFlow) void analyticsQuery.refetch();
              }}
              disabled={summary.isFetching || (canReadCashFlow && analyticsQuery.isFetching)}
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {summary.isFetching || (canReadCashFlow && analyticsQuery.isFetching)
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      {summary.isPending ? <DashboardSkeleton /> : null}

      {summary.isError ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-6 shadow-sm">
          <h2 className="text-sm font-semibold text-rose-900">Dashboard feed connection issue</h2>
          <p className="mt-1 text-sm text-rose-800">{getApiErrorMessage(summary.error)}</p>
          <button
            type="button"
            onClick={() => void summary.refetch()}
            className="mt-3.5 rounded-xl bg-rose-900 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800"
          >
            Retry Connection
          </button>
        </section>
      ) : null}

      {/* 2. Top Executive KPIs */}
      {data && kpis.length > 0 ? (
        <section
          aria-label="Executive Key Indicators"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {kpis.map((kpi) => (
            <ExecutiveKpiCard key={kpi.label} {...kpi} />
          ))}
        </section>
      ) : null}

      {/* Fallback if user has dashboard:read but no sales/crm permission */}
      {data &&
      kpis.length === 0 &&
      !canReadCashFlow &&
      !canReadInvoices &&
      !canReadPayments &&
      !canReadLeads &&
      !canReadOpportunities &&
      !canReadQuotes &&
      !canReadOrders ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <NavIcon to="/" className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">Customized Workspace</h2>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
            Your role has been configured with dedicated operational access. Use the sidebar navigation to explore your active modules.
          </p>
        </div>
      ) : null}

      {/* 3. Middle Tier: Visual Cash Flow Dynamics + Pipeline Intelligence */}
      {data ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(340px,1fr)]">
          {/* Main Visual: 12-Month Cash Realization Chart */}
          <div className="flex min-w-0 flex-col gap-6">
            {canReadCashFlow ? (
              <CashFlowIntelligenceCard
                analyticsData={analyticsQuery.data}
                currency={currency}
              />
            ) : null}

            {/* 4. Unified Enterprise Activity Hub */}
            <UnifiedActivityHub
              invoices={data.recent.invoices}
              payments={data.recent.payments}
              leads={data.recent.leads}
              currency={currency}
              canReadInvoices={canReadInvoices}
              canReadPayments={canReadPayments}
              canReadLeads={canReadLeads}
              canCreateInvoice={canCreateInvoice}
              canCreatePayment={canCreatePayment}
              canCreateLead={canCreateLead}
            />
          </div>

          {/* Right Rail: Commercial Intelligence Radar & Throughput */}
          <aside className="flex min-w-0 flex-col gap-6">
            {crm?.opportunities && canReadOpportunities ? (
              <PipelineIntelligenceCard
                opportunities={crm.opportunities}
                currency={currency}
              />
            ) : null}
            <SalesThroughputPanel
              summary={sales ?? null}
              currency={currency}
              canReadQuotes={canReadQuotes}
              canReadOrders={canReadOrders}
            />
          </aside>
        </div>
      ) : null}
    </section>
  );
}

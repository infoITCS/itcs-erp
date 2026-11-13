import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatMoney } from "@/features/sales/shared.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  getAnalytics,
  type AnalyticsRange,
  type AnalyticsReport,
  type TopCustomer,
} from "./api.ts";
import { HorizontalBars, RevenueAreaChart, SourceDonutChart } from "./charts.tsx";
import {
  Card,
  CardHeader,
  Funnel,
  KpiCard,
  MiniStat,
  StatusSegments,
} from "./visuals.tsx";

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

const REFRESH_MS = 20_000;
const PAGE_SIZE = 5;

function monthLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, 1)).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function exportCsv(report: AnalyticsReport) {
  const rows: (string | number)[][] = [["Metric", "Value"]];
  const { kpis } = report;
  if (kpis.revenue) rows.push(["Revenue collected", kpis.revenue.valueBase]);
  if (kpis.invoiced) rows.push(["Invoiced", kpis.invoiced.valueBase]);
  if (kpis.outstanding) rows.push(["Outstanding", kpis.outstanding.outstandingBase]);
  if (kpis.pipeline) rows.push(["Open pipeline", kpis.pipeline.pipelineValueBase]);
  if (kpis.winRate) rows.push(["Win rate %", kpis.winRate.winRatePercent]);
  if (kpis.leads) rows.push(["Leads", kpis.leads.total]);
  if (kpis.customers) rows.push(["Customers", kpis.customers.total]);
  if (kpis.quotes) rows.push(["Open quotes", kpis.quotes.openCount]);
  rows.push([]);
  rows.push(["Top customers"]);
  rows.push(["Customer", "Invoices", "Invoiced"]);
  report.topCustomers.forEach((customer) =>
    rows.push([customer.name, customer.invoiceCount, customer.invoicedBase]),
  );

  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `analytics-${report.range}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function RangeSelect({
  value,
  onChange,
}: {
  value: AnalyticsRange;
  onChange: (value: AnalyticsRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = RANGES.find((option) => option.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-50"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4.5" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 2.5v4M16 2.5v4" />
        </svg>
        {current?.label ?? value}
        <svg viewBox="0 0 24 24" className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {RANGES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                value === option.value
                  ? "bg-blue-50 font-semibold text-blue-600"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option.label}
              {value === option.value ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("90d");
  const [live, setLive] = useState(true);
  const now = useNow();

  const query = useQuery({
    queryKey: ["analytics", range],
    queryFn: () => getAnalytics(range),
    refetchInterval: live ? REFRESH_MS : false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const report = query.data;
  const currency = report?.baseCurrencyCode ?? "USD";
  const money = (value: number) => formatMoney(value, currency);
  const secondsAgo = report
    ? Math.max(0, Math.floor((now - new Date(report.generatedAt).getTime()) / 1000))
    : 0;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 md:text-2xl">
            Analytics Overview
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                {live ? (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                ) : null}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    live ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
              </span>
              {live ? "Live" : "Paused"}
            </span>
            {report ? (
              <span>
                Updated {secondsAgo}s ago{live ? ` · auto-refresh ${REFRESH_MS / 1000}s` : ""}
              </span>
            ) : (
              <span>Revenue, pipeline and CRM intelligence</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RangeSelect value={range} onChange={setRange} />
          <button
            type="button"
            onClick={() => (report ? exportCsv(report) : undefined)}
            disabled={!report}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Export
          </button>
          <button
            type="button"
            onClick={() => void query.refetch()}
            aria-label="Refresh"
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors duration-200 hover:bg-slate-50 hover:text-slate-700"
          >
            <svg viewBox="0 0 24 24" className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setLive((state) => !state)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-50"
          >
            {live ? "Pause" : "Resume"}
          </button>
        </div>
      </header>

      {query.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-sm font-medium text-rose-600">{getApiErrorMessage(query.error)}</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-3 rounded-lg bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600"
          >
            Try again
          </button>
        </div>
      ) : null}

      {!report && !query.isError ? <AnalyticsSkeleton /> : null}

      {report ? <AnalyticsBody report={report} money={money} currency={currency} /> : null}
    </div>
  );
}

function AnalyticsBody({
  report,
  money,
  currency,
}: {
  report: AnalyticsReport;
  money: (value: number) => string;
  currency: string;
}) {
  const { kpis } = report;

  const cards = [
    kpis.revenue
      ? {
          key: "revenue",
          label: "Revenue collected",
          value: Number(kpis.revenue.valueBase),
          format: money,
          delta: kpis.revenue.deltaPercent,
          sub: `${kpis.revenue.count} payments`,
          tone: "bg-emerald-50 text-emerald-600",
          icon: <Glyph><path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></Glyph>,
        }
      : null,
    kpis.invoiced
      ? {
          key: "invoiced",
          label: "Invoiced",
          value: Number(kpis.invoiced.valueBase),
          format: money,
          delta: kpis.invoiced.deltaPercent,
          sub: `${kpis.invoiced.count} invoices`,
          tone: "bg-blue-50 text-blue-600",
          icon: <Glyph><path d="M6 2v20l3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2Z" /><path d="M9 9h6M9 13h6" /></Glyph>,
        }
      : null,
    kpis.outstanding
      ? {
          key: "outstanding",
          label: "Outstanding",
          value: Number(kpis.outstanding.outstandingBase),
          format: money,
          delta: null,
          sub: `${kpis.outstanding.overdueCount} overdue · ${money(Number(kpis.outstanding.overdueBase))}`,
          tone: "bg-amber-50 text-amber-600",
          icon: <Glyph><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Glyph>,
        }
      : null,
    kpis.pipeline
      ? {
          key: "pipeline",
          label: "Open pipeline",
          value: Number(kpis.pipeline.pipelineValueBase),
          format: money,
          delta: null,
          sub: `Weighted ${money(Number(kpis.pipeline.weightedPipelineBase))}`,
          tone: "bg-violet-50 text-violet-600",
          icon: <Glyph><path d="M3 4h18l-7 8v6l-4 2v-8L3 4Z" /></Glyph>,
        }
      : null,
  ].filter(Boolean) as {
    key: string;
    label: string;
    value: number;
    format: (value: number) => string;
    delta: number | null;
    sub: string;
    tone: string;
    icon: ReactNode;
  }[];

  const stats = [
    kpis.winRate
      ? {
          key: "winRate",
          label: "Win rate",
          value: `${kpis.winRate.winRatePercent.toFixed(1)}%`,
          sub: `${kpis.winRate.wonCount} won · ${kpis.winRate.lostCount} lost`,
          tone: "bg-cyan-50 text-cyan-600",
          icon: <Glyph><path d="M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0V4Z" /><path d="M6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3" /></Glyph>,
        }
      : null,
    kpis.leads
      ? {
          key: "leads",
          label: "Leads",
          value: kpis.leads.total.toLocaleString("en-US"),
          sub: `${kpis.leads.newCount} new · ${kpis.leads.conversionRatePercent}% converted`,
          tone: "bg-indigo-50 text-indigo-600",
          icon: <Glyph><path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M19 7v6M22 10h-6" /></Glyph>,
        }
      : null,
    kpis.customers
      ? {
          key: "customers",
          label: "Customers",
          value: kpis.customers.total.toLocaleString("en-US"),
          sub: `+${kpis.customers.newThisPeriod} this period`,
          tone: "bg-sky-50 text-sky-600",
          icon: <Glyph><path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" /><path d="M15 9h3a2 2 0 0 1 2 2v10M3 21h18" /></Glyph>,
        }
      : null,
    kpis.quotes
      ? {
          key: "quotes",
          label: "Open quotes",
          value: kpis.quotes.openCount.toLocaleString("en-US"),
          sub: `${money(Number(kpis.quotes.openValueBase))} · ${kpis.quotes.acceptedCount} accepted`,
          tone: "bg-rose-50 text-rose-600",
          icon: <Glyph><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></Glyph>,
        }
      : null,
  ].filter(Boolean) as {
    key: string;
    label: string;
    value: string;
    sub: string;
    tone: string;
    icon: ReactNode;
  }[];

  const trendPoints = report.revenueTrend.map((point) => ({
    label: monthLabel(point.period),
    invoiced: Number(point.invoicedBase),
    collected: Number(point.collectedBase),
  }));

  return (
    <div className="space-y-5">
      {cards.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <KpiCard
              key={card.key}
              label={card.label}
              value={card.value}
              format={card.format}
              delta={card.delta}
              sub={card.sub}
              tone={card.tone}
              icon={card.icon}
            />
          ))}
        </div>
      ) : null}

      {stats.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <MiniStat
              key={stat.key}
              label={stat.label}
              value={stat.value}
              sub={stat.sub}
              tone={stat.tone}
              icon={stat.icon}
            />
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Revenue vs collected"
            subtitle={`Invoiced vs payments received · last ${report.revenueTrend.length} months`}
            action={
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">
                {currency}
              </span>
            }
          />
          {trendPoints.length > 0 ? (
            <RevenueAreaChart data={trendPoints} format={money} />
          ) : (
            <p className="py-16 text-center text-sm text-slate-400">No billing activity yet.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Leads by source" subtitle="Acquisition mix for the selected range" />
          {report.leadsBySource.length > 0 ? (
            <SourceDonutChart
              data={report.leadsBySource.map((row) => ({
                name: titleCase(row.source),
                value: row.total,
              }))}
            />
          ) : (
            <p className="py-16 text-center text-sm text-slate-400">No leads in this range.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader title="Pipeline by stage" subtitle={`Open opportunities · ${currency}`} />
          {report.pipelineByStage.length > 0 ? (
            <HorizontalBars
              data={report.pipelineByStage.map((row) => ({
                label: titleCase(row.stage),
                value: Number(row.valueBase),
              }))}
              format={money}
              gradientId="analyticsStageGrad"
              from="#3b82f6"
              to="#6366f1"
            />
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">No open pipeline.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Receivables aging" subtitle="Outstanding balances by overdue bucket" />
          {report.invoiceAging.length > 0 ? (
            <HorizontalBars
              data={report.invoiceAging.map((row) => ({
                label: row.bucket,
                value: Number(row.valueBase),
              }))}
              format={money}
              gradientId="analyticsAgingGrad"
              from="#f59e0b"
              to="#f97316"
            />
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">Nothing outstanding.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Conversion funnel" subtitle="From capture to closed-won" />
          <Funnel stages={report.funnel} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Top performing customers" subtitle="By invoiced value in range" />
          {report.topCustomers.length > 0 ? (
            <TopCustomersTable customers={report.topCustomers} money={money} />
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">No invoices in this range.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Document status mix" subtitle="All-time distribution across the sales cycle" />
          <div className="space-y-5">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Quotes</h3>
              <StatusSegments segments={report.statusMix.quotes} />
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Sales orders</h3>
              <StatusSegments segments={report.statusMix.orders} />
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Invoices</h3>
              <StatusSegments segments={report.statusMix.invoices} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function TopCustomersTable({
  customers,
  money,
}: {
  customers: TopCustomer[];
  money: (value: number) => string;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = customers.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const total = customers.reduce((sum, customer) => sum + Number(customer.invoicedBase), 0) || 1;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
              <th className="px-3 py-2.5 font-medium">Customer</th>
              <th className="px-3 py-2.5 text-right font-medium">Invoices</th>
              <th className="px-3 py-2.5 text-right font-medium">Invoiced</th>
              <th className="px-3 py-2.5 text-right font-medium">Share</th>
              <th className="px-3 py-2.5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((customer) => {
              const share = (Number(customer.invoicedBase) / total) * 100;
              const tier =
                share >= 20
                  ? { label: "High", className: "bg-emerald-50 text-emerald-600" }
                  : share >= 8
                    ? { label: "Medium", className: "bg-amber-50 text-amber-600" }
                    : { label: "Low", className: "bg-slate-100 text-slate-500" };
              return (
                <tr key={customer.id} className="text-slate-700 transition-colors duration-150 hover:bg-slate-50">
                  <td className="px-3 py-3 font-medium text-slate-800">{customer.name}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-500">{customer.invoiceCount}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium">
                    {money(Number(customer.invoicedBase))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-500">{share.toFixed(1)}%</td>
                  <td className="px-3 py-3 text-right">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${tier.className}`}>
                      {tier.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {safePage * PAGE_SIZE + 1}-
            {Math.min((safePage + 1) * PAGE_SIZE, customers.length)} of {customers.length}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setPage(safePage - 1)}
              disabled={safePage === 0}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage(safePage + 1)}
              disabled={safePage >= pageCount - 1}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-xl border border-slate-200/80 bg-white" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="h-80 animate-pulse rounded-xl border border-slate-200/80 bg-white xl:col-span-2" />
        <div className="h-80 animate-pulse rounded-xl border border-slate-200/80 bg-white" />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-72 animate-pulse rounded-xl border border-slate-200/80 bg-white" />
        ))}
      </div>
    </div>
  );
}

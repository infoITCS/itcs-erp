import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  formatMoney,
  getLeadAnalytics,
  leadSourceLabel,
  type ComparisonPeriod,
  type LeadAnalyticsSourceRow,
} from "./api.ts";

const PERIODS: Array<{ value: ComparisonPeriod; label: string }> = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

export function LeadsAnalytics() {
  const [period, setPeriod] = useState<ComparisonPeriod>("90d");
  const report = useQuery({
    queryKey: ["leads", "analytics", period],
    queryFn: () => getLeadAnalytics(period),
  });

  const totals = report.data?.totals;
  const rows = report.data?.bySource ?? [];
  const currency = report.data?.baseCurrencyCode ?? "USD";
  const error = report.isError ? getApiErrorMessage(report.error) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Lead performance</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Conversion, pipeline and win rate by lead source. Amounts in the organization base currency where shown.
          </p>
        </div>
        <select
          aria-label="Analytics period"
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
          value={period}
          onChange={(event) => setPeriod(event.target.value as ComparisonPeriod)}
        >
          {PERIODS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Leads" value={totals ? String(totals.leads) : "—"} hint={totals ? `${totals.new} new · ${totals.contacted} contacted` : undefined} />
        <Metric
          label="Conversion rate"
          value={totals ? `${totals.conversionRate}%` : "—"}
          hint={totals ? `${totals.convertedOrWon} converted or won` : undefined}
          tone="brand"
        />
        <Metric
          label="Win rate"
          value={totals ? `${totals.winRate}%` : "—"}
          hint={totals ? `${totals.won} won · ${totals.lost} lost` : undefined}
          tone="emerald"
        />
        <Metric
          label="Pipeline (base)"
          value={totals ? formatMoney(totals.pipelineValueBase, currency) : "—"}
          hint={totals ? `${totals.openOpportunities} open opportunities` : undefined}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">By source</h3>
          <span className="text-xs text-slate-500">
            {report.data ? `Generated ${new Date(report.data.generatedAt).toLocaleString()}` : ""}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3 text-right">Qualified</th>
                <th className="px-4 py-3 text-right">Converted</th>
                <th className="px-4 py-3 text-right">Conversion</th>
                <th className="px-4 py-3 text-right">Open deals</th>
                <th className="px-4 py-3 text-right">Won / lost</th>
                <th className="px-4 py-3 text-right">Win rate</th>
                <th className="px-4 py-3 text-right">Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {report.isPending ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    Loading analytics…
                  </td>
                </tr>
              ) : null}
              {!report.isPending && rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    No lead activity in this period.
                  </td>
                </tr>
              ) : null}
              {!report.isPending
                ? rows.map((row) => <SourceRow key={row.source} row={row} currency={currency} />)
                : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "slate" | "brand" | "emerald";
}) {
  const color = tone === "brand" ? "text-brand-800" : tone === "emerald" ? "text-emerald-800" : "text-slate-950";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-2xl font-semibold tabular-nums ${color}`} title={value}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function SourceRow({ row, currency }: { row: LeadAnalyticsSourceRow; currency: string }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3 font-medium text-slate-800">{leadSourceLabel(row.source)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.leads}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.qualified}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.converted}</td>
      <td className="px-4 py-3 text-right tabular-nums font-medium text-brand-800">{row.conversionRate}%</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.openOpportunities}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
        {row.won} / {row.lost}
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-800">{row.winRate}%</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
        {formatMoney(row.pipelineValueBase, currency)}
      </td>
    </tr>
  );
}

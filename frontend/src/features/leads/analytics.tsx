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
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "12m", label: "12 months" },
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
    <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-sky-400" />
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">CRM / Insights</p>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">Lead performance</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
              Conversion, pipeline and win rate by source. Base-currency amounts are normalized for comparison.
            </p>
          </div>
          <div className="inline-flex w-fit flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPeriod(item.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${period === item.value ? "bg-brand-800 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Leads" value={totals ? String(totals.leads) : "—"} hint={totals ? `${totals.new} new · ${totals.contacted} contacted` : undefined} tone="slate" />
        <Metric label="Conversion rate" value={totals ? `${totals.conversionRate}%` : "—"} hint={totals ? `${totals.convertedOrWon} converted or won` : undefined} tone="brand" />
        <Metric label="Win rate" value={totals ? `${totals.winRate}%` : "—"} hint={totals ? `${totals.won} won · ${totals.lost} lost` : undefined} tone="emerald" />
        <Metric label="Pipeline (base)" value={totals ? formatMoney(totals.pipelineValueBase, currency) : "—"} hint={totals ? `${totals.openOpportunities} open opportunities` : undefined} tone="violet" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/40 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-slate-950">By source</h3>
            <p className="mt-0.5 text-xs text-slate-500">Where qualified pipeline and closed revenue originate.</p>
          </div>
          <span className="text-[11px] font-medium text-slate-400">{report.data ? `Generated ${new Date(report.data.generatedAt).toLocaleString()}` : ""}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse text-left text-sm">
            <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Source</th>
                <th className="px-5 py-3.5 text-right">Leads</th>
                <th className="px-5 py-3.5 text-right">Qualified</th>
                <th className="px-5 py-3.5 text-right">Converted</th>
                <th className="px-5 py-3.5 text-right">Conversion</th>
                <th className="px-5 py-3.5 text-right">Open deals</th>
                <th className="px-5 py-3.5 text-right">Won / lost</th>
                <th className="px-5 py-3.5 text-right">Win rate</th>
                <th className="px-5 py-3.5 text-right">Pipeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.isPending ? <LoadingRows /> : null}
              {!report.isPending && rows.length === 0 ? <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-500">No lead activity in this period.</td></tr> : null}
              {!report.isPending ? rows.map((row) => <SourceRow key={row.source} row={row} currency={currency} />) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: "slate" | "brand" | "emerald" | "violet" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    brand: "bg-brand-50 text-brand-700",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <span className={`h-2 w-2 rounded-full ${tones[tone].split(" ")[0]}`} />
      </div>
      <p className="mt-2 truncate text-2xl font-bold tabular-nums text-slate-950" title={value}>{value}</p>
      {hint ? <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-400">{hint}</p> : null}
    </div>
  );
}

function LoadingRows() {
  return <>{[0, 1, 2, 3].map((index) => <tr key={index} className="animate-pulse"><td className="px-5 py-4"><span className="block h-3 w-24 rounded bg-slate-200" /></td>{[0, 1, 2, 3, 4, 5, 6, 7].map((cell) => <td key={cell} className="px-5 py-4"><span className="ml-auto block h-3 w-12 rounded bg-slate-100" /></td>)}</tr>)}</>;
}

function SourceRow({ row, currency }: { row: LeadAnalyticsSourceRow; currency: string }) {
  return (
    <tr className="transition-colors hover:bg-brand-50/30">
      <td className="px-5 py-4 font-semibold text-slate-900">{leadSourceLabel(row.source)}</td>
      <td className="px-5 py-4 text-right tabular-nums text-slate-700">{row.leads}</td>
      <td className="px-5 py-4 text-right tabular-nums text-slate-700">{row.qualified}</td>
      <td className="px-5 py-4 text-right tabular-nums text-slate-700">{row.converted}</td>
      <td className="px-5 py-4 text-right font-semibold tabular-nums text-brand-800">{row.conversionRate}%</td>
      <td className="px-5 py-4 text-right tabular-nums text-slate-700">{row.openOpportunities}</td>
      <td className="px-5 py-4 text-right tabular-nums text-slate-700">{row.won} / {row.lost}</td>
      <td className="px-5 py-4 text-right font-semibold tabular-nums text-emerald-800">{row.winRate}%</td>
      <td className="px-5 py-4 text-right tabular-nums text-slate-800">{formatMoney(row.pipelineValueBase, currency)}</td>
    </tr>
  );
}

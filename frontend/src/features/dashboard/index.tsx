import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchHealth } from "@/services/health.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";

const liveAreas = [
  { label: "Customers", path: "/customers", group: "CRM", blurb: "Accounts, contacts, balances" },
  { label: "Opportunities", path: "/opportunities", group: "CRM", blurb: "Pipeline and prospect conversion" },
  { label: "Products", path: "/products", group: "Supply", blurb: "Catalog, prices, categories" },
  { label: "Resellers", path: "/resellers", group: "CRM", blurb: "Channel partners and assignments" },
];

const upcomingWidgets = [
  { title: "Total sales", group: "Sales" },
  { title: "Invoiced amount", group: "Sales" },
  { title: "Paid amount", group: "Sales" },
  { title: "Outstanding amount", group: "Sales" },
  { title: "Overdue amount", group: "Sales" },
  { title: "Opportunity pipeline", group: "CRM" },
  { title: "Tender pipeline", group: "CRM" },
  { title: "Top customers", group: "CRM" },
  { title: "Top products and services", group: "Supply" },
  { title: "Reseller performance", group: "CRM" },
  { title: "Upcoming renewals", group: "Delivery" },
  { title: "Purchasing summary", group: "Supply" },
  { title: "Inventory summary", group: "Supply" },
  { title: "Expense summary", group: "Finance" },
];

export default function DashboardPage() {
  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: fetchHealth,
  });

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-5 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
            <span className="h-2 w-2 rounded-full bg-teal-600" />
            Overview
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">Dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            KPI tiles will load from dedicated endpoints. Use the live areas below for day-to-day work.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white/90 px-4 py-3 text-sm shadow-sm">
          {health.isPending ? <p className="text-slate-500">Checking the API…</p> : null}
          {health.isError ? <p className="text-red-700">{getApiErrorMessage(health.error)}</p> : null}
          {health.data ? (
            <p className="flex items-center gap-2 text-slate-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              API · {health.data.message}
            </p>
          ) : null}
        </div>
      </header>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Live modules</h2>
          <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800 ring-1 ring-inset ring-teal-100">
            Ready
          </span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {liveAreas.map((area) => (
            <li key={area.path}>
              <Link
                to={area.path}
                className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">{area.group}</p>
                <p className="mt-2 text-base font-semibold text-slate-950 group-hover:text-teal-900">{area.label}</p>
                <p className="mt-1 text-sm text-slate-500">{area.blurb}</p>
                <span className="mt-4 text-xs font-medium text-teal-800 opacity-0 transition group-hover:opacity-100">
                  Open →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Upcoming analytics</h2>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {upcomingWidgets.length} widgets
          </span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {upcomingWidgets.map((widget) => (
            <li
              key={widget.title}
              className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-4 transition hover:border-slate-400 hover:bg-white"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{widget.group}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{widget.title}</p>
              <p className="mt-2 text-xs text-slate-500">Awaiting a drill-down endpoint</p>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

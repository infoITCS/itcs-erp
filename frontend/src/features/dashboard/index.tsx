import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/services/health.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";

const widgets = [
  "Total sales",
  "Invoiced amount",
  "Paid amount",
  "Outstanding amount",
  "Overdue amount",
  "Opportunity pipeline",
  "Tender pipeline",
  "Top customers",
  "Top products and services",
  "Reseller performance",
  "Upcoming renewals",
  "Purchasing summary",
  "Inventory summary",
  "Expense summary",
];

export default function DashboardPage() {
  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: fetchHealth,
  });

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Each KPI will come from its own backend query. This screen does not total records in the browser.
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
        {health.isPending ? <p className="text-slate-500">Checking the API…</p> : null}
        {health.isError ? <p className="text-red-700">{getApiErrorMessage(health.error)}</p> : null}
        {health.data ? (
          <p className="text-slate-800">
            API: {health.data.message}
          </p>
        ) : null}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {widgets.map((widget) => (
          <li key={widget} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-sm font-medium text-slate-900">{widget}</p>
            <p className="mt-1 text-xs text-slate-500">Awaiting a drill-down endpoint</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { listResellers, type ResellerStatus } from "./api.ts";

export default function ResellersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [country, setCountry] = useState("");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);
  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    country: country.length === 2 ? country : undefined,
    cursor,
    limit: 50,
  };
  const resellers = useQuery({
    queryKey: queryKeys.list("resellers", params),
    queryFn: () => listResellers(params),
  });

  const rows = resellers.data?.items ?? [];
  const hasNextPage = resellers.data?.pageInfo.hasNextPage ?? false;
  const hasPreviousPage = cursors.length > 1;
  const error = resellers.isError ? getApiErrorMessage(resellers.error) : null;
  const pageSummary = `${rows.length} reseller${rows.length === 1 ? "" : "s"} on page ${cursors.length}`;
  const activeCount = rows.filter((row) => row.status === "ACTIVE").length;
  const inactiveCount = rows.filter((row) => row.status === "INACTIVE").length;
  const suspendedCount = rows.filter((row) => row.status === "SUSPENDED").length;

  function resetPage() {
    setCursors([undefined]);
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col items-start justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-teal-800">
            <span className="h-2 w-2 rounded-full bg-teal-600" />
            CRM / Channel
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">Resellers</h1>
          <p className="mt-1 text-sm text-slate-600">Channel partners that sell ITCS products and services.</p>
        </div>
        <Link to="/resellers/new">
          <Button className="h-10 bg-teal-800 px-4 hover:bg-teal-900">Add New Reseller</Button>
        </Link>
      </header>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 sm:grid-cols-4 sm:divide-y-0">
        <SummaryItem label="Visible" value={rows.length.toString()} tone="slate" />
        <SummaryItem label="Active" value={activeCount.toString()} tone="teal" />
        <SummaryItem label="Inactive" value={inactiveCount.toString()} tone="slate" />
        <SummaryItem label="Suspended" value={suspendedCount.toString()} tone="amber" />
      </div>

      <section aria-label="Reseller filters" className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_190px_160px]">
          <Input
            className="h-10"
            type="search"
            value={q}
            placeholder="Search number, name, email, phone"
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
          />
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              resetPage();
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <Input
            className="h-10"
            value={country}
            placeholder="Country, such as PK"
            maxLength={2}
            onChange={(event) => {
              setCountry(event.target.value.toUpperCase());
              resetPage();
            }}
          />
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Reseller directory</h2>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">{rows.length}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Reseller</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Price list</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Customers</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {resellers.isPending ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    Loading resellers…
                  </td>
                </tr>
              ) : null}
              {!resellers.isPending && error ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-red-700">
                    {error}
                  </td>
                </tr>
              ) : null}
              {!resellers.isPending && !error && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No resellers match these filters.
                  </td>
                </tr>
              ) : null}
              {!resellers.isPending && !error
                ? rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 transition-colors hover:bg-teal-50/30">
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs font-medium text-slate-500">{row.resellerNumber}</td>
                      <td className="max-w-[240px] px-5 py-4">
                        <Link
                          className="font-semibold text-slate-950 decoration-teal-700 underline-offset-4 hover:text-teal-800 hover:underline"
                          to={`/resellers/${row.id}`}
                        >
                          {row.displayName}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{row.legalName}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{row.email ?? "—"}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{row.countryCode}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{row.priceListCode}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-slate-800">{row._count?.customers ?? 0}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex justify-end gap-1 text-xs font-medium">
                          <Link className="rounded px-2 py-1.5 text-slate-700 hover:bg-slate-100" to={`/resellers/${row.id}`}>
                            View
                          </Link>
                          <Link className="rounded px-2 py-1.5 text-slate-700 hover:bg-slate-100" to={`/resellers/${row.id}/edit`}>
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{pageSummary}</span>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              variant="secondary"
              className="h-8 px-3 text-xs"
              disabled={!hasPreviousPage}
              onClick={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              className="h-8 px-3 text-xs"
              disabled={!hasNextPage}
              onClick={() => {
                const next = resellers.data?.pageInfo.nextCursor;
                if (next) {
                  setCursors((current) => [...current, next]);
                }
              }}
            >
              Next
            </Button>
          </div>
        </footer>
      </div>
    </section>
  );
}

function SummaryItem({ label, value, tone }: { label: string; value: string; tone: "slate" | "teal" | "amber" }) {
  const valueColor = tone === "teal" ? "text-teal-800" : tone === "amber" ? "text-amber-800" : "text-slate-950";
  return (
    <div className="flex min-h-[76px] flex-col justify-center px-4 py-3 first:pl-0 sm:pl-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ResellerStatus }) {
  const color =
    status === "ACTIVE"
      ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
      : status === "SUSPENDED"
        ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"
        : "bg-slate-100 text-slate-700";
  const label = status === "ACTIVE" ? "Active" : status === "SUSPENDED" ? "Suspended" : "Inactive";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{label}</span>;
}

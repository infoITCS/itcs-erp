import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import type { CustomerSummary } from "./api.ts";

export type CustomerListRow = CustomerSummary & {
  taxNumber?: string | null;
};

export interface CustomerListFilters {
  q: string;
  status: string;
  customerType: string;
  includeDeleted: boolean;
}

interface CustomerListViewProps {
  rows: CustomerListRow[];
  filters: CustomerListFilters;
  isLoading: boolean;
  error: string | null;
  actionError: string | null;
  pageSummary: string;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  restoringId: string | null;
  permanentlyDeletingId: string | null;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onCustomerTypeChange: (value: string) => void;
  onIncludeDeletedChange: (value: boolean) => void;
  onNext: () => void;
  onPrevious: () => void;
  onDelete: (customer: CustomerListRow) => void;
  onRestore: (customerId: string) => void;
  onPermanentDelete: (customer: CustomerListRow) => void;
}

export function CustomerListView({
  rows,
  filters,
  isLoading,
  error,
  actionError,
  pageSummary,
  hasNextPage,
  hasPreviousPage,
  restoringId,
  permanentlyDeletingId,
  onQueryChange,
  onStatusChange,
  onCustomerTypeChange,
  onIncludeDeletedChange,
  onNext,
  onPrevious,
  onDelete,
  onRestore,
  onPermanentDelete,
}: CustomerListViewProps) {
  const activeCount = rows.filter((row) => !row.deletedAt && row.status === "ACTIVE").length;
  const holdCount = rows.filter((row) => !row.deletedAt && row.status === "HOLD").length;
  const inactiveCount = rows.filter((row) => !row.deletedAt && row.status === "INACTIVE").length;

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col items-start justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-teal-800"><span className="h-2 w-2 rounded-full bg-teal-600" />CRM / Directory</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-slate-950">Customers</h1>
          </div>
          <p className="mt-1 text-sm text-slate-600">Customer accounts, contacts and receivables.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Link to="/customers/new"><Button className="h-10 bg-teal-800 px-4 hover:bg-teal-900">Add New Customer</Button></Link>
        </div>
      </header>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 sm:grid-cols-4 sm:divide-y-0">
        <SummaryItem label="Visible customers" value={rows.length.toString()} tone="slate" />
        <SummaryItem label="Active" value={activeCount.toString()} tone="teal" />
        <SummaryItem label="On hold" value={holdCount.toString()} tone="amber" />
        <SummaryItem label="Inactive" value={inactiveCount.toString()} tone="slate" />
      </div>

      <section aria-label="Customer filters" className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_190px_210px]">
          <Input
            className="h-10"
            type="search"
            aria-label="Search customers by name, customer ID or tax number"
            value={filters.q}
            placeholder="Search name, customer ID or tax no."
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <select
            aria-label="Filter by status"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={filters.status}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="HOLD">On hold</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select
            aria-label="Filter by customer type"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={filters.customerType}
            onChange={(event) => onCustomerTypeChange(event.target.value)}
          >
            <option value="">All customer types</option>
            <option value="B2B">B2B</option>
            <option value="B2C">B2C</option>
            <option value="WHOLESALE">Wholesale</option>
            <option value="COMPANY">Company</option>
            <option value="INDIVIDUAL">Individual</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <label className="inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-sm text-slate-700 hover:bg-slate-50">
            <input className="accent-teal-800" type="checkbox" checked={filters.includeDeleted} onChange={(event) => onIncludeDeletedChange(event.target.checked)} />
            Include deleted customers
          </label>
        </div>
      </section>

      {actionError ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</p> : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Customer directory</h2>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">{rows.length}</span>
          </div>
        </div>
        <div className="divide-y divide-slate-200 xl:hidden">
          {isLoading ? <p className="px-4 py-10 text-center text-sm text-slate-500">Loading customers…</p> : null}
          {!isLoading && error ? <p className="px-4 py-10 text-center text-sm text-red-700">{error}</p> : null}
          {!isLoading && !error && rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">No customers match these filters.</p> : null}
          {!isLoading && !error ? rows.map((row) => (
            <CustomerMobileCard
              key={row.id}
              row={row}
              restoring={restoringId === row.id}
              deletingPermanently={permanentlyDeletingId === row.id}
              onDelete={() => onDelete(row)}
              onRestore={() => onRestore(row.id)}
              onPermanentDelete={() => onPermanentDelete(row)}
            />
          )) : null}
        </div>
        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1020px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Customer ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Primary contact</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Opening balance</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Loading customers…</td></tr>
              ) : null}
              {!isLoading && error ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-red-700">{error}</td></tr>
              ) : null}
              {!isLoading && !error && rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No customers match these filters.</td></tr>
              ) : null}
              {!isLoading && !error ? rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 transition-colors hover:bg-teal-50/30">
                  <td className="whitespace-nowrap px-5 py-4 font-mono text-xs font-medium text-slate-500">{row.customerNumber}</td>
                  <td className="max-w-[270px] px-5 py-4">
                    {row.deletedAt ? (
                      <span className="font-medium text-slate-500">{row.displayName}</span>
                    ) : (
                      <Link className="font-semibold text-slate-950 decoration-teal-700 underline-offset-4 hover:text-teal-800 hover:underline" to={`/customers/${row.id}`}>
                        {row.displayName}
                      </Link>
                    )}
                    <p className="mt-0.5 truncate text-xs text-slate-500">{row.legalName}</p>
                  </td>
                  <td className="max-w-[220px] px-5 py-4">
                    <p className="truncate font-medium text-slate-800">{row.contacts?.[0]?.displayName ?? "No primary contact"}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{row.contacts?.[0]?.email ?? row.email ?? "—"}</p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-700">{customerTypeLabel(row.customerType)}</td>
                  <td className="whitespace-nowrap px-5 py-4"><CustomerStatusBadge status={row.status} deleted={Boolean(row.deletedAt)} /></td>
                  <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums font-medium text-slate-800">
                    {formatBalance(row.openingBalance, row.currencyCode)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <div className="flex justify-end gap-1 text-xs font-medium">
                      {row.deletedAt ? (
                        <>
                          <button type="button" disabled={restoringId === row.id} className="text-emerald-800 underline decoration-emerald-300 underline-offset-2 disabled:opacity-50" onClick={() => onRestore(row.id)}>{restoringId === row.id ? "Restoring…" : "Restore"}</button>
                          <button type="button" disabled={permanentlyDeletingId === row.id} className="text-red-700 underline underline-offset-2 disabled:opacity-50" onClick={() => onPermanentDelete(row)}>{permanentlyDeletingId === row.id ? "Deleting…" : "Permanent delete"}</button>
                        </>
                      ) : (
                        <>
                          <Link className="rounded px-2 py-1.5 text-slate-700 hover:bg-slate-100" to={`/customers/${row.id}`}>View</Link>
                          <Link className="rounded px-2 py-1.5 text-slate-700 hover:bg-slate-100" to={`/customers/${row.id}/edit`}>Edit</Link>
                          <button type="button" className="rounded px-2 py-1.5 text-red-700 hover:bg-red-50" onClick={() => onDelete(row)}>Delete</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{pageSummary}</span>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="secondary" className="h-8 px-3 text-xs" disabled={!hasPreviousPage} onClick={onPrevious}>Previous</Button>
            <Button variant="secondary" className="h-8 px-3 text-xs" disabled={!hasNextPage} onClick={onNext}>Next</Button>
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

function CustomerStatusBadge({ status, deleted }: { status: CustomerSummary["status"]; deleted: boolean }) {
  const label = deleted ? "Deleted" : status === "HOLD" ? "On hold" : status === "ACTIVE" ? "Active" : "Inactive";
  const color = deleted || status === "INACTIVE"
    ? "bg-slate-100 text-slate-700"
    : status === "HOLD"
      ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"
      : "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{label}</span>;
}

function customerTypeLabel(type: CustomerSummary["customerType"]): string {
  switch (type) {
    case "B2B":
      return "B2B";
    case "B2C":
      return "B2C";
    case "WHOLESALE":
      return "Wholesale";
    case "INDIVIDUAL":
      return "Individual";
    default:
      return "Company";
  }
}

function formatBalance(balance: CustomerListRow["openingBalance"], currency: string): string {
  if (balance === null || balance === undefined) {
    return "—";
  }
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(balance));
  } catch {
    return `${currency} ${Number(balance).toLocaleString("en-US")}`;
  }
}

function CustomerMobileCard({
  row,
  restoring,
  deletingPermanently,
  onDelete,
  onRestore,
  onPermanentDelete,
}: {
  row: CustomerListRow;
  restoring: boolean;
  deletingPermanently: boolean;
  onDelete: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
}) {
  return (
    <article className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-slate-500">{row.customerNumber}</p>
          {row.deletedAt ? <p className="mt-1 break-words font-semibold text-slate-500">{row.displayName}</p> : (
            <Link className="mt-1 block break-words font-semibold text-slate-950 hover:underline" to={`/customers/${row.id}`}>{row.displayName}</Link>
          )}
          <p className="mt-0.5 break-words text-xs text-slate-500">{row.legalName}</p>
        </div>
        <CustomerStatusBadge status={row.status} deleted={Boolean(row.deletedAt)} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-slate-100 py-3 text-sm">
        <div><dt className="text-xs text-slate-500">Primary contact</dt><dd className="mt-0.5 break-words text-slate-800">{row.contacts?.[0]?.displayName ?? "No primary contact"}</dd><dd className="mt-0.5 break-all text-xs text-slate-500">{row.contacts?.[0]?.email ?? row.email ?? ""}</dd></div>
        <div><dt className="text-xs text-slate-500">Type</dt><dd className="mt-0.5 text-slate-800">{customerTypeLabel(row.customerType)}</dd></div>
        <div className="col-span-2"><dt className="text-xs text-slate-500">Opening balance</dt><dd className="mt-0.5 tabular-nums font-medium text-slate-800">{formatBalance(row.openingBalance, row.currencyCode)}</dd></div>
      </dl>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
        {row.deletedAt ? (
          <>
            <button type="button" disabled={restoring} className="text-emerald-800 disabled:opacity-50" onClick={onRestore}>{restoring ? "Restoring…" : "Restore"}</button>
            <button type="button" disabled={deletingPermanently} className="text-red-700 disabled:opacity-50" onClick={onPermanentDelete}>{deletingPermanently ? "Deleting…" : "Permanent delete"}</button>
          </>
        ) : (
          <>
            <Link className="text-slate-700" to={`/customers/${row.id}`}>View</Link>
            <Link className="text-slate-700" to={`/customers/${row.id}/edit`}>Edit</Link>
            <button type="button" className="text-red-700" onClick={onDelete}>Delete</button>
          </>
        )}
      </div>
    </article>
  );
}
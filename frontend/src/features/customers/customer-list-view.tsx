import type { ReactNode } from "react";
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
  onClearFilters: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onDelete: (customer: CustomerListRow) => void;
  onRestore: (customerId: string) => void;
  onPermanentDelete: (customer: CustomerListRow) => void;
}

type MetricTone = "brand" | "emerald" | "amber" | "slate";
type IconName =
  | "users"
  | "userCheck"
  | "pause"
  | "userMinus"
  | "search"
  | "plus"
  | "chevronLeft"
  | "chevronRight"
  | "eye"
  | "pencil"
  | "trash"
  | "restore"
  | "x"
  | "sliders"
  | "building"
  | "alert";

const toneStyles: Record<MetricTone, { tile: string; accent: string; value: string }> = {
  brand: { tile: "bg-brand-50 text-brand-700 ring-brand-100", accent: "bg-brand-500", value: "text-slate-950" },
  emerald: { tile: "bg-emerald-50 text-emerald-700 ring-emerald-100", accent: "bg-emerald-500", value: "text-slate-950" },
  amber: { tile: "bg-amber-50 text-amber-700 ring-amber-100", accent: "bg-amber-500", value: "text-slate-950" },
  slate: { tile: "bg-slate-100 text-slate-600 ring-slate-200", accent: "bg-slate-400", value: "text-slate-950" },
};

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
  onClearFilters,
  onNext,
  onPrevious,
  onDelete,
  onRestore,
  onPermanentDelete,
}: CustomerListViewProps) {
  const activeCount = rows.filter((row) => !row.deletedAt && row.status === "ACTIVE").length;
  const holdCount = rows.filter((row) => !row.deletedAt && row.status === "HOLD").length;
  const inactiveCount = rows.filter((row) => !row.deletedAt && row.status === "INACTIVE").length;
  const hasActiveFilters = Boolean(filters.q || filters.status || filters.customerType || filters.includeDeleted);

  return (
    <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-sky-400" />
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 sm:flex">
              <Icon name="users" className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> CRM / Customer directory
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">Customers</h1>
              <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-600">
                Manage customer accounts, contacts and receivables from a single workspace.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live directory
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-600">
                  {rows.length} on this page
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Link to="/customers/new">
              <Button className="h-11 gap-2 bg-brand-800 px-5 text-sm font-semibold shadow-lg shadow-brand-800/20 hover:bg-brand-900">
                <Icon name="plus" className="h-4 w-4" /> Add customer
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Visible customers" value={rows.length} detail="On current page" icon="users" tone="slate" active={!filters.status} onClick={() => onStatusChange("")} />
        <MetricCard label="Active accounts" value={activeCount} detail="Ready for transactions" icon="userCheck" tone="emerald" active={filters.status === "ACTIVE"} onClick={() => onStatusChange("ACTIVE")} />
        <MetricCard label="On hold" value={holdCount} detail="Credit or review hold" icon="pause" tone="amber" active={filters.status === "HOLD"} onClick={() => onStatusChange("HOLD")} />
        <MetricCard label="Inactive" value={inactiveCount} detail="Archived accounts" icon="userMinus" tone="slate" active={filters.status === "INACTIVE"} onClick={() => onStatusChange("INACTIVE")} />
      </div>

      <section aria-label="Customer filters" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-slate-50/40 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_190px_210px_auto]">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Icon name="search" className="h-4 w-4" />
              </span>
              <Input
                className="h-10 pl-9"
                type="search"
                aria-label="Search customers by name, customer ID or tax number"
                value={filters.q}
                placeholder="Search name, ID or tax no…"
                onChange={(event) => onQueryChange(event.target.value)}
              />
            </div>
            <select
              aria-label="Filter by status"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
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
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
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
            <Button
              variant="secondary"
              className="h-10 gap-2 px-3 text-xs font-semibold text-slate-600"
              disabled={!hasActiveFilters}
              onClick={onClearFilters}
            >
              <Icon name="x" className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-3">
            <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900">
              <input className="h-4 w-4 accent-brand-800" type="checkbox" checked={filters.includeDeleted} onChange={(event) => onIncludeDeletedChange(event.target.checked)} />
              Include deleted customers
            </label>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <Icon name="sliders" className="h-3.5 w-3.5" /> Search updates as you type
            </span>
          </div>
        </div>

        {actionError ? (
          <div role="alert" className="m-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:m-5">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> {actionError}
          </div>
        ) : null}

        <div className="divide-y divide-slate-100 xl:hidden">
          {isLoading ? <LoadingRows variant="mobile" /> : null}
          {!isLoading && error ? <ErrorState message={error} /> : null}
          {!isLoading && !error && rows.length === 0 ? <EmptyState onClearFilters={onClearFilters} canClear={hasActiveFilters} /> : null}
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
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Customer ID</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Primary contact</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Opening balance</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? <LoadingRows variant="table" /> : null}
              {!isLoading && error ? <ErrorState message={error} colSpan={7} /> : null}
              {!isLoading && !error && rows.length === 0 ? <EmptyState onClearFilters={onClearFilters} canClear={hasActiveFilters} colSpan={7} /> : null}
              {!isLoading && !error ? rows.map((row) => (
                <tr key={row.id} className="group transition-colors hover:bg-brand-50/30">
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-medium text-slate-600">{row.customerNumber}</span>
                  </td>
                  <td className="max-w-[290px] px-5 py-4">
                    <div className="flex items-center gap-3">
                      <CustomerAvatar name={row.displayName} />
                      <div className="min-w-0">
                        {row.deletedAt ? (
                          <span className="block truncate font-semibold text-slate-500">{row.displayName}</span>
                        ) : (
                          <Link className="block truncate font-semibold text-slate-950 decoration-brand-700 underline-offset-4 hover:text-brand-800 hover:underline" to={`/customers/${row.id}`}>
                            {row.displayName}
                          </Link>
                        )}
                        <p className="mt-0.5 truncate text-xs text-slate-500">{row.legalName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[230px] px-5 py-4">
                    <p className="truncate font-medium text-slate-800">{row.contacts?.[0]?.displayName ?? "No primary contact"}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{row.contacts?.[0]?.email ?? row.email ?? "—"}</p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4"><TypePill type={row.customerType} /></td>
                  <td className="whitespace-nowrap px-5 py-4"><CustomerStatusBadge status={row.status} deleted={Boolean(row.deletedAt)} /></td>
                  <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums font-semibold text-slate-800">
                    {formatBalance(row.openingBalance, row.currencyCode)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <div className="flex justify-end gap-1">
                      {row.deletedAt ? (
                        <>
                          <IconAction label={restoringId === row.id ? "Restoring…" : "Restore customer"} icon="restore" tone="emerald" disabled={restoringId === row.id} onClick={() => onRestore(row.id)} />
                          <IconAction label={permanentlyDeletingId === row.id ? "Deleting…" : "Permanently delete"} icon="trash" tone="rose" disabled={permanentlyDeletingId === row.id} onClick={() => onPermanentDelete(row)} />
                        </>
                      ) : (
                        <>
                          <IconAction label="View customer" icon="eye" onClick={() => undefined} to={`/customers/${row.id}`} />
                          <IconAction label="Edit customer" icon="pencil" onClick={() => undefined} to={`/customers/${row.id}/edit`} />
                          <IconAction label="Delete customer" icon="trash" tone="rose" onClick={() => onDelete(row)} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200/80 bg-slate-50/30 px-4 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="font-medium">{pageSummary}</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="h-9 gap-1.5 px-3 text-xs font-semibold" disabled={!hasPreviousPage} onClick={onPrevious}>
              <Icon name="chevronLeft" className="h-3.5 w-3.5" /> Previous
            </Button>
            <Button variant="secondary" className="h-9 gap-1.5 px-3 text-xs font-semibold" disabled={!hasNextPage} onClick={onNext}>
              Next <Icon name="chevronRight" className="h-3.5 w-3.5" />
            </Button>
          </div>
        </footer>
      </section>
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  icon: IconName;
  tone: MetricTone;
  active: boolean;
  onClick: () => void;
}) {
  const styles = toneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        active ? "border-brand-300 ring-2 ring-brand-100" : "border-slate-200/80"
      }`}
    >
      <span className={`absolute inset-x-0 top-0 h-0.5 ${styles.accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${styles.value}`}>{value}</p>
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${styles.tile}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-400">{detail}</p>
    </button>
  );
}

function CustomerAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const palettes = [
    "bg-brand-50 text-brand-700 ring-brand-100",
    "bg-emerald-50 text-emerald-700 ring-emerald-100",
    "bg-violet-50 text-violet-700 ring-violet-100",
    "bg-amber-50 text-amber-700 ring-amber-100",
    "bg-sky-50 text-sky-700 ring-sky-100",
  ];
  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length;
  return (
    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ring-1 ${palettes[index]}`}>
      {initials || "?"}
    </span>
  );
}

function CustomerStatusBadge({ status, deleted }: { status: CustomerSummary["status"]; deleted: boolean }) {
  const label = deleted ? "Deleted" : status === "HOLD" ? "On hold" : status === "ACTIVE" ? "Active" : "Inactive";
  const styles = deleted || status === "INACTIVE"
    ? "bg-slate-100 text-slate-600 ring-slate-200"
    : status === "HOLD"
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : "bg-emerald-50 text-emerald-800 ring-emerald-200";
  const dot = deleted || status === "INACTIVE" ? "bg-slate-400" : status === "HOLD" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${styles}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {label}
    </span>
  );
}

function TypePill({ type }: { type: CustomerSummary["customerType"] }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
      {customerTypeLabel(type)}
    </span>
  );
}

function IconAction({
  label,
  icon,
  tone = "slate",
  disabled = false,
  onClick,
  to,
}: {
  label: string;
  icon: IconName;
  tone?: "slate" | "rose" | "emerald";
  disabled?: boolean;
  onClick: () => void;
  to?: string;
}) {
  const styles = tone === "rose"
    ? "text-rose-600 hover:bg-rose-50"
    : tone === "emerald"
      ? "text-emerald-700 hover:bg-emerald-50"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900";
  const className = `inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${styles}`;
  if (to) {
    return <Link to={to} aria-label={label} title={label} className={className}><Icon name={icon} className="h-4 w-4" /></Link>;
  }
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={className}>
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

function LoadingRows({ variant }: { variant: "table" | "mobile" }) {
  if (variant === "mobile") {
    return (
      <div className="space-y-4 p-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex animate-pulse items-center gap-3">
            <span className="h-9 w-9 rounded-xl bg-slate-200" />
            <div className="flex-1 space-y-2"><span className="block h-3 w-2/5 rounded bg-slate-200" /><span className="block h-2.5 w-3/5 rounded bg-slate-100" /></div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <>
      {[0, 1, 2, 3, 4].map((index) => (
        <tr key={index} className="animate-pulse">
          <td className="px-5 py-4"><span className="block h-5 w-20 rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="h-9 w-9 rounded-xl bg-slate-100" /><span className="block h-3 w-32 rounded bg-slate-200" /></div></td>
          <td className="px-5 py-4"><span className="block h-3 w-28 rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="block h-5 w-14 rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="block h-5 w-16 rounded-full bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="ml-auto block h-3 w-20 rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="ml-auto block h-7 w-20 rounded bg-slate-100" /></td>
        </tr>
      ))}
    </>
  );
}

function ErrorState({ message, colSpan }: { message: string; colSpan?: number }) {
  const content = (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100"><Icon name="alert" className="h-6 w-6" /></span>
      <p className="text-sm font-semibold text-slate-900">Couldn’t load customers</p>
      <p className="max-w-md text-xs leading-5 text-slate-500">{message}</p>
    </div>
  );
  return colSpan ? <tr><td colSpan={colSpan}>{content}</td></tr> : <div>{content}</div>;
}

function EmptyState({ onClearFilters, canClear, colSpan }: { onClearFilters: () => void; canClear: boolean; colSpan?: number }) {
  const content = (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200"><Icon name="search" className="h-7 w-7" /></span>
      <div>
        <p className="text-sm font-semibold text-slate-900">No customers found</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Try a different search term or clear the active filters.</p>
      </div>
      {canClear ? (
        <Button variant="secondary" className="h-9 gap-2 px-3 text-xs font-semibold" onClick={onClearFilters}>
          <Icon name="x" className="h-3.5 w-3.5" /> Clear filters
        </Button>
      ) : null}
    </div>
  );
  return colSpan ? <tr><td colSpan={colSpan}>{content}</td></tr> : <div>{content}</div>;
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
    <article className="p-4 transition-colors hover:bg-slate-50/60">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CustomerAvatar name={row.displayName} />
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-medium text-slate-400">{row.customerNumber}</p>
            {row.deletedAt ? <p className="mt-0.5 break-words font-semibold text-slate-500">{row.displayName}</p> : (
              <Link className="mt-0.5 block break-words font-semibold text-slate-950 hover:text-brand-800" to={`/customers/${row.id}`}>{row.displayName}</Link>
            )}
            <p className="mt-0.5 break-words text-xs text-slate-500">{row.legalName}</p>
          </div>
        </div>
        <CustomerStatusBadge status={row.status} deleted={Boolean(row.deletedAt)} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50/80 p-3">
        <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Primary contact</dt><dd className="mt-1 break-words text-xs font-medium text-slate-800">{row.contacts?.[0]?.displayName ?? "No primary contact"}</dd><dd className="mt-0.5 break-all text-[11px] text-slate-500">{row.contacts?.[0]?.email ?? row.email ?? ""}</dd></div>
        <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Type</dt><dd className="mt-1"><TypePill type={row.customerType} /></dd></div>
        <div className="col-span-2"><dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Opening balance</dt><dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">{formatBalance(row.openingBalance, row.currencyCode)}</dd></div>
      </dl>
      <div className="mt-3 flex items-center justify-end gap-1">
        {row.deletedAt ? (
          <>
            <IconAction label={restoring ? "Restoring…" : "Restore customer"} icon="restore" tone="emerald" disabled={restoring} onClick={onRestore} />
            <IconAction label={deletingPermanently ? "Deleting…" : "Permanently delete"} icon="trash" tone="rose" disabled={deletingPermanently} onClick={onPermanentDelete} />
          </>
        ) : (
          <>
            <IconAction label="View customer" icon="eye" onClick={() => undefined} to={`/customers/${row.id}`} />
            <IconAction label="Edit customer" icon="pencil" onClick={() => undefined} to={`/customers/${row.id}/edit`} />
            <IconAction label="Delete customer" icon="trash" tone="rose" onClick={onDelete} />
          </>
        )}
      </div>
    </article>
  );
}

function Svg({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      className={className ?? "h-4 w-4"}
      viewBox="0 0 24 24"
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

function Icon({ name, className }: { name: IconName; className?: string }) {
  switch (name) {
    case "users":
      return <Svg className={className}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>;
    case "userCheck":
      return <Svg className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></Svg>;
    case "pause":
      return <Svg className={className}><circle cx="12" cy="12" r="9" /><line x1="10" y1="9" x2="10" y2="15" /><line x1="14" y1="9" x2="14" y2="15" /></Svg>;
    case "userMinus":
      return <Svg className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="17" y1="11" x2="23" y2="11" /></Svg>;
    case "search":
      return <Svg className={className}><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.65" y2="16.65" /></Svg>;
    case "plus":
      return <Svg className={className}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Svg>;
    case "chevronLeft":
      return <Svg className={className}><polyline points="15 18 9 12 15 6" /></Svg>;
    case "chevronRight":
      return <Svg className={className}><polyline points="9 18 15 12 9 6" /></Svg>;
    case "eye":
      return <Svg className={className}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></Svg>;
    case "pencil":
      return <Svg className={className}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg>;
    case "trash":
      return <Svg className={className}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></Svg>;
    case "restore":
      return <Svg className={className}><polyline points="1 4 1 10 7 10" /><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10" /></Svg>;
    case "x":
      return <Svg className={className}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>;
    case "sliders":
      return <Svg className={className}><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></Svg>;
    case "building":
      return <Svg className={className}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></Svg>;
    case "alert":
      return <Svg className={className}><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Svg>;
  }
}

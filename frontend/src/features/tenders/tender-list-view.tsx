import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { TENDER_STATUSES, type Tender, type TenderStatus } from "./api.ts";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  isDeadlineOverdue,
  statusLabel,
  TenderStatusBadge,
} from "./shared.tsx";

export interface TenderListFilters {
  q: string;
  status: "" | TenderStatus;
  customerId: string;
  ownerUserId: string;
  from: string;
  to: string;
  sort: "createdAt" | "title" | "tenderNumber";
  order: "asc" | "desc";
  includeDeleted: boolean;
}

interface CustomerOption {
  id: string;
  displayName: string;
  customerNumber: string;
}

interface OwnerOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface TenderListViewProps {
  rows: Tender[];
  filters: TenderListFilters;
  customers: CustomerOption[];
  owners: OwnerOption[];
  isLoading: boolean;
  error: string | null;
  actionError: string | null;
  pageSummary: string;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRestore: boolean;
  deletingId: string | null;
  restoringId: string | null;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: "" | TenderStatus) => void;
  onCustomerChange: (value: string) => void;
  onOwnerChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onSortChange: (value: TenderListFilters["sort"]) => void;
  onOrderChange: (value: "asc" | "desc") => void;
  onIncludeDeletedChange: (value: boolean) => void;
  onClearFilters: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onDelete: (row: Tender) => void;
  onRestore: (row: Tender) => void;
}

type Tone = "brand" | "blue" | "emerald" | "rose" | "slate";
type IconName =
  | "file"
  | "users"
  | "user"
  | "calendar"
  | "wallet"
  | "eye"
  | "pencil"
  | "trash"
  | "restore"
  | "search"
  | "plus"
  | "chevronLeft"
  | "chevronRight"
  | "alert"
  | "clock"
  | "flag"
  | "sliders"
  | "x"
  | "building";

const controlClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50";

const toneStyles: Record<Tone, { tile: string; accent: string }> = {
  brand: { tile: "bg-brand-50 text-brand-700 ring-brand-100", accent: "bg-brand-500" },
  blue: { tile: "bg-blue-50 text-blue-700 ring-blue-100", accent: "bg-blue-500" },
  emerald: { tile: "bg-emerald-50 text-emerald-700 ring-emerald-100", accent: "bg-emerald-500" },
  rose: { tile: "bg-rose-50 text-rose-700 ring-rose-100", accent: "bg-rose-500" },
  slate: { tile: "bg-slate-100 text-slate-600 ring-slate-200", accent: "bg-slate-400" },
};

const sortOptions: Array<[string, string]> = [
  ["createdAt:desc", "Newest"],
  ["createdAt:asc", "Oldest"],
  ["title:asc", "Title A-Z"],
  ["title:desc", "Title Z-A"],
  ["tenderNumber:asc", "Number A-Z"],
];

export function TenderListView({
  rows,
  filters,
  customers,
  owners,
  isLoading,
  error,
  actionError,
  pageSummary,
  hasNextPage,
  hasPreviousPage,
  canCreate,
  canEdit,
  canDelete,
  canRestore,
  deletingId,
  restoringId,
  onQueryChange,
  onStatusChange,
  onCustomerChange,
  onOwnerChange,
  onFromChange,
  onToChange,
  onSortChange,
  onOrderChange,
  onIncludeDeletedChange,
  onClearFilters,
  onNext,
  onPrevious,
  onDelete,
  onRestore,
}: TenderListViewProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const visible = rows.filter((row) => !row.deletedAt);
  const deletedCount = rows.filter((row) => row.deletedAt).length;
  const countFor = (status: TenderStatus) => visible.filter((row) => row.status === status).length;
  const hasActiveFilters = Boolean(
    filters.q || filters.status || filters.customerId || filters.ownerUserId || filters.from || filters.to || filters.includeDeleted || filters.sort !== "createdAt" || filters.order !== "desc",
  );
  const selectedSort = sortOptions.find(([value]) => value === `${filters.sort}:${filters.order}`)?.[1] ?? "Custom sort";
  const customerName = customers.find((customer) => customer.id === filters.customerId)?.displayName;
  const ownerName = owners.find((owner) => owner.id === filters.ownerUserId);
  const activeChips: Array<{ key: string; label: string; onClear: () => void }> = [];
  const canIncludeDeleted = canDelete || canRestore;

  if (filters.q) activeChips.push({ key: "q", label: `Search: ${filters.q}`, onClear: () => onQueryChange("") });
  if (filters.status) activeChips.push({ key: "status", label: `Status: ${statusLabel(filters.status)}`, onClear: () => onStatusChange("") });
  if (filters.customerId) activeChips.push({ key: "customer", label: `Customer: ${customerName ?? filters.customerId.slice(0, 8)}`, onClear: () => onCustomerChange("") });
  if (filters.ownerUserId) activeChips.push({ key: "owner", label: `Owner: ${ownerName ? `${ownerName.firstName} ${ownerName.lastName}` : "Selected"}`, onClear: () => onOwnerChange("") });
  if (filters.from) activeChips.push({ key: "from", label: `From: ${filters.from}`, onClear: () => onFromChange("") });
  if (filters.to) activeChips.push({ key: "to", label: `To: ${filters.to}`, onClear: () => onToChange("") });
  if (filters.includeDeleted) activeChips.push({ key: "deleted", label: "Deleted included", onClear: () => onIncludeDeletedChange(false) });
  if (filters.sort !== "createdAt" || filters.order !== "desc") activeChips.push({ key: "sort", label: `Sort: ${selectedSort}`, onClear: () => { onSortChange("createdAt"); onOrderChange("desc"); } });

  return (
    <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-sky-400" />
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 sm:flex">
              <Icon name="file" className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> CRM / Bid management
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">Tenders</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
                Manage each bid from draft to outcome with owners, deadlines, values and a complete audit trail.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live pipeline
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-600">
                  {rows.length} on this page
                </span>
              </div>
            </div>
          </div>
          {canCreate ? (
            <Link to="/tenders/new">
              <Button className="h-11 gap-2 bg-brand-800 px-5 text-sm font-semibold shadow-lg shadow-brand-800/20 hover:bg-brand-900">
                <Icon name="plus" className="h-4 w-4" /> Add tender
              </Button>
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Draft" value={countFor("DRAFT")} detail="Brief preparation" icon="file" tone="slate" active={filters.status === "DRAFT"} onClick={() => onStatusChange(filters.status === "DRAFT" ? "" : "DRAFT")} />
        <MetricCard label="Open" value={countFor("OPEN")} detail="Live for bidding" icon="flag" tone="brand" active={filters.status === "OPEN"} onClick={() => onStatusChange(filters.status === "OPEN" ? "" : "OPEN")} />
        <MetricCard label="Submitted" value={countFor("SUBMITTED")} detail="Awaiting outcome" icon="clock" tone="blue" active={filters.status === "SUBMITTED"} onClick={() => onStatusChange(filters.status === "SUBMITTED" ? "" : "SUBMITTED")} />
        <MetricCard label="Won" value={countFor("WON")} detail="Awarded bids" icon="wallet" tone="emerald" active={filters.status === "WON"} onClick={() => onStatusChange(filters.status === "WON" ? "" : "WON")} />
        <MetricCard label={filters.includeDeleted ? "Including deleted" : "Deleted hidden"} value={filters.includeDeleted ? deletedCount : rows.length} detail={filters.includeDeleted ? "Restore where permitted" : "Use filters to review archived bids"} icon="restore" tone={filters.includeDeleted ? "rose" : "slate"} active={filters.includeDeleted} onClick={() => onIncludeDeletedChange(!filters.includeDeleted)} disabled={!canIncludeDeleted} />
      </div>

      <section aria-label="Tender filters" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search tenders</span>
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <Input className={`${controlClass} pl-10 pr-3`} type="search" value={filters.q} placeholder="Search title, number, reference or customer" onChange={(event) => onQueryChange(event.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" aria-expanded={filtersOpen} className={`h-11 flex-1 gap-2 rounded-xl px-4 text-sm font-semibold sm:flex-none ${filtersOpen ? "border-brand-300 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-600"}`} onClick={() => setFiltersOpen((open) => !open)}>
              <Icon name="sliders" className="h-4 w-4" /> Filters
              {activeChips.length ? <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-700 px-1.5 text-[10px] font-bold text-white">{activeChips.length}</span> : null}
            </Button>
            <Button variant="secondary" className="h-11 rounded-xl border-slate-200 px-4 text-sm font-semibold text-slate-600" disabled={!hasActiveFilters} onClick={onClearFilters}>
              <Icon name="x" className="h-4 w-4" /> Clear
            </Button>
          </div>
        </div>

        {filtersOpen ? (
          <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3 shadow-inner sm:grid-cols-2 sm:p-4 xl:grid-cols-4">
            <FilterField label="Status">
              <select aria-label="Filter by status" className={controlClass} value={filters.status} onChange={(event) => onStatusChange(event.target.value as "" | TenderStatus)}>
                <option value="">All statuses</option>
                {TENDER_STATUSES.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
              </select>
            </FilterField>
            <FilterField label="Customer">
              <select aria-label="Filter by customer" className={controlClass} value={filters.customerId} onChange={(event) => onCustomerChange(event.target.value)}>
                <option value="">All customers</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName} ({customer.customerNumber})</option>)}
              </select>
            </FilterField>
            <FilterField label="Owner">
              <select aria-label="Filter by owner" className={controlClass} value={filters.ownerUserId} onChange={(event) => onOwnerChange(event.target.value)}>
                <option value="">All owners</option>
                {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.firstName} {owner.lastName}</option>)}
              </select>
            </FilterField>
            <FilterField label="Created from">
              <Input aria-label="Created from date" className={controlClass} type="date" value={filters.from} onChange={(event) => onFromChange(event.target.value)} />
            </FilterField>
            <FilterField label="Created to">
              <Input aria-label="Created to date" className={controlClass} type="date" value={filters.to} onChange={(event) => onToChange(event.target.value)} />
            </FilterField>
            <FilterField label="Sort by" className="sm:col-span-2 xl:col-span-2">
              <select aria-label="Sort tenders" className={controlClass} value={`${filters.sort}:${filters.order}`} onChange={(event) => { const [sort, order] = event.target.value.split(":"); onSortChange(sort as TenderListFilters["sort"]); onOrderChange(order as "asc" | "desc"); }}>
                {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </FilterField>
            <FilterField label="Records" className="sm:col-span-2 xl:col-span-2">
              <button type="button" role="switch" aria-checked={filters.includeDeleted} disabled={!canIncludeDeleted} onClick={() => onIncludeDeletedChange(!filters.includeDeleted)} className={`flex h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${filters.includeDeleted ? "border-brand-300 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600"}`}>
                <span>Include deleted</span>
                <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${filters.includeDeleted ? "bg-brand-600" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${filters.includeDeleted ? "left-[18px]" : "left-0.5"}`} />
                </span>
              </button>
            </FilterField>
          </div>
        ) : null}

        {activeChips.length ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Active</span>
            {activeChips.map((chip) => (
              <button key={chip.key} type="button" aria-label={`Remove ${chip.label} filter`} onClick={chip.onClear} className="group inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-100 transition hover:bg-brand-100">
                <span className="truncate">{chip.label}</span>
                <Icon name="x" className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
              </button>
            ))}
            <button type="button" onClick={onClearFilters} className="ml-auto text-xs font-semibold text-slate-500 transition hover:text-rose-600">Clear all</button>
          </div>
        ) : null}
      </section>

      <section aria-label="Tender directory" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {actionError ? (
          <div role="alert" className="m-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:m-5">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> {actionError}
          </div>
        ) : null}

        <div className="divide-y divide-slate-100 lg:hidden">
          {isLoading ? <LoadingCards /> : null}
          {!isLoading && error ? <ErrorState message={error} /> : null}
          {!isLoading && !error && rows.length === 0 ? <EmptyState filtersActive={hasActiveFilters} onClear={onClearFilters} canCreate={canCreate} /> : null}
          {!isLoading && !error ? rows.map((row) => (
            <TenderMobileCard key={row.id} row={row} canEdit={canEdit} canDelete={canDelete} canRestore={canRestore} deleting={deletingId === row.id} restoring={restoringId === row.id} onDelete={() => onDelete(row)} onRestore={() => onRestore(row)} />
          )) : null}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Tender</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Deadline</th>
                <th className="px-5 py-3.5 text-right">Value</th>
                <th className="px-5 py-3.5">Award</th>
                <th className="px-5 py-3.5">Owner</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? <LoadingRows /> : null}
              {!isLoading && error ? <ErrorState message={error} colSpan={8} /> : null}
              {!isLoading && !error && rows.length === 0 ? <EmptyState filtersActive={hasActiveFilters} onClear={onClearFilters} canCreate={canCreate} colSpan={8} /> : null}
              {!isLoading && !error ? rows.map((row) => {
                const overdue = isDeadlineOverdue(row.submissionDeadline, row.status);
                return (
                  <tr key={row.id} className={`group transition-colors hover:bg-brand-50/30 ${row.deletedAt ? "opacity-60" : ""}`}>
                    <td className="max-w-[280px] px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100"><Icon name="file" className="h-4 w-4" /></span>
                        <div className="min-w-0">
                          <Link className="flex items-center gap-2 truncate font-semibold text-slate-950 decoration-brand-700 underline-offset-4 hover:text-brand-800 hover:underline" to={`/tenders/${row.id}`}>
                            <span className="truncate">{row.title}</span>
                            {row.deletedAt ? <DeletedPill /> : null}
                          </Link>
                          <p className="mt-0.5 font-mono text-[10px] text-slate-400">{row.tenderNumber}</p>
                          {row.referenceNumber ? <p className="mt-0.5 truncate text-xs text-slate-500">Ref: {row.referenceNumber}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[220px] px-5 py-4">
                      <p className="truncate font-medium text-slate-800">{row.customer?.displayName ?? "—"}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{row.customer?.customerNumber ?? ""}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4"><TenderStatusBadge status={row.status} deleted={Boolean(row.deletedAt)} /></td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 ${overdue ? "font-medium text-amber-800" : "text-slate-700"}`}>
                        <Icon name="clock" className="h-3.5 w-3.5 text-slate-400" /> {formatDateTime(row.submissionDeadline)}
                      </span>
                      {overdue ? <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">Overdue</p> : null}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-slate-800">{formatMoney(row.estimatedValue, row.currencyCode)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatDate(row.expectedAwardDate)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">{row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : "—"}</td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <IconLink label="View tender" to={`/tenders/${row.id}`} icon="eye" />
                        {canEdit && !row.deletedAt ? <IconLink label="Edit tender" to={`/tenders/${row.id}/edit`} icon="pencil" /> : null}
                        {canRestore && row.deletedAt ? <IconAction label="Restore tender" icon="restore" tone="brand" busy={restoringId === row.id} onClick={() => onRestore(row)} /> : null}
                        {canDelete && !row.deletedAt ? <IconAction label="Delete tender" icon="trash" tone="rose" busy={deletingId === row.id} onClick={() => onDelete(row)} /> : null}
                      </div>
                    </td>
                  </tr>
                );
              }) : null}
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

function MetricCard({ label, value, detail, icon, tone, active, onClick, disabled = false }: { label: string; value: number; detail: string; icon: IconName; tone: Tone; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`group relative overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-sm transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 ${active ? "border-brand-300 ring-2 ring-brand-100" : "border-slate-200/80"}`}>
      <span className={`absolute inset-x-0 top-0 h-0.5 ${toneStyles[tone].accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-slate-950">{value}</p>
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${toneStyles[tone].tile}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-400">{detail}</p>
    </button>
  );
}

function FilterField({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      {children}
    </div>
  );
}

function DeletedPill() {
  return <span className="inline-flex shrink-0 rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-700 ring-1 ring-inset ring-rose-100">Deleted</span>;
}

function IconLink({ label, to, icon }: { label: string; to: string; icon: IconName }) {
  return (
    <Link aria-label={label} title={label} to={to} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
      <Icon name={icon} className="h-4 w-4" />
    </Link>
  );
}

function IconAction({ label, icon, tone = "slate", busy = false, onClick }: { label: string; icon: IconName; tone?: "slate" | "rose" | "brand"; busy?: boolean; onClick: () => void }) {
  const styles = tone === "rose" ? "text-rose-600 hover:bg-rose-50" : tone === "brand" ? "text-brand-600 hover:bg-brand-50" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900";
  return (
    <button type="button" aria-label={label} title={busy ? "Working…" : label} disabled={busy} onClick={onClick} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-40 ${styles}`}>
      <Icon name={busy ? "sliders" : icon} className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
    </button>
  );
}

function LoadingRows() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((index) => (
        <tr key={index} className="animate-pulse">
          <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="h-9 w-9 rounded-xl bg-slate-100" /><div className="space-y-2"><span className="block h-3 w-36 rounded bg-slate-200" /><span className="block h-2.5 w-20 rounded bg-slate-100" /></div></div></td>
          <td className="px-5 py-4"><span className="block h-3 w-32 rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="block h-5 w-20 rounded-full bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="block h-3 w-28 rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="ml-auto block h-3 w-24 rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="block h-3 w-20 rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="block h-3 w-20 rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="ml-auto block h-7 w-16 rounded bg-slate-100" /></td>
        </tr>
      ))}
    </>
  );
}

function LoadingCards() {
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

function ErrorState({ message, colSpan }: { message: string; colSpan?: number }) {
  const content = (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100"><Icon name="alert" className="h-6 w-6" /></span>
      <p className="text-sm font-semibold text-slate-900">Couldn’t load tenders</p>
      <p className="max-w-md text-xs leading-5 text-slate-500">{message}</p>
    </div>
  );
  return colSpan ? <tr><td colSpan={colSpan}>{content}</td></tr> : <div>{content}</div>;
}

function EmptyState({ filtersActive, onClear, canCreate, colSpan }: { filtersActive: boolean; onClear: () => void; canCreate: boolean; colSpan?: number }) {
  const content = (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200"><Icon name="search" className="h-7 w-7" /></span>
      <div>
        <p className="text-sm font-semibold text-slate-900">{filtersActive ? "No tenders match these filters" : "No tenders yet"}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{filtersActive ? "Adjust the filters to widen the results." : "Create a tender to start tracking a bid."}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {filtersActive ? <Button variant="secondary" className="h-9 gap-2 px-3 text-xs font-semibold" onClick={onClear}><Icon name="x" className="h-3.5 w-3.5" /> Clear filters</Button> : null}
        {canCreate ? <Link to="/tenders/new"><Button className="h-9 gap-2 bg-brand-800 px-3 text-xs font-semibold"><Icon name="plus" className="h-3.5 w-3.5" /> Add tender</Button></Link> : null}
      </div>
    </div>
  );
  return colSpan ? <tr><td colSpan={colSpan}>{content}</td></tr> : <div>{content}</div>;
}

function TenderMobileCard({ row, canEdit, canDelete, canRestore, deleting, restoring, onDelete, onRestore }: { row: Tender; canEdit: boolean; canDelete: boolean; canRestore: boolean; deleting: boolean; restoring: boolean; onDelete: () => void; onRestore: () => void }) {
  const overdue = isDeadlineOverdue(row.submissionDeadline, row.status);
  return (
    <article className="p-4 transition-colors hover:bg-slate-50/60">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100"><Icon name="file" className="h-4 w-4" /></span>
          <div className="min-w-0">
            <Link className="block break-words font-semibold text-slate-950 hover:text-brand-800" to={`/tenders/${row.id}`}>{row.title}</Link>
            <p className="mt-1 font-mono text-[10px] text-slate-400">{row.tenderNumber}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">{row.customer?.displayName ?? "No customer"}{row.deletedAt ? <DeletedPill /> : null}</p>
          </div>
        </div>
        <TenderStatusBadge status={row.status} deleted={Boolean(row.deletedAt)} />
      </div>
      <dl className="mt-3 grid gap-2 rounded-xl bg-slate-50/80 p-3 text-xs">
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Value</dt><dd className="font-semibold tabular-nums text-slate-800">{formatMoney(row.estimatedValue, row.currencyCode)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Deadline</dt><dd className={`font-medium ${overdue ? "text-amber-800" : "text-slate-800"}`}>{formatDateTime(row.submissionDeadline)}{overdue ? " · Overdue" : ""}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Award</dt><dd className="font-medium text-slate-800">{formatDate(row.expectedAwardDate)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Owner</dt><dd className="font-medium text-slate-800">{row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : "—"}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={`/tenders/${row.id}`}><Button variant="secondary" className="h-8 gap-1.5 px-3 text-xs"><Icon name="eye" className="h-3.5 w-3.5" /> View</Button></Link>
        {canEdit && !row.deletedAt ? <Link to={`/tenders/${row.id}/edit`}><Button variant="secondary" className="h-8 gap-1.5 px-3 text-xs"><Icon name="pencil" className="h-3.5 w-3.5" /> Edit</Button></Link> : null}
        {canRestore && row.deletedAt ? <Button variant="secondary" className="h-8 gap-1.5 px-3 text-xs text-brand-700" disabled={restoring} onClick={onRestore}><Icon name="restore" className="h-3.5 w-3.5" /> Restore</Button> : null}
        {canDelete && !row.deletedAt ? <Button variant="secondary" className="h-8 gap-1.5 px-3 text-xs text-rose-700" disabled={deleting} onClick={onDelete}><Icon name="trash" className="h-3.5 w-3.5" /> Delete</Button> : null}
      </div>
    </article>
  );
}

function Icon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    wallet: <><rect x="3" y="6" width="18" height="12" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
    restore: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><polyline points="3 3 3 8 8 8" /><path d="M12 7v5l3 2" /></>,
    search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    chevronLeft: <polyline points="15 18 9 12 15 6" />,
    chevronRight: <polyline points="9 18 15 12 9 6" />,
    alert: <><path d="m10.29 3.86-8.18 14.14A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>,
    flag: <><path d="M4 22V4" /><path d="M4 5h13l-2 4 2 4H4" /></>,
    sliders: <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 21v-4h6v4" /><path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01" /></>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

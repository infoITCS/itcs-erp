import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import type { ResellerStatus, ResellerSummary } from "./api.ts";

export interface ResellerListFilters {
  q: string;
  status: "" | ResellerStatus;
  country: string;
  from: string;
  to: string;
  sort: "createdAt" | "displayName" | "resellerNumber";
  order: "asc" | "desc";
  includeDeleted: boolean;
}

interface ResellerListViewProps {
  rows: ResellerSummary[];
  filters: ResellerListFilters;
  isLoading: boolean;
  error: string | null;
  actionError: string | null;
  pageSummary: string;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canRestore: boolean;
  deletingId: string | null;
  restoringId: string | null;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: "" | ResellerStatus) => void;
  onCountryChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onSortChange: (value: ResellerListFilters["sort"]) => void;
  onOrderChange: (value: "asc" | "desc") => void;
  onIncludeDeletedChange: (value: boolean) => void;
  onClearFilters: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onDelete: (row: ResellerSummary) => void;
  onRestore: (row: ResellerSummary) => void;
}

type Tone = "brand" | "emerald" | "amber" | "slate" | "rose";
type IconName =
  | "users"
  | "check"
  | "pause"
  | "alert"
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
  | "globe";

const toneStyles: Record<Tone, { tile: string; accent: string }> = {
  brand: { tile: "bg-brand-50 text-brand-700 ring-brand-100", accent: "bg-brand-500" },
  emerald: { tile: "bg-emerald-50 text-emerald-700 ring-emerald-100", accent: "bg-emerald-500" },
  amber: { tile: "bg-amber-50 text-amber-700 ring-amber-100", accent: "bg-amber-500" },
  slate: { tile: "bg-slate-100 text-slate-600 ring-slate-200", accent: "bg-slate-400" },
  rose: { tile: "bg-rose-50 text-rose-700 ring-rose-100", accent: "bg-rose-500" },
};

const controlClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50";

const statusOptions: Array<[string, string]> = [
  ["", "All statuses"],
  ["ACTIVE", "Active"],
  ["INACTIVE", "Inactive"],
  ["SUSPENDED", "Suspended"],
];

const sortOptions: Array<[string, string]> = [
  ["createdAt:desc", "Newest"],
  ["createdAt:asc", "Oldest"],
  ["displayName:asc", "Name A-Z"],
  ["displayName:desc", "Name Z-A"],
  ["resellerNumber:asc", "Number A-Z"],
];

export function ResellerListView({
  rows,
  filters,
  isLoading,
  error,
  actionError,
  pageSummary,
  hasNextPage,
  hasPreviousPage,
  canCreate,
  canUpdate,
  canDelete,
  canRestore,
  deletingId,
  restoringId,
  onQueryChange,
  onStatusChange,
  onCountryChange,
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
}: ResellerListViewProps) {
  const visible = rows.filter((row) => !row.deletedAt);
  const activeCount = visible.filter((row) => row.status === "ACTIVE").length;
  const inactiveCount = visible.filter((row) => row.status === "INACTIVE").length;
  const suspendedCount = visible.filter((row) => row.status === "SUSPENDED").length;
  const deletedCount = rows.filter((row) => row.deletedAt).length;
  const hasActiveFilters = Boolean(filters.q || filters.status || filters.country || filters.from || filters.to || filters.includeDeleted || filters.sort !== "createdAt" || filters.order !== "desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const selectedSort = sortOptions.find(([value]) => value === `${filters.sort}:${filters.order}`)?.[1] ?? "Custom sort";
  const activeChips: Array<{ key: string; label: string; onClear: () => void }> = [];

  if (filters.q) activeChips.push({ key: "q", label: `Search: ${filters.q}`, onClear: () => onQueryChange("") });
  if (filters.status) activeChips.push({ key: "status", label: `Status: ${filters.status.charAt(0) + filters.status.slice(1).toLowerCase()}`, onClear: () => onStatusChange("") });
  if (filters.country) activeChips.push({ key: "country", label: `Country: ${filters.country}`, onClear: () => onCountryChange("") });
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
              <Icon name="building" className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> CRM / Channel partners
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">Resellers</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
                Manage partner accounts, pricing defaults, addresses, contacts and assigned customers from one workspace.
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
          {canCreate ? (
            <Link to="/resellers/new">
              <Button className="h-11 gap-2 bg-brand-800 px-5 text-sm font-semibold shadow-lg shadow-brand-800/20 hover:bg-brand-900">
                <Icon name="plus" className="h-4 w-4" /> Add reseller
              </Button>
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active" value={activeCount} detail="Ready for assignments" icon="check" tone="emerald" active={filters.status === "ACTIVE"} onClick={() => onStatusChange(filters.status === "ACTIVE" ? "" : "ACTIVE")} />
        <MetricCard label="Inactive" value={inactiveCount} detail="Paused partners" icon="pause" tone="slate" active={filters.status === "INACTIVE"} onClick={() => onStatusChange(filters.status === "INACTIVE" ? "" : "INACTIVE")} />
        <MetricCard label="Suspended" value={suspendedCount} detail="Blocked from assignment" icon="alert" tone="amber" active={filters.status === "SUSPENDED"} onClick={() => onStatusChange(filters.status === "SUSPENDED" ? "" : "SUSPENDED")} />
        <MetricCard label={filters.includeDeleted ? "Including deleted" : "Deleted hidden"} value={filters.includeDeleted ? deletedCount : rows.length} detail={filters.includeDeleted ? "Restore available where permitted" : "Use the toggle to review archived rows"} icon="restore" tone={filters.includeDeleted ? "rose" : "brand"} active={filters.includeDeleted} onClick={() => onIncludeDeletedChange(!filters.includeDeleted)} disabled={!canDelete && !canRestore} />
      </div>

      <section aria-label="Reseller directory" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-200/80 bg-slate-50/40 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Search resellers</span>
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Icon name="search" className="h-4 w-4" />
              </span>
              <Input className={`${controlClass} pl-10 pr-3`} type="search" value={filters.q} placeholder="Search number, name, email or phone" onChange={(event) => onQueryChange(event.target.value)} />
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
            <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-3 shadow-inner sm:grid-cols-2 sm:p-4 xl:grid-cols-4">
              <FilterField label="Status">
                <select aria-label="Filter by status" className={controlClass} value={filters.status} onChange={(event) => onStatusChange(event.target.value as "" | ResellerStatus)}>
                  {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </FilterField>
              <FilterField label="Country code">
                <Input aria-label="Filter by country code" className={controlClass} value={filters.country} maxLength={2} placeholder="PK" onChange={(event) => onCountryChange(event.target.value.toUpperCase())} />
              </FilterField>
              <FilterField label="Created from">
                <Input aria-label="Created from date" className={controlClass} type="date" value={filters.from} onChange={(event) => onFromChange(event.target.value)} />
              </FilterField>
              <FilterField label="Created to">
                <Input aria-label="Created to date" className={controlClass} type="date" value={filters.to} onChange={(event) => onToChange(event.target.value)} />
              </FilterField>
              <FilterField label="Sort by" className="sm:col-span-2 xl:col-span-2">
                <select aria-label="Sort resellers" className={controlClass} value={`${filters.sort}:${filters.order}`} onChange={(event) => { const [sort, order] = event.target.value.split(":"); onSortChange(sort as ResellerListFilters["sort"]); onOrderChange(order as "asc" | "desc"); }}>
                  {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </FilterField>
              <FilterField label="Records" className="sm:col-span-2 xl:col-span-2">
                <button type="button" role="switch" aria-checked={filters.includeDeleted} disabled={!canDelete && !canRestore} onClick={() => onIncludeDeletedChange(!filters.includeDeleted)} className={`flex h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${filters.includeDeleted ? "border-brand-300 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600"}`}>
                  <span>Include deleted</span>
                  <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${filters.includeDeleted ? "bg-brand-600" : "bg-slate-300"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${filters.includeDeleted ? "left-[18px]" : "left-0.5"}`} />
                  </span>
                </button>
              </FilterField>
            </div>
          ) : null}

          {activeChips.length ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-4">
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
        </div>

        {actionError ? (
          <div role="alert" className="m-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:m-5">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> {actionError}
          </div>
        ) : null}

        <div className="divide-y divide-slate-100 lg:hidden">
          {isLoading ? <LoadingCards /> : null}
          {!isLoading && error ? <ErrorState message={error} /> : null}
          {!isLoading && !error && rows.length === 0 ? <EmptyState canClear={hasActiveFilters} onClear={onClearFilters} canCreate={canCreate} /> : null}
          {!isLoading && !error ? rows.map((row) => (
            <MobileCard key={row.id} row={row} canUpdate={canUpdate} canDelete={canDelete} canRestore={canRestore} deleting={deletingId === row.id} restoring={restoringId === row.id} onDelete={() => onDelete(row)} onRestore={() => onRestore(row)} />
          )) : null}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Reseller</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5">Country</th>
                <th className="px-5 py-3.5">Pricing</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Customers</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? <LoadingRows /> : null}
              {!isLoading && error ? <ErrorState message={error} colSpan={7} /> : null}
              {!isLoading && !error && rows.length === 0 ? <EmptyState canClear={hasActiveFilters} onClear={onClearFilters} canCreate={canCreate} colSpan={7} /> : null}
              {!isLoading && !error ? rows.map((row) => (
                <tr key={row.id} className={`group transition-colors hover:bg-brand-50/30 ${row.deletedAt ? "opacity-60" : ""}`}>
                  <td className="max-w-[280px] px-5 py-4">
                    <div className="flex items-center gap-3">
                      <ResellerAvatar name={row.displayName} />
                      <div className="min-w-0">
                        <Link className="flex items-center gap-2 truncate font-semibold text-slate-950 decoration-brand-700 underline-offset-4 hover:text-brand-800 hover:underline" to={`/resellers/${row.id}`}>
                          <span className="truncate">{row.displayName}</span>
                          {row.deletedAt ? <DeletedPill /> : null}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{row.legalName}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">{row.resellerNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[240px] px-5 py-4">
                    <p className="truncate text-slate-700">{row.email ?? "—"}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{row.phone ?? "—"}</p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 text-slate-700">
                      <Icon name="globe" className="h-3.5 w-3.5 text-slate-400" /> {row.countryCode} · {row.currencyCode}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="inline-flex rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-100">{row.priceListCode}</span>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {row.defaultDiscountPercent ? `${row.defaultDiscountPercent}% discount` : "No default discount"}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4"><StatusBadge status={row.status} /></td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-slate-800">{row._count?.customers ?? 0}</td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <IconLink label="View reseller" to={`/resellers/${row.id}`} icon="eye" />
                      {canUpdate && !row.deletedAt ? <IconLink label="Edit reseller" to={`/resellers/${row.id}/edit`} icon="pencil" /> : null}
                      {canRestore && row.deletedAt ? <IconAction label="Restore reseller" icon="restore" tone="brand" busy={restoringId === row.id} onClick={() => onRestore(row)} /> : null}
                      {canDelete && !row.deletedAt ? <IconAction label="Delete reseller" icon="trash" tone="rose" busy={deletingId === row.id} onClick={() => onDelete(row)} /> : null}
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

function ResellerAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  const palettes = ["bg-brand-50 text-brand-700 ring-brand-100", "bg-emerald-50 text-emerald-700 ring-emerald-100", "bg-violet-50 text-violet-700 ring-violet-100", "bg-amber-50 text-amber-700 ring-amber-100", "bg-sky-50 text-sky-700 ring-sky-100"];
  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length;
  return <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ring-1 ${palettes[index]}`}>{initials || "?"}</span>;
}

function StatusBadge({ status }: { status: ResellerStatus }) {
  const styles = status === "ACTIVE"
    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
    : status === "SUSPENDED"
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : "bg-slate-100 text-slate-700 ring-slate-200";
  const dot = status === "ACTIVE" ? "bg-emerald-500" : status === "SUSPENDED" ? "bg-amber-500" : "bg-slate-400";
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${styles}`}><span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {status.charAt(0) + status.slice(1).toLowerCase()}</span>;
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
          <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="h-9 w-9 rounded-xl bg-slate-100" /><span className="block h-3 w-32 rounded bg-slate-200" /></div></td>
          <td className="px-5 py-4"><span className="block h-3 w-40 rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="block h-3 w-20 rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="block h-3 w-24 rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="block h-5 w-16 rounded-full bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="ml-auto block h-3 w-6 rounded bg-slate-100" /></td>
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
      <p className="text-sm font-semibold text-slate-900">Couldn’t load resellers</p>
      <p className="max-w-md text-xs leading-5 text-slate-500">{message}</p>
    </div>
  );
  return colSpan ? <tr><td colSpan={colSpan}>{content}</td></tr> : <div>{content}</div>;
}

function EmptyState({ canClear, onClear, canCreate, colSpan }: { canClear: boolean; onClear: () => void; canCreate: boolean; colSpan?: number }) {
  const content = (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200"><Icon name="search" className="h-7 w-7" /></span>
      <div>
        <p className="text-sm font-semibold text-slate-900">No resellers found</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Try another search or add a new channel partner.</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {canClear ? <Button variant="secondary" className="h-9 gap-2 px-3 text-xs font-semibold" onClick={onClear}><Icon name="x" className="h-3.5 w-3.5" /> Clear filters</Button> : null}
        {canCreate ? <Link to="/resellers/new"><Button className="h-9 gap-2 bg-brand-800 px-3 text-xs font-semibold"><Icon name="plus" className="h-3.5 w-3.5" /> Add reseller</Button></Link> : null}
      </div>
    </div>
  );
  return colSpan ? <tr><td colSpan={colSpan}>{content}</td></tr> : <div>{content}</div>;
}

function MobileCard({ row, canUpdate, canDelete, canRestore, deleting, restoring, onDelete, onRestore }: { row: ResellerSummary; canUpdate: boolean; canDelete: boolean; canRestore: boolean; deleting: boolean; restoring: boolean; onDelete: () => void; onRestore: () => void }) {
  return (
    <article className="p-4 transition-colors hover:bg-slate-50/60">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ResellerAvatar name={row.displayName} />
          <div className="min-w-0">
            <Link className="block break-words font-semibold text-slate-950 hover:text-brand-800" to={`/resellers/${row.id}`}>{row.displayName}</Link>
            <p className="mt-1 font-mono text-[10px] text-slate-400">{row.resellerNumber}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">{row.countryCode} · {row.currencyCode}{row.deletedAt ? <DeletedPill /> : null}</p>
          </div>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <dl className="mt-3 grid gap-2 rounded-xl bg-slate-50/80 p-3 text-xs">
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Contact</dt><dd className="truncate font-medium text-slate-800">{row.email ?? row.phone ?? "—"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Price list</dt><dd className="font-medium text-slate-800">{row.priceListCode}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Customers</dt><dd className="font-medium tabular-nums text-slate-800">{row._count?.customers ?? 0}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={`/resellers/${row.id}`}><Button variant="secondary" className="h-8 gap-1.5 px-3 text-xs"><Icon name="eye" className="h-3.5 w-3.5" /> View</Button></Link>
        {canUpdate && !row.deletedAt ? <Link to={`/resellers/${row.id}/edit`}><Button variant="secondary" className="h-8 gap-1.5 px-3 text-xs"><Icon name="pencil" className="h-3.5 w-3.5" /> Edit</Button></Link> : null}
        {canRestore && row.deletedAt ? <Button variant="secondary" className="h-8 gap-1.5 px-3 text-xs text-brand-700" disabled={restoring} onClick={onRestore}><Icon name="restore" className="h-3.5 w-3.5" /> Restore</Button> : null}
        {canDelete && !row.deletedAt ? <Button variant="secondary" className="h-8 gap-1.5 px-3 text-xs text-rose-700" disabled={deleting} onClick={onDelete}><Icon name="trash" className="h-3.5 w-3.5" /> Delete</Button> : null}
      </div>
    </article>
  );
}

function Icon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    check: <path d="m20 6-11 11-5-5" />,
    pause: <><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>,
    alert: <><path d="m10.29 3.86-8.18 14.14A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    chevronLeft: <polyline points="15 18 9 12 15 6" />,
    chevronRight: <polyline points="9 18 15 12 9 6" />,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
    restore: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><polyline points="3 3 3 8 8 8" /><path d="M12 7v5l3 2" /></>,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    sliders: <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 21v-4h6v4" /><path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01" /></>,
    globe: <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

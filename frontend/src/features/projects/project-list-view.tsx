import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import {
  PROJECT_STATUSES,
  type Project,
  type ProjectStatus,
} from "./api.ts";
import { formatDate, ProjectStatusBadge, statusLabel } from "./shared.tsx";

export interface ProjectListFilters {
  q: string;
  status: "" | ProjectStatus;
  customerId: string;
  ownerUserId: string;
  from: string;
  to: string;
  sort: "createdAt" | "name" | "projectNumber";
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

interface ProjectListViewProps {
  rows: Project[];
  filters: ProjectListFilters;
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
  deletingId: string | null;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: "" | ProjectStatus) => void;
  onCustomerChange: (value: string) => void;
  onOwnerChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onSortChange: (value: "createdAt" | "name" | "projectNumber") => void;
  onOrderChange: (value: "asc" | "desc") => void;
  onIncludeDeletedChange: (value: boolean) => void;
  onClearFilters: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onDelete: (row: Project) => void;
}

const controlClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50";

const sortOptions: Array<[string, string]> = [
  ["createdAt:desc", "Newest"],
  ["createdAt:asc", "Oldest"],
  ["name:asc", "Name A-Z"],
  ["name:desc", "Name Z-A"],
  ["projectNumber:asc", "Number A-Z"],
];

export function ProjectListView({
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
  deletingId,
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
}: ProjectListViewProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const visible = rows.filter((row) => !row.deletedAt);
  const deletedCount = rows.filter((row) => row.deletedAt).length;
  const countFor = (status: ProjectStatus) => visible.filter((row) => row.status === status).length;
  const hasActiveFilters = Boolean(
    filters.q || filters.status || filters.customerId || filters.ownerUserId || filters.from || filters.to || filters.includeDeleted || filters.sort !== "createdAt" || filters.order !== "desc",
  );
  const selectedSort = sortOptions.find(([value]) => value === `${filters.sort}:${filters.order}`)?.[1] ?? "Custom sort";

  const activeChips: Array<{ key: string; label: string; onClear: () => void }> = [];
  if (filters.q) activeChips.push({ key: "q", label: `Search: ${filters.q}`, onClear: () => onQueryChange("") });
  if (filters.status) activeChips.push({ key: "status", label: `Status: ${statusLabel(filters.status)}`, onClear: () => onStatusChange("") });
  if (filters.customerId) {
    const name = customers.find((customer) => customer.id === filters.customerId)?.displayName;
    activeChips.push({ key: "customer", label: `Customer: ${name ?? "Selected"}`, onClear: () => onCustomerChange("") });
  }
  if (filters.ownerUserId) {
    const owner = owners.find((item) => item.id === filters.ownerUserId);
    activeChips.push({ key: "owner", label: `Owner: ${owner ? `${owner.firstName} ${owner.lastName}` : "Selected"}`, onClear: () => onOwnerChange("") });
  }
  if (filters.from) activeChips.push({ key: "from", label: `From: ${filters.from}`, onClear: () => onFromChange("") });
  if (filters.to) activeChips.push({ key: "to", label: `To: ${filters.to}`, onClear: () => onToChange("") });
  if (filters.includeDeleted) activeChips.push({ key: "deleted", label: "Deleted included", onClear: () => onIncludeDeletedChange(false) });
  if (filters.sort !== "createdAt" || filters.order !== "desc") {
    activeChips.push({
      key: "sort",
      label: `Sort: ${selectedSort}`,
      onClear: () => { onSortChange("createdAt"); onOrderChange("desc"); },
    });
  }

  return (
    <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-sky-400" />
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 sm:flex">
              <Icon name="folder" className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> Delivery / Project portfolio
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">Projects</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
                Plan delivery and open any project to see live customer income, payments, cost, and profit.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live portfolio
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-600">
                  {rows.length} on this page
                </span>
              </div>
            </div>
          </div>
          {canCreate ? (
            <Link to="/projects/new">
              <Button className="h-11 gap-2 bg-brand-800 px-5 text-sm font-semibold shadow-lg shadow-brand-800/20 hover:bg-brand-900">
                <Icon name="plus" className="h-4 w-4" /> New project
              </Button>
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Planned" value={countFor("PLANNED")} detail="Ready to start" tone="slate" active={filters.status === "PLANNED"} onClick={() => onStatusChange(filters.status === "PLANNED" ? "" : "PLANNED")} />
        <MetricCard label="In progress" value={countFor("IN_PROGRESS")} detail="In delivery" tone="brand" active={filters.status === "IN_PROGRESS"} onClick={() => onStatusChange(filters.status === "IN_PROGRESS" ? "" : "IN_PROGRESS")} />
        <MetricCard label="On hold" value={countFor("ON_HOLD")} detail="Paused work" tone="amber" active={filters.status === "ON_HOLD"} onClick={() => onStatusChange(filters.status === "ON_HOLD" ? "" : "ON_HOLD")} />
        <MetricCard label="Completed" value={countFor("COMPLETED")} detail="Delivered" tone="emerald" active={filters.status === "COMPLETED"} onClick={() => onStatusChange(filters.status === "COMPLETED" ? "" : "COMPLETED")} />
        <MetricCard label={filters.includeDeleted ? "Including deleted" : "Deleted hidden"} value={filters.includeDeleted ? deletedCount : rows.length} detail={filters.includeDeleted ? "Archived records visible" : "Use filters to review archived"} tone={filters.includeDeleted ? "rose" : "slate"} active={filters.includeDeleted} onClick={() => onIncludeDeletedChange(!filters.includeDeleted)} disabled={!canDelete} />
      </div>

      <section aria-label="Project filters" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search projects</span>
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <Input className={`${controlClass} pl-10`} type="search" value={filters.q} placeholder="Search name, number, customer or supplier" onChange={(event) => onQueryChange(event.target.value)} />
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
              <select aria-label="Filter by status" className={controlClass} value={filters.status} onChange={(event) => onStatusChange(event.target.value as "" | ProjectStatus)}>
                <option value="">All statuses</option>
                {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
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
            <FilterField label="Sort by">
              <select aria-label="Sort projects" className={controlClass} value={`${filters.sort}:${filters.order}`} onChange={(event) => { const [sort, order] = event.target.value.split(":"); onSortChange(sort as ProjectListFilters["sort"]); onOrderChange(order as "asc" | "desc"); }}>
                {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </FilterField>
            <FilterField label="Created from">
              <Input aria-label="Created from date" className={controlClass} type="date" value={filters.from} onChange={(event) => onFromChange(event.target.value)} />
            </FilterField>
            <FilterField label="Created to">
              <Input aria-label="Created to date" className={controlClass} type="date" value={filters.to} onChange={(event) => onToChange(event.target.value)} />
            </FilterField>
            <FilterField label="Archived" className="sm:col-span-2">
              <button type="button" role="switch" aria-checked={filters.includeDeleted} disabled={!canDelete} onClick={() => onIncludeDeletedChange(!filters.includeDeleted)} className={`flex h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${filters.includeDeleted ? "border-brand-300 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600"}`}>
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

      {actionError ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> {actionError}
        </div>
      ) : null}

      <section aria-label="Project cards" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? <LoadingCards /> : null}
        {!isLoading && error ? <div className="md:col-span-2 xl:col-span-3"><ErrorState message={error} /></div> : null}
        {!isLoading && !error && rows.length === 0 ? <div className="md:col-span-2 xl:col-span-3"><EmptyState filtersActive={hasActiveFilters} onClear={onClearFilters} canCreate={canCreate} /></div> : null}
        {!isLoading && !error ? rows.map((row) => (
          <ProjectCard key={row.id} row={row} canEdit={canEdit} canDelete={canDelete} deleting={deletingId === row.id} onDelete={() => onDelete(row)} />
        )) : null}
      </section>

      <footer className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 text-xs text-slate-500 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
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
  );
}

function ProjectCard({ row, canEdit, canDelete, deleting, onDelete }: { row: Project; canEdit: boolean; canDelete: boolean; deleting: boolean; onDelete: () => void }) {
  const customerName = row.customerContactName || row.supplierCompany || "No linked party";
  const ownerName = row.ownerUserId ? "Assigned owner" : "Unassigned";

  return (
    <article className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg ${row.deletedAt ? "opacity-60" : ""}`}>
      <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-sky-400" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <Icon name="folder" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <Link to={`/projects/${row.id}`} className="block truncate text-base font-bold text-slate-950 decoration-brand-700 underline-offset-4 hover:text-brand-800 hover:underline">
                {row.name}
              </Link>
              <p className="mt-0.5 font-mono text-[10px] text-slate-400">{row.projectNumber}</p>
            </div>
          </div>
          <ProjectStatusBadge status={row.status} deleted={Boolean(row.deletedAt)} />
        </div>

        <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">{row.description || "No project description provided."}</p>

        <dl className="mt-4 grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Info</dt>
            <dd className="mt-1 truncate font-semibold text-slate-700">{customerName}</dd>
            <dd className="truncate text-slate-500">{ownerName} · {formatDate(row.dueDate)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Supplier</dt>
            <dd className="mt-1 truncate font-semibold text-slate-700">{row.supplierCompany || "—"}</dd>
            <dd className="truncate text-slate-500">{row.supplierContactName || "No contact"}</dd>
          </div>
        </dl>

        <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-800">
              <Icon name="wallet" className="h-3.5 w-3.5" /> Live profit · income · cost
            </p>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">Auto</span>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-slate-600">Calculated from this customer's ERP documents. Open the project for the full breakdown.</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
        <Link to={`/projects/${row.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-brand-800 transition hover:bg-brand-50">
          <Icon name="eye" className="h-3.5 w-3.5" /> Open project
        </Link>
        <div className="flex items-center gap-1">
          {canEdit && !row.deletedAt ? (
            <Link to={`/projects/${row.id}/edit`} aria-label={`Edit ${row.name}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-brand-700">
              <Icon name="pencil" className="h-4 w-4" />
            </Link>
          ) : null}
          {canDelete && !row.deletedAt ? (
            <button type="button" aria-label={`Delete ${row.name}`} disabled={deleting} onClick={onDelete} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-rose-600 disabled:opacity-50">
              <Icon name="trash" className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MetricCard({ label, value, detail, tone, active, onClick, disabled }: { label: string; value: number; detail: string; tone: "slate" | "brand" | "amber" | "emerald" | "rose"; active: boolean; onClick: () => void; disabled?: boolean }) {
  const accents = {
    slate: "bg-slate-400",
    brand: "bg-brand-500",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    rose: "bg-rose-500",
  };
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-brand-300 ring-2 ring-brand-100" : "border-slate-200/80"}`}>
      <span className={`absolute inset-x-0 top-0 h-0.5 ${accents[tone]}`} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
    </button>
  );
}

function FilterField({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function LoadingCards() {
  return (
    <>
      {[0, 1, 2].map((index) => <div key={index} className="h-72 animate-pulse rounded-2xl bg-slate-100" />)}
    </>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> {message}
    </div>
  );
}

function EmptyState({ filtersActive, onClear, canCreate }: { filtersActive: boolean; onClear: () => void; canCreate: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Icon name="folder" className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-base font-bold text-slate-950">No projects found</h2>
      <p className="mt-1 text-sm text-slate-600">{filtersActive ? "Try clearing the active filters." : "Create your first project to start tracking delivery."}</p>
      <div className="mt-5 flex justify-center gap-2">
        {filtersActive ? <Button variant="secondary" onClick={onClear}>Clear filters</Button> : null}
        {canCreate ? <Link to="/projects/new"><Button className="bg-brand-800 hover:bg-brand-900">New project</Button></Link> : null}
      </div>
    </div>
  );
}

function Icon({ name, className }: { name: "folder" | "plus" | "search" | "sliders" | "x" | "alert" | "eye" | "pencil" | "trash" | "chevronLeft" | "chevronRight" | "wallet"; className?: string }) {
  const paths: Record<typeof name, ReactNode> = {
    folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    sliders: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="11" cy="18" r="2" /></>,
    x: <><path d="m6 6 12 12M18 6 6 18" /></>,
    alert: <><path d="m10.29 3.86-8.18 14.14A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4M12 17h.01" /></>,
    eye: <><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    chevronLeft: <><path d="m15 18-6-6 6-6" /></>,
    chevronRight: <><path d="m9 18 6-6-6-6" /></>,
    wallet: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

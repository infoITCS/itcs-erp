import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import {
  formatMoney,
  leadPriorityLabel,
  leadSourceLabel,
  leadStatusLabel,
  type Lead,
  type LeadOwnerRef,
  type LeadPriority,
  type LeadSource,
  type LeadStatus,
} from "./api.ts";

export interface LeadFilters {
  q: string;
  status: string;
  source: string;
  ownerUserId: string;
  priority: string;
  sort: string;
  order: "asc" | "desc";
  includeDeleted: boolean;
  onlyMine: boolean;
}

interface LeadListViewProps {
  rows: Lead[];
  filters: LeadFilters;
  owners: LeadOwnerRef[];
  sources: LeadSource[];
  priorities: LeadPriority[];
  statuses: LeadStatus[];
  currentUserId: string;
  isLoading: boolean;
  error: string | null;
  actionError: string | null;
  pageSummary: string;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  restoringId: string | null;
  contactingId: string | null;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canRestore: boolean;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onOwnerChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onOrderChange: (value: "asc" | "desc") => void;
  onIncludeDeletedChange: (value: boolean) => void;
  onToggleMine: () => void;
  onClearFilters: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onAdd: () => void;
  onMarkContacted: (lead: Lead) => void;
  onRestore: (lead: Lead) => void;
}

type Tone = "slate" | "brand" | "emerald" | "violet" | "amber";
type IconName =
  | "target" | "userCheck" | "badgeCheck" | "star" | "trophy" | "search" | "plus" | "x" | "chevronLeft"
  | "chevronRight" | "mail" | "phone" | "calendar" | "eye" | "pencil" | "rotate" | "zap" | "alert"
  | "building" | "flag" | "sort" | "trash" | "users";

const toneStyles: Record<Tone, { tile: string; accent: string }> = {
  slate: { tile: "bg-slate-100 text-slate-700 ring-slate-200", accent: "bg-slate-400" },
  brand: { tile: "bg-brand-50 text-brand-700 ring-brand-100", accent: "bg-brand-500" },
  emerald: { tile: "bg-emerald-50 text-emerald-700 ring-emerald-100", accent: "bg-emerald-500" },
  violet: { tile: "bg-violet-50 text-violet-700 ring-violet-100", accent: "bg-violet-500" },
  amber: { tile: "bg-amber-50 text-amber-700 ring-amber-100", accent: "bg-amber-500" },
};

const selectClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100";

export function LeadTabs({ active, onChange }: { active: "pipeline" | "analytics"; onChange: (tab: "pipeline" | "analytics") => void }) {
  return (
    <div className="inline-flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {(["pipeline", "analytics"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold capitalize transition ${
            active === value ? "bg-brand-800 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {value === "pipeline" ? <Icon name="target" className="h-3.5 w-3.5" /> : <Icon name="sort" className="h-3.5 w-3.5" />}
          {value}
        </button>
      ))}
    </div>
  );
}

export function LeadListView({
  rows,
  filters,
  owners,
  sources,
  priorities,
  statuses,
  currentUserId,
  isLoading,
  error,
  actionError,
  pageSummary,
  hasNextPage,
  hasPreviousPage,
  restoringId,
  contactingId,
  canCreate,
  canUpdate,
  canDelete,
  canRestore,
  onQueryChange,
  onStatusChange,
  onSourceChange,
  onOwnerChange,
  onPriorityChange,
  onSortChange,
  onOrderChange,
  onIncludeDeletedChange,
  onToggleMine,
  onClearFilters,
  onNext,
  onPrevious,
  onAdd,
  onMarkContacted,
  onRestore,
}: LeadListViewProps) {
  const counts = {
    new: rows.filter((row) => !row.deletedAt && row.status === "NEW").length,
    contacted: rows.filter((row) => !row.deletedAt && row.status === "CONTACTED").length,
    qualified: rows.filter((row) => !row.deletedAt && row.status === "QUALIFIED").length,
    unqualified: rows.filter((row) => !row.deletedAt && row.status === "UNQUALIFIED").length,
    converted: rows.filter((row) => !row.deletedAt && ["CONVERTED", "WON"].includes(row.status)).length,
  };
  const hasActiveFilters = Boolean(
    filters.q || filters.status || filters.source || filters.ownerUserId || filters.priority || filters.includeDeleted || filters.onlyMine,
  );

  return (
    <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-sky-400" />
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 sm:flex">
              <Icon name="target" className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> CRM / Pipeline
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">Leads</h1>
              <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-600">
                Capture enquiries, qualify the right ones, and convert them into customers and opportunities.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live pipeline
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-600">
                  {rows.length} on this page
                </span>
                {filters.onlyMine ? (
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-800 ring-1 ring-inset ring-brand-100">My leads</span>
                ) : null}
              </div>
            </div>
          </div>
          {canCreate ? (
            <Button onClick={onAdd} className="h-11 gap-2 bg-brand-800 px-5 text-sm font-semibold shadow-lg shadow-brand-800/20 hover:bg-brand-900">
              <Icon name="plus" className="h-4 w-4" /> Add lead
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Visible" value={rows.length} detail="On current page" icon="target" tone="slate" active={!filters.status && !filters.priority} onClick={onClearFilters} />
        <MetricCard label="New" value={counts.new} detail="Awaiting first contact" icon="zap" tone="brand" active={filters.status === "NEW"} onClick={() => onStatusChange(filters.status === "NEW" ? "" : "NEW")} />
        <MetricCard label="Qualified" value={counts.qualified} detail="Ready to convert" icon="badgeCheck" tone="violet" active={filters.status === "QUALIFIED"} onClick={() => onStatusChange(filters.status === "QUALIFIED" ? "" : "QUALIFIED")} />
        <MetricCard label="Unqualified" value={counts.unqualified} detail="Needs review" icon="flag" tone="amber" active={filters.status === "UNQUALIFIED"} onClick={() => onStatusChange(filters.status === "UNQUALIFIED" ? "" : "UNQUALIFIED")} />
        <MetricCard label="Converted / Won" value={counts.converted} detail="Closed outcomes" icon="trophy" tone="emerald" active={filters.status === "CONVERTED" || filters.status === "WON"} onClick={() => onStatusChange(filters.status === "CONVERTED" ? "" : "CONVERTED")} />
      </div>

      <section aria-label="Lead filters" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-slate-50/40 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" className="h-4 w-4" /></span>
              <Input
                className="h-10 pl-9"
                value={filters.q}
                placeholder="Search name, company, number, email…"
                aria-label="Search leads"
                onChange={(event) => onQueryChange(event.target.value)}
              />
            </div>
            <select aria-label="Filter by status" className={selectClass} value={filters.status} onChange={(event) => onStatusChange(event.target.value)}>
              <option value="">All statuses</option>
              {statuses.map((value) => <option key={value} value={value}>{leadStatusLabel(value)}</option>)}
            </select>
            <select aria-label="Filter by source" className={selectClass} value={filters.source} onChange={(event) => onSourceChange(event.target.value)}>
              <option value="">All sources</option>
              {sources.map((value) => <option key={value} value={value}>{leadSourceLabel(value)}</option>)}
            </select>
            <select aria-label="Filter by owner" className={selectClass} value={filters.ownerUserId} onChange={(event) => onOwnerChange(event.target.value)}>
              <option value="">All owners</option>
              {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.firstName} {owner.lastName}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <select aria-label="Filter by priority" className={selectClass} value={filters.priority} onChange={(event) => onPriorityChange(event.target.value)}>
              <option value="">All priorities</option>
              {priorities.map((value) => <option key={value} value={value}>{leadPriorityLabel(value)}</option>)}
            </select>
            <select aria-label="Sort leads by" className={selectClass} value={filters.sort} onChange={(event) => onSortChange(event.target.value)}>
              <option value="createdAt">Newest first</option>
              <option value="displayName">Lead name</option>
              <option value="leadNumber">Lead number</option>
              <option value="estimatedValue">Estimated value</option>
            </select>
            <button
              type="button"
              aria-label="Toggle sort direction"
              onClick={() => onOrderChange(filters.order === "desc" ? "asc" : "desc")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Icon name="sort" className={`h-4 w-4 transition ${filters.order === "asc" ? "rotate-180" : ""}`} />
              {filters.order === "desc" ? "Descending" : "Ascending"}
            </button>
            <Button variant="secondary" className="h-10 gap-2 px-3 text-xs font-semibold text-slate-600" disabled={!hasActiveFilters} onClick={onClearFilters}>
              <Icon name="x" className="h-3.5 w-3.5" /> Clear filters
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={filters.onlyMine}
                onClick={onToggleMine}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold ring-1 ring-inset transition ${
                  filters.onlyMine ? "bg-brand-800 text-white ring-brand-800" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                <Icon name="users" className="h-3.5 w-3.5" /> My leads
              </button>
              {canDelete || canRestore ? (
                <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full bg-white px-3 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50">
                  <input type="checkbox" className="h-3.5 w-3.5 accent-brand-800" checked={filters.includeDeleted} onChange={(event) => onIncludeDeletedChange(event.target.checked)} />
                  Include deleted
                </label>
              ) : null}
            </div>
            <span className="text-[11px] font-medium text-slate-400">Search updates as you type · sorted by {filters.sort}</span>
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
          {!isLoading && !error && rows.length === 0 ? <EmptyState onClearFilters={onClearFilters} canClear={hasActiveFilters} canCreate={canCreate} onAdd={onAdd} /> : null}
          {!isLoading && !error
            ? rows.map((row) => (
                <LeadMobileCard
                  key={row.id}
                  row={row}
                  currentUserId={currentUserId}
                  restoring={restoringId === row.id}
                  contacting={contactingId === row.id}
                  canUpdate={canUpdate}
                  canRestore={canRestore}
                  onMarkContacted={() => onMarkContacted(row)}
                  onRestore={() => onRestore(row)}
                />
              ))
            : null}
        </div>

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1360px] border-collapse text-left text-sm">
            <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Lead</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5">Source</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Priority</th>
                <th className="px-5 py-3.5 text-right">Value</th>
                <th className="px-5 py-3.5">Owner</th>
                <th className="px-5 py-3.5">Next action</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? <LoadingRows variant="table" /> : null}
              {!isLoading && error ? <ErrorState message={error} colSpan={9} /> : null}
              {!isLoading && !error && rows.length === 0 ? <EmptyState onClearFilters={onClearFilters} canClear={hasActiveFilters} canCreate={canCreate} onAdd={onAdd} colSpan={9} /> : null}
              {!isLoading && !error
                ? rows.map((row) => (
                    <tr key={row.id} className="group transition-colors hover:bg-brand-50/30">
                      <td className="max-w-[260px] px-5 py-4">
                        <div className="flex items-center gap-3">
                          <LeadAvatar name={row.displayName} />
                          <div className="min-w-0">
                            {row.deletedAt ? (
                              <p className="truncate font-semibold text-slate-500">{row.displayName}</p>
                            ) : (
                              <Link className="block truncate font-semibold text-slate-950 decoration-brand-700 underline-offset-4 hover:text-brand-800 hover:underline" to={`/leads/${row.id}`}>
                                {row.displayName}
                              </Link>
                            )}
                            <p className="mt-0.5 font-mono text-[10px] text-slate-400">{row.leadNumber}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">{row.companyName || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[220px] px-5 py-4">
                        {row.email ? (
                          <a className="flex items-center gap-1.5 truncate text-slate-700 hover:text-brand-800" href={`mailto:${row.email}`}>
                            <Icon name="mail" className="h-3.5 w-3.5 shrink-0 text-slate-400" /> <span className="truncate">{row.email}</span>
                          </a>
                        ) : <span className="text-slate-400">—</span>}
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <Icon name="phone" className="h-3.5 w-3.5 text-slate-400" /> {row.phone ?? "—"}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4"><span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">{leadSourceLabel(row.source)}</span></td>
                      <td className="whitespace-nowrap px-5 py-4"><StatusBadge status={row.status} deleted={Boolean(row.deletedAt)} /></td>
                      <td className="whitespace-nowrap px-5 py-4"><PriorityBadge priority={row.priority} /></td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-slate-800">{formatMoney(row.estimatedValue, row.currencyCode)}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className="flex items-center gap-2 text-slate-700">
                          <LeadAvatar name={row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : "?"} small />
                          <span className="text-xs font-medium">{row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : "Unassigned"}</span>
                          {row.ownerUserId === currentUserId ? <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold text-brand-700">YOU</span> : null}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-5 py-4">
                        <NextAction row={row} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex justify-end gap-1">
                          {row.deletedAt ? (
                            canRestore ? <IconAction label={restoringId === row.id ? "Restoring…" : "Restore lead"} icon="rotate" tone="emerald" disabled={restoringId === row.id} onClick={() => onRestore(row)} /> : null
                          ) : (
                            <>
                              <IconAction label="View lead" icon="eye" tone="slate" to={`/leads/${row.id}`} />
                              {canUpdate ? <IconAction label="Edit lead" icon="pencil" tone="brand" to={`/leads/${row.id}/edit`} /> : null}
                              {canUpdate && row.status === "NEW" ? (
                                <IconAction label={contactingId === row.id ? "Updating…" : "Mark contacted"} icon="phone" tone="violet" disabled={contactingId === row.id} onClick={() => onMarkContacted(row)} />
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
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

function MetricCard({ label, value, detail, icon, tone, active, onClick }: { label: string; value: number; detail: string; icon: IconName; tone: Tone; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`group relative overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${active ? "border-brand-300 ring-2 ring-brand-100" : "border-slate-200/80"}`}>
      <span className={`absolute inset-x-0 top-0 h-0.5 ${toneStyles[tone].accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-slate-950">{value}</p>
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${toneStyles[tone].tile}`}><Icon name={icon} className="h-5 w-5" /></span>
      </div>
      <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-400">{detail}</p>
    </button>
  );
}

function LeadAvatar({ name, small = false }: { name: string; small?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  const palettes = ["bg-brand-50 text-brand-700 ring-brand-100", "bg-emerald-50 text-emerald-700 ring-emerald-100", "bg-violet-50 text-violet-700 ring-violet-100", "bg-amber-50 text-amber-700 ring-amber-100", "bg-sky-50 text-sky-700 ring-sky-100"];
  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length;
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-xl font-bold ring-1 ${small ? "h-6 w-6 text-[9px]" : "h-9 w-9 text-xs"} ${palettes[index]}`}>{initials || "?"}</span>;
}

function StatusBadge({ status, deleted }: { status: Lead["status"]; deleted: boolean }) {
  if (deleted) {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Deleted</span>;
  }
  const styles: Record<Lead["status"], string> = {
    NEW: "bg-slate-100 text-slate-700 ring-slate-200",
    CONTACTED: "bg-indigo-50 text-indigo-800 ring-indigo-200",
    QUALIFIED: "bg-sky-50 text-sky-800 ring-sky-200",
    UNQUALIFIED: "bg-amber-50 text-amber-800 ring-amber-200",
    CONVERTED: "bg-brand-50 text-brand-800 ring-brand-200",
    WON: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  };
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${styles[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" /> {leadStatusLabel(status)}</span>;
}

function PriorityBadge({ priority }: { priority: Lead["priority"] }) {
  const styles: Record<Lead["priority"], string> = {
    LOW: "bg-slate-100 text-slate-600 ring-slate-200",
    NORMAL: "bg-sky-50 text-sky-700 ring-sky-200",
    HIGH: "bg-amber-50 text-amber-800 ring-amber-200",
    URGENT: "bg-rose-50 text-rose-800 ring-rose-200",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${styles[priority]}`}><Icon name="flag" className="h-3 w-3" /> {leadPriorityLabel(priority)}</span>;
}

function NextAction({ row }: { row: Lead }) {
  const overdue = Boolean(row.nextActionDueAt) && !["CONVERTED", "WON"].includes(row.status) && row.nextActionDueAt!.slice(0, 10) < new Date().toISOString().slice(0, 10);
  if (!row.nextAction && !row.nextActionDueAt) return <span className="text-slate-400">—</span>;
  return (
    <div className={`min-w-0 text-xs ${overdue ? "font-semibold text-amber-800" : "text-slate-700"}`}>
      <p className="truncate">{row.nextAction ?? "Follow-up scheduled"}</p>
      {row.nextActionDueAt ? <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500"><Icon name="calendar" className="h-3 w-3" /> {row.nextActionDueAt.slice(0, 10)}{overdue ? " · Overdue" : ""}</p> : null}
    </div>
  );
}

function IconAction({ label, icon, tone = "slate", disabled = false, onClick, to }: { label: string; icon: IconName; tone?: "slate" | "rose" | "brand" | "emerald" | "violet"; disabled?: boolean; onClick?: () => void; to?: string }) {
  const styles = tone === "rose" ? "text-rose-600 hover:bg-rose-50" : tone === "emerald" ? "text-emerald-700 hover:bg-emerald-50" : tone === "violet" ? "text-violet-700 hover:bg-violet-50" : tone === "brand" ? "text-brand-600 hover:bg-brand-50" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900";
  const className = `inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${styles}`;
  if (to) {
    return <Link aria-label={label} title={label} to={to} className={className}><Icon name={icon} className="h-4 w-4" /></Link>;
  }
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={className}><Icon name={icon} className="h-4 w-4" /></button>;
}

function LoadingRows({ variant }: { variant: "table" | "mobile" }) {
  if (variant === "mobile") {
    return <div className="space-y-4 p-4">{[0, 1, 2, 3].map((index) => <div key={index} className="flex animate-pulse items-center gap-3"><span className="h-9 w-9 rounded-xl bg-slate-200" /><div className="flex-1 space-y-2"><span className="block h-3 w-2/5 rounded bg-slate-200" /><span className="block h-2.5 w-3/5 rounded bg-slate-100" /></div></div>)}</div>;
  }
  return <>{[0, 1, 2, 3, 4].map((index) => <tr key={index} className="animate-pulse"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="h-9 w-9 rounded-xl bg-slate-100" /><span className="block h-3 w-28 rounded bg-slate-200" /></div></td><td className="px-5 py-4"><span className="block h-3 w-32 rounded bg-slate-100" /></td><td className="px-5 py-4"><span className="block h-3 w-16 rounded bg-slate-100" /></td><td className="px-5 py-4"><span className="block h-5 w-20 rounded-full bg-slate-100" /></td><td className="px-5 py-4"><span className="block h-5 w-16 rounded-full bg-slate-100" /></td><td className="px-5 py-4"><span className="ml-auto block h-3 w-20 rounded bg-slate-100" /></td><td className="px-5 py-4"><span className="block h-3 w-20 rounded bg-slate-100" /></td><td className="px-5 py-4"><span className="block h-3 w-24 rounded bg-slate-100" /></td><td className="px-5 py-4"><span className="ml-auto block h-7 w-20 rounded bg-slate-100" /></td></tr>)}</>;
}

function ErrorState({ message, colSpan }: { message: string; colSpan?: number }) {
  const content = <div className="flex flex-col items-center gap-2 px-6 py-12 text-center"><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100"><Icon name="alert" className="h-6 w-6" /></span><p className="text-sm font-semibold text-slate-900">Couldn’t load leads</p><p className="max-w-md text-xs leading-5 text-slate-500">{message}</p></div>;
  return colSpan ? <tr><td colSpan={colSpan}>{content}</td></tr> : <div>{content}</div>;
}

function EmptyState({ onClearFilters, canClear, canCreate, onAdd, colSpan }: { onClearFilters: () => void; canClear: boolean; canCreate: boolean; onAdd: () => void; colSpan?: number }) {
  const content = <div className="flex flex-col items-center gap-3 px-6 py-14 text-center"><span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200"><Icon name="search" className="h-7 w-7" /></span><div><p className="text-sm font-semibold text-slate-900">No leads found</p><p className="mt-1 text-xs leading-5 text-slate-500">Try another search or capture a fresh enquiry.</p></div><div className="flex flex-wrap items-center justify-center gap-2">{canClear ? <Button variant="secondary" className="h-9 gap-2 px-3 text-xs font-semibold" onClick={onClearFilters}><Icon name="x" className="h-3.5 w-3.5" /> Clear filters</Button> : null}{canCreate ? <Button className="h-9 gap-2 bg-brand-800 px-3 text-xs font-semibold" onClick={onAdd}><Icon name="plus" className="h-3.5 w-3.5" /> Add lead</Button> : null}</div></div>;
  return colSpan ? <tr><td colSpan={colSpan}>{content}</td></tr> : <div>{content}</div>;
}

function LeadMobileCard({ row, currentUserId, restoring, contacting, canUpdate, canRestore, onMarkContacted, onRestore }: { row: Lead; currentUserId: string; restoring: boolean; contacting: boolean; canUpdate: boolean; canRestore: boolean; onMarkContacted: () => void; onRestore: () => void }) {
  return (
    <article className="p-4 transition-colors hover:bg-slate-50/60">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <LeadAvatar name={row.displayName} />
          <div className="min-w-0">
            {row.deletedAt ? <p className="break-words font-semibold text-slate-500">{row.displayName}</p> : <Link className="block break-words font-semibold text-slate-950 hover:text-brand-800" to={`/leads/${row.id}`}>{row.displayName}</Link>}
            <p className="mt-1 font-mono text-[10px] text-slate-400">{row.leadNumber}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{row.companyName || "No company"}</p>
          </div>
        </div>
        <StatusBadge status={row.status} deleted={Boolean(row.deletedAt)} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50/80 p-3 text-xs">
        <div className="flex items-center gap-2"><Icon name="building" className="h-3.5 w-3.5 text-slate-400" /><dt className="sr-only">Source</dt><dd className="truncate text-slate-700">{leadSourceLabel(row.source)}</dd></div>
        <div className="flex items-center gap-2"><Icon name="flag" className="h-3.5 w-3.5 text-slate-400" /><dt className="sr-only">Priority</dt><dd className="text-slate-700">{leadPriorityLabel(row.priority)}</dd></div>
        <div className="col-span-2 flex items-center justify-between"><dt className="text-slate-500">Value</dt><dd className="font-semibold tabular-nums text-slate-900">{formatMoney(row.estimatedValue, row.currencyCode)}</dd></div>
        <div className="col-span-2 flex items-center justify-between"><dt className="text-slate-500">Owner</dt><dd className="font-medium text-slate-700">{row.ownerUserId === currentUserId ? "You" : row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : "Unassigned"}</dd></div>
      </dl>
      <div className="mt-3"><NextAction row={row} /></div>
      <div className="mt-3 flex items-center justify-end gap-1">
        {row.deletedAt ? (canRestore ? <IconAction label={restoring ? "Restoring…" : "Restore lead"} icon="rotate" tone="emerald" disabled={restoring} onClick={onRestore} /> : null) : (
          <>
            <IconAction label="View lead" icon="eye" to={`/leads/${row.id}`} />
            {canUpdate ? <IconAction label="Edit lead" icon="pencil" tone="brand" to={`/leads/${row.id}/edit`} /> : null}
            {canUpdate && row.status === "NEW" ? <IconAction label={contacting ? "Updating…" : "Mark contacted"} icon="phone" tone="violet" disabled={contacting} onClick={onMarkContacted} /> : null}
          </>
        )}
      </div>
    </article>
  );
}

function Svg({ className, children }: { className?: string; children: ReactNode }) {
  return <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

function Icon({ name, className }: { name: IconName; className?: string }) {
  switch (name) {
    case "target": return <Svg className={className}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Svg>;
    case "userCheck": return <Svg className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></Svg>;
    case "badgeCheck": return <Svg className={className}><path d="M12 2l2.4 1.8 3 .1 1 2.8 2.4 1.8-1 2.8 1 2.8-2.4 1.8-1 2.8-3 .1L12 20l-2.4-1.8-3-.1-1-2.8L3.2 13.5l1-2.8-1-2.8 2.4-1.8 1-2.8 3-.1z" /><polyline points="9 12 11 14 15 10" /></Svg>;
    case "star": return <Svg className={className}><polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2" /></Svg>;
    case "trophy": return <Svg className={className}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" /></Svg>;
    case "search": return <Svg className={className}><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.65" y2="16.65" /></Svg>;
    case "plus": return <Svg className={className}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Svg>;
    case "x": return <Svg className={className}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>;
    case "chevronLeft": return <Svg className={className}><polyline points="15 18 9 12 15 6" /></Svg>;
    case "chevronRight": return <Svg className={className}><polyline points="9 18 15 12 9 6" /></Svg>;
    case "mail": return <Svg className={className}><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></Svg>;
    case "phone": return <Svg className={className}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></Svg>;
    case "calendar": return <Svg className={className}><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="16" y1="3" x2="16" y2="7" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="3" y1="10" x2="21" y2="10" /></Svg>;
    case "eye": return <Svg className={className}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>;
    case "pencil": return <Svg className={className}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" /></Svg>;
    case "rotate": return <Svg className={className}><polyline points="1 4 1 10 7 10" /><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10" /></Svg>;
    case "zap": return <Svg className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Svg>;
    case "alert": return <Svg className={className}><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Svg>;
    case "building": return <Svg className={className}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></Svg>;
    case "flag": return <Svg className={className}><path d="M4 22V4M4 5h13l-2 4 2 4H4" /></Svg>;
    case "sort": return <Svg className={className}><path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" /></Svg>;
    case "trash": return <Svg className={className}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></Svg>;
    case "users": return <Svg className={className}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></Svg>;
  }
}

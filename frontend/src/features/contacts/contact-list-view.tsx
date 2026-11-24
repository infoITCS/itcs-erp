import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import type { ContactRow } from "./api.ts";

export interface ContactFilters {
  q: string;
  status: string;
  primary: string;
}

interface ContactListViewProps {
  rows: ContactRow[];
  filters: ContactFilters;
  isLoading: boolean;
  error: string | null;
  actionError: string | null;
  pageSummary: string;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  promotingId: string | null;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPrimaryChange: (value: string) => void;
  onClearFilters: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onAdd: () => void;
  onSetPrimary: (contact: ContactRow) => void;
  onRemove: (contact: ContactRow) => void;
}

type Tone = "slate" | "brand" | "emerald" | "violet" | "amber";
type IconName = "users" | "userCheck" | "star" | "userMinus" | "search" | "plus" | "x" | "chevronLeft" | "chevronRight" | "mail" | "phone" | "trash" | "alert" | "building";

const toneStyles: Record<Tone, { tile: string; accent: string }> = {
  slate: { tile: "bg-slate-100 text-slate-700 ring-slate-200", accent: "bg-slate-400" },
  brand: { tile: "bg-brand-50 text-brand-700 ring-brand-100", accent: "bg-brand-500" },
  emerald: { tile: "bg-emerald-50 text-emerald-700 ring-emerald-100", accent: "bg-emerald-500" },
  violet: { tile: "bg-violet-50 text-violet-700 ring-violet-100", accent: "bg-violet-500" },
  amber: { tile: "bg-amber-50 text-amber-700 ring-amber-100", accent: "bg-amber-500" },
};

export function ContactListView({
  rows,
  filters,
  isLoading,
  error,
  actionError,
  pageSummary,
  hasNextPage,
  hasPreviousPage,
  promotingId,
  canCreate,
  canUpdate,
  canDelete,
  onQueryChange,
  onStatusChange,
  onPrimaryChange,
  onClearFilters,
  onNext,
  onPrevious,
  onAdd,
  onSetPrimary,
  onRemove,
}: ContactListViewProps) {
  const activeCount = rows.filter((row) => row.status === "ACTIVE").length;
  const inactiveCount = rows.filter((row) => row.status === "INACTIVE").length;
  const primaryCount = rows.filter((row) => row.isPrimary).length;
  const hasActiveFilters = Boolean(filters.q || filters.status || filters.primary);

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
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> CRM / People
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">Contacts</h1>
              <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-600">
                People linked to your customer accounts, with primary contacts highlighted.
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
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button onClick={onAdd} className="h-11 gap-2 bg-brand-800 px-5 text-sm font-semibold shadow-lg shadow-brand-800/20 hover:bg-brand-900">
                <Icon name="plus" className="h-4 w-4" /> Add contact
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Visible" value={rows.length} detail="On current page" icon="users" tone="slate" active={!filters.status && !filters.primary} onClick={onClearFilters} />
        <MetricCard label="Active" value={activeCount} detail="Available for outreach" icon="userCheck" tone="emerald" active={filters.status === "ACTIVE"} onClick={() => onStatusChange(filters.status === "ACTIVE" ? "" : "ACTIVE")} />
        <MetricCard label="Primary" value={primaryCount} detail="Main account contacts" icon="star" tone="brand" active={filters.primary === "true"} onClick={() => onPrimaryChange(filters.primary === "true" ? "" : "true")} />
        <MetricCard label="Inactive" value={inactiveCount} detail="Archived contacts" icon="userMinus" tone="amber" active={filters.status === "INACTIVE"} onClick={() => onStatusChange(filters.status === "INACTIVE" ? "" : "INACTIVE")} />
      </div>

      <section aria-label="Contact filters" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-slate-50/40 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_190px_210px_auto]">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" className="h-4 w-4" /></span>
              <Input
                className="h-10 pl-9"
                value={filters.q}
                placeholder="Search name, email, phone, customer…"
                aria-label="Search contacts"
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
              <option value="INACTIVE">Inactive</option>
            </select>
            <select
              aria-label="Filter by primary contact"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
              value={filters.primary}
              onChange={(event) => onPrimaryChange(event.target.value)}
            >
              <option value="">All contacts</option>
              <option value="true">Primary only</option>
              <option value="false">Non-primary</option>
            </select>
            <Button variant="secondary" className="h-10 gap-2 px-3 text-xs font-semibold text-slate-600" disabled={!hasActiveFilters} onClick={onClearFilters}>
              <Icon name="x" className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-3">
            <span className="text-[11px] font-medium text-slate-500">Primary contacts are the default point of contact for each customer.</span>
            <span className="text-[11px] font-medium text-slate-400">Search updates as you type</span>
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
          {!isLoading && !error ? rows.map((row) => (
            <ContactMobileCard key={row.id} row={row} promoting={promotingId === row.id} canUpdate={canUpdate} canDelete={canDelete} onSetPrimary={() => onSetPrimary(row)} onRemove={() => onRemove(row)} />
          )) : null}
        </div>

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Phone</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? <LoadingRows variant="table" /> : null}
              {!isLoading && error ? <ErrorState message={error} colSpan={6} /> : null}
              {!isLoading && !error && rows.length === 0 ? <EmptyState onClearFilters={onClearFilters} canClear={hasActiveFilters} canCreate={canCreate} onAdd={onAdd} colSpan={6} /> : null}
              {!isLoading && !error ? rows.map((row) => (
                <tr key={row.id} className="group transition-colors hover:bg-brand-50/30">
                  <td className="max-w-[280px] px-5 py-4">
                    <div className="flex items-center gap-3">
                      <ContactAvatar name={row.displayName} />
                      <div className="min-w-0">
                        <Link className="flex items-center gap-1.5 truncate font-semibold text-slate-950 decoration-brand-700 underline-offset-4 hover:text-brand-800 hover:underline" to={`/customers/${row.customerId}`}>
                          <span className="truncate">{row.displayName}</span>
                          {row.isPrimary ? <PrimaryPill /> : null}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{row.jobTitle || (row.isPrimary ? "Primary contact" : "Contact")}</p>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[220px] px-5 py-4">
                    <Link className="block truncate font-medium text-slate-700 hover:text-brand-800" to={`/customers/${row.customerId}`}>{row.customer.displayName}</Link>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">{row.customer.customerNumber}</p>
                  </td>
                  <td className="max-w-[230px] px-5 py-4">
                    {row.email ? (
                      <a className="flex items-center gap-1.5 truncate text-slate-700 hover:text-brand-800" href={`mailto:${row.email}`}>
                        <Icon name="mail" className="h-3.5 w-3.5 shrink-0 text-slate-400" /> <span className="truncate">{row.email}</span>
                      </a>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    {row.phone || row.mobile ? (
                      <a className="flex items-center gap-1.5 text-slate-700 hover:text-brand-800" href={`tel:${row.phone ?? row.mobile}`}>
                        <Icon name="phone" className="h-3.5 w-3.5 text-slate-400" /> {row.phone ?? row.mobile}
                      </a>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4"><StatusBadge status={row.status} /></td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <div className="flex justify-end gap-1">
                      {canUpdate && !row.isPrimary ? (
                        <IconAction label={promotingId === row.id ? "Setting primary…" : "Make primary"} icon="star" tone="brand" disabled={promotingId === row.id} onClick={() => onSetPrimary(row)} />
                      ) : null}
                      {canDelete ? <IconAction label="Remove contact" icon="trash" tone="rose" onClick={() => onRemove(row)} /> : null}
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

function ContactAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  const palettes = ["bg-brand-50 text-brand-700 ring-brand-100", "bg-emerald-50 text-emerald-700 ring-emerald-100", "bg-violet-50 text-violet-700 ring-violet-100", "bg-amber-50 text-amber-700 ring-amber-100", "bg-sky-50 text-sky-700 ring-sky-100"];
  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length;
  return <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ring-1 ${palettes[index]}`}>{initials || "?"}</span>;
}

function StatusBadge({ status }: { status: ContactRow["status"] }) {
  const active = status === "ACTIVE";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${active ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} /> {active ? "Active" : "Inactive"}
    </span>
  );
}

function PrimaryPill() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-100">
      <Icon name="star" className="h-2.5 w-2.5" /> Primary
    </span>
  );
}

function IconAction({ label, icon, tone = "slate", disabled = false, onClick }: { label: string; icon: IconName; tone?: "slate" | "rose" | "brand"; disabled?: boolean; onClick: () => void }) {
  const styles = tone === "rose" ? "text-rose-600 hover:bg-rose-50" : tone === "brand" ? "text-brand-600 hover:bg-brand-50" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900";
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${styles}`}>
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
          <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="h-9 w-9 rounded-xl bg-slate-100" /><span className="block h-3 w-28 rounded bg-slate-200" /></div></td>
          <td className="px-5 py-4"><span className="block h-3 w-28 rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="block h-3 w-36 rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="block h-3 w-20 rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="block h-5 w-16 rounded-full bg-slate-100" /></td>
          <td className="px-5 py-4"><span className="ml-auto block h-7 w-16 rounded bg-slate-100" /></td>
        </tr>
      ))}
    </>
  );
}

function ErrorState({ message, colSpan }: { message: string; colSpan?: number }) {
  const content = (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100"><Icon name="alert" className="h-6 w-6" /></span>
      <p className="text-sm font-semibold text-slate-900">Couldn’t load contacts</p>
      <p className="max-w-md text-xs leading-5 text-slate-500">{message}</p>
    </div>
  );
  return colSpan ? <tr><td colSpan={colSpan}>{content}</td></tr> : <div>{content}</div>;
}

function EmptyState({ onClearFilters, canClear, canCreate, onAdd, colSpan }: { onClearFilters: () => void; canClear: boolean; canCreate: boolean; onAdd: () => void; colSpan?: number }) {
  const content = (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200"><Icon name="search" className="h-7 w-7" /></span>
      <div>
        <p className="text-sm font-semibold text-slate-900">No contacts found</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Try another search or add a person to a customer account.</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {canClear ? <Button variant="secondary" className="h-9 gap-2 px-3 text-xs font-semibold" onClick={onClearFilters}><Icon name="x" className="h-3.5 w-3.5" /> Clear filters</Button> : null}
        {canCreate ? <Button className="h-9 gap-2 bg-brand-800 px-3 text-xs font-semibold" onClick={onAdd}><Icon name="plus" className="h-3.5 w-3.5" /> Add contact</Button> : null}
      </div>
    </div>
  );
  return colSpan ? <tr><td colSpan={colSpan}>{content}</td></tr> : <div>{content}</div>;
}

function ContactMobileCard({ row, promoting, canUpdate, canDelete, onSetPrimary, onRemove }: { row: ContactRow; promoting: boolean; canUpdate: boolean; canDelete: boolean; onSetPrimary: () => void; onRemove: () => void }) {
  return (
    <article className="p-4 transition-colors hover:bg-slate-50/60">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ContactAvatar name={row.displayName} />
          <div className="min-w-0">
            <Link className="block break-words font-semibold text-slate-950 hover:text-brand-800" to={`/customers/${row.customerId}`}>{row.displayName}</Link>
            <p className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="truncate text-xs text-slate-500">{row.customer.displayName}</span>
              {row.isPrimary ? <PrimaryPill /> : null}
            </p>
          </div>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <dl className="mt-3 grid gap-2 rounded-xl bg-slate-50/80 p-3 text-xs">
        <div className="flex items-center gap-2"><Icon name="building" className="h-3.5 w-3.5 text-slate-400" /><dt className="sr-only">Customer number</dt><dd className="font-mono text-slate-500">{row.customer.customerNumber}</dd></div>
        <div className="flex items-center gap-2"><Icon name="mail" className="h-3.5 w-3.5 text-slate-400" /><dt className="sr-only">Email</dt><dd className="truncate text-slate-700">{row.email || "No email"}</dd></div>
        <div className="flex items-center gap-2"><Icon name="phone" className="h-3.5 w-3.5 text-slate-400" /><dt className="sr-only">Phone</dt><dd className="text-slate-700">{row.phone ?? row.mobile ?? "No phone"}</dd></div>
      </dl>
      <div className="mt-3 flex items-center justify-end gap-1">
        {canUpdate && !row.isPrimary ? <IconAction label={promoting ? "Setting primary…" : "Make primary"} icon="star" tone="brand" disabled={promoting} onClick={onSetPrimary} /> : null}
        {canDelete ? <IconAction label="Remove contact" icon="trash" tone="rose" onClick={onRemove} /> : null}
      </div>
    </article>
  );
}

function Svg({ className, children }: { className?: string; children: ReactNode }) {
  return <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

function Icon({ name, className }: { name: IconName; className?: string }) {
  switch (name) {
    case "users":
      return <Svg className={className}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>;
    case "userCheck":
      return <Svg className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></Svg>;
    case "star":
      return <Svg className={className}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></Svg>;
    case "userMinus":
      return <Svg className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="17" y1="11" x2="23" y2="11" /></Svg>;
    case "search":
      return <Svg className={className}><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.65" y2="16.65" /></Svg>;
    case "plus":
      return <Svg className={className}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Svg>;
    case "x":
      return <Svg className={className}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>;
    case "chevronLeft":
      return <Svg className={className}><polyline points="15 18 9 12 15 6" /></Svg>;
    case "chevronRight":
      return <Svg className={className}><polyline points="9 18 15 12 9 6" /></Svg>;
    case "mail":
      return <Svg className={className}><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><polyline points="22,6 12,13 2,6" /></Svg>;
    case "phone":
      return <Svg className={className}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></Svg>;
    case "trash":
      return <Svg className={className}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></Svg>;
    case "alert":
      return <Svg className={className}><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Svg>;
    case "building":
      return <Svg className={className}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></Svg>;
  }
}

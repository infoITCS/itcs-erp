import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import {
  ALL_STAGES,
  LOST_REASONS,
  OPEN_STAGES,
  lostReasonLabel,
  opportunityStageLabel,
  type Opportunity,
  type OpportunityLostReason,
  type OpportunityOwnerRef,
  type OpportunityPipelineSummary,
  type OpportunityStage,
} from "./api.ts";

export type OpportunityView = "pipeline" | "list" | "analytics";

export interface OpportunityFilters {
  q: string;
  stage: string;
  ownerUserId: string;
  leadSource: string;
  sort: "createdAt" | "title" | "opportunityNumber";
  order: "asc" | "desc";
  includeDeleted: boolean;
  onlyMine: boolean;
}

interface OpportunityWorkspaceProps {
  rows: Opportunity[];
  summary: OpportunityPipelineSummary | null;
  filters: OpportunityFilters;
  owners: OpportunityOwnerRef[];
  currentUserId: string;
  view: OpportunityView;
  loading: boolean;
  error: string | null;
  actionError: string | null;
  pageSummary: string;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canRestore: boolean;
  onViewChange: (view: OpportunityView) => void;
  onFilterChange: <K extends keyof OpportunityFilters>(key: K, value: OpportunityFilters[K]) => void;
  onClearFilters: () => void;
  onStageChange: (row: Opportunity, stage: OpportunityStage) => void;
  onMarkWon: (row: Opportunity) => void;
  onMarkLost: (row: Opportunity, reason: OpportunityLostReason) => void;
  onReopen: (row: Opportunity) => void;
  onRestore: (row: Opportunity) => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
}

const stageTone: Record<OpportunityStage, string> = {
  NEW: "bg-slate-100 text-slate-700 ring-slate-200",
  QUALIFICATION: "bg-sky-50 text-sky-700 ring-sky-100",
  NEEDS_ANALYSIS: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  PROPOSAL: "bg-violet-50 text-violet-700 ring-violet-100",
  NEGOTIATION: "bg-amber-50 text-amber-700 ring-amber-100",
  WON: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  LOST: "bg-rose-50 text-rose-700 ring-rose-100",
};

const stageAccent: Record<OpportunityStage, string> = {
  NEW: "bg-slate-400",
  QUALIFICATION: "bg-sky-500",
  NEEDS_ANALYSIS: "bg-indigo-500",
  PROPOSAL: "bg-violet-500",
  NEGOTIATION: "bg-amber-500",
  WON: "bg-emerald-500",
  LOST: "bg-rose-500",
};

export function OpportunityWorkspace({
  rows,
  summary,
  filters,
  owners,
  currentUserId,
  view,
  loading,
  error,
  actionError,
  pageSummary,
  hasNextPage,
  hasPreviousPage,
  canCreate,
  canUpdate,
  canDelete,
  canRestore,
  onViewChange,
  onFilterChange,
  onClearFilters,
  onStageChange,
  onMarkWon,
  onMarkLost,
  onReopen,
  onRestore,
  onNextPage,
  onPreviousPage,
}: OpportunityWorkspaceProps) {
  const [lostTarget, setLostTarget] = useState<Opportunity | null>(null);
  const [lostReason, setLostReason] = useState<OpportunityLostReason>("PRICE");
  const [wonTarget, setWonTarget] = useState<Opportunity | null>(null);

  const totals = summary?.totals;
  const currency = summary?.currency ?? rows[0]?.baseCurrencyCode ?? rows[0]?.currencyCode ?? "USD";
  const filtersActive = Boolean(filters.q || filters.stage || filters.ownerUserId || filters.leadSource || filters.includeDeleted || filters.onlyMine);

  function openLost(row: Opportunity) {
    setLostReason((row.lostReason as OpportunityLostReason | null) ?? "PRICE");
    setLostTarget(row);
  }

  return (
    <section className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-sky-400" />
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 sm:flex">
              <Icon name="target" className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> CRM / Revenue pipeline
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">Opportunities</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
                Move deals through each stage, forecast revenue, and close with a clean audit trail.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreate ? <Link to="/opportunities/new"><Button className="gap-2 bg-brand-800 px-4 shadow-sm hover:bg-brand-900"><Icon name="plus" className="h-4 w-4" /> New opportunity</Button></Link> : null}
            <Button variant="secondary" className="gap-2" onClick={onClearFilters}>
              <Icon name="refresh" className="h-4 w-4" /> Refresh view
            </Button>
          </div>
        </div>
        <div className="grid gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-5">
          <Metric label="Open deals" value={String(totals?.openDeals ?? 0)} note="Active pipeline" icon="target" />
          <Metric label="Pipeline value" value={formatMoney(money(totals?.openValue ?? "0"), currency)} note="Open opportunities" icon="chart" />
          <Metric label="Weighted forecast" value={formatMoney(money(totals?.weightedValue ?? "0"), currency)} note="Probability adjusted" icon="spark" />
          <Metric label="Won" value={String(totals?.wonDeals ?? 0)} note={formatMoney(money(totals?.wonValue ?? "0"), currency)} icon="check" tone="emerald" />
          <Metric label="Lost" value={String(totals?.lostDeals ?? 0)} note={formatMoney(money(totals?.lostValue ?? "0"), currency)} icon="flag" tone="rose" />
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-2 py-2 shadow-sm">
        <TabButton active={view === "pipeline"} onClick={() => onViewChange("pipeline")} icon="columns" label="Pipeline board" />
        <TabButton active={view === "list"} onClick={() => onViewChange("list")} icon="list" label="All opportunities" />
        <TabButton active={view === "analytics"} onClick={() => onViewChange("analytics")} icon="chart" label="Pipeline analytics" />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="xl:col-span-2">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Search</span>
            <Input placeholder="Title, customer, number…" value={filters.q} onChange={(event) => onFilterChange("q", event.target.value)} />
          </label>
          <FilterSelect label="Stage" value={filters.stage} onChange={(value) => onFilterChange("stage", value)} options={[{ value: "", label: "All stages" }, ...ALL_STAGES.map((stage) => ({ value: stage, label: opportunityStageLabel(stage) }))]} />
          <FilterSelect label="Owner" value={filters.ownerUserId} onChange={(value) => onFilterChange("ownerUserId", value)} options={[{ value: "", label: "All owners" }, ...owners.map((owner) => ({ value: owner.id, label: `${owner.firstName} ${owner.lastName}` }))]} />
          <FilterSelect label="Source" value={filters.leadSource} onChange={(value) => onFilterChange("leadSource", value)} options={[{ value: "", label: "All sources" }, ...["WEBSITE", "REFERRAL", "COLD_CALL", "SOCIAL_MEDIA", "ADVERTISEMENT", "PARTNER", "TENDER", "OTHER"].map((source) => ({ value: source, label: source.replaceAll("_", " ") }))]} />
          <FilterSelect label="Sort" value={`${filters.sort}:${filters.order}`} onChange={(value) => {
            const [sort, order] = value.split(":");
            onFilterChange("sort", sort as OpportunityFilters["sort"]);
            onFilterChange("order", order as OpportunityFilters["order"]);
          }} options={[{ value: "createdAt:desc", label: "Newest first" }, { value: "createdAt:asc", label: "Oldest first" }, { value: "title:asc", label: "Title A–Z" }, { value: "opportunityNumber:desc", label: "Number descending" }]} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Toggle active={filters.onlyMine} onClick={() => onFilterChange("onlyMine", !filters.onlyMine)} label="My opportunities" />
          {canDelete || canRestore ? <Toggle active={filters.includeDeleted} onClick={() => onFilterChange("includeDeleted", !filters.includeDeleted)} label="Include deleted" /> : null}
          {filtersActive ? <Button variant="ghost" className="h-8 gap-1.5 px-2.5 text-xs text-rose-700 hover:bg-rose-50" onClick={onClearFilters}><Icon name="x" className="h-3.5 w-3.5" /> Clear filters</Button> : null}
          <span className="ml-auto text-xs text-slate-500">{pageSummary}</span>
        </div>
      </div>

      {actionError ? <ErrorPanel message={actionError} /> : null}
      {error ? <ErrorPanel message={error} /> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState canClear={filtersActive} canCreate={canCreate} onClear={onClearFilters} />
      ) : view === "pipeline" ? (
        <PipelineBoard rows={rows} summary={summary} filters={filters} owners={owners} canUpdate={canUpdate} canRestore={canRestore} currentUserId={currentUserId} onStageChange={onStageChange} onMarkWon={(row) => setWonTarget(row)} onMarkLost={openLost} onReopen={onReopen} onRestore={onRestore} />
      ) : view === "list" ? (
        <OpportunityTable rows={rows} owners={owners} canUpdate={canUpdate} canRestore={canRestore} currentUserId={currentUserId} onStageChange={onStageChange} onMarkWon={(row) => setWonTarget(row)} onMarkLost={openLost} onReopen={onReopen} onRestore={onRestore} />
      ) : (
        <AnalyticsPanel summary={summary} />
      )}

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <span className="text-xs text-slate-500">{pageSummary}</span>
        <div className="flex gap-2">
          <Button variant="secondary" className="h-8 px-3 text-xs" disabled={!hasPreviousPage || loading} onClick={onPreviousPage}>Previous</Button>
          <Button variant="secondary" className="h-8 px-3 text-xs" disabled={!hasNextPage || loading} onClick={onNextPage}>Next</Button>
        </div>
      </div>

      <Modal open={Boolean(lostTarget)} title={`Mark ${lostTarget?.title ?? "opportunity"} as lost`} onClose={() => setLostTarget(null)} footer={<>
        <Button variant="secondary" onClick={() => setLostTarget(null)}>Cancel</Button>
        <Button className="bg-rose-700 hover:bg-rose-800" onClick={() => {
          if (lostTarget) onMarkLost(lostTarget, lostReason);
          setLostTarget(null);
        }}>Mark lost</Button>
      </>}>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Loss reason</span>
          <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={lostReason} onChange={(event) => setLostReason(event.target.value as OpportunityLostReason)}>
            {LOST_REASONS.map((reason) => <option key={reason} value={reason}>{lostReasonLabel(reason)}</option>)}
          </select>
        </label>
      </Modal>

      <Modal open={Boolean(wonTarget)} title={`Close ${wonTarget?.title ?? "opportunity"} as won?`} onClose={() => setWonTarget(null)} footer={<>
        <Button variant="secondary" onClick={() => setWonTarget(null)}>Cancel</Button>
        <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => {
          if (wonTarget) onMarkWon(wonTarget);
          setWonTarget(null);
        }}>Mark won</Button>
      </>}>
        <p className="text-sm leading-6 text-slate-600">The linked customer must be active. Closing will sync the linked lead to WON and lock manual stage changes.</p>
      </Modal>
    </section>
  );
}

function Metric({ label, value, note, icon, tone = "brand" }: { label: string; value: string; note: string; icon: IconName; tone?: "brand" | "emerald" | "rose" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700 ring-brand-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
  };
  return <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${tones[tone]}`}><Icon name={icon} className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="truncate text-lg font-bold tracking-tight text-slate-950 tabular-nums">{value}</p><p className="truncate text-[11px] text-slate-500">{note}</p></div></div>;
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: IconName; label: string }) {
  return <button type="button" onClick={onClick} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${active ? "bg-brand-800 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}><Icon name={icon} className="h-4 w-4" /> {label}</button>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition ${active ? "border-brand-300 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}><span className={`h-2 w-2 rounded-full ${active ? "bg-brand-600" : "bg-slate-300"}`} /> {label}</button>;
}

function PipelineBoard({
  rows,
  summary,
  filters,
  owners,
  canUpdate,
  canRestore,
  currentUserId,
  onStageChange,
  onMarkWon,
  onMarkLost,
  onReopen,
  onRestore,
}: {
  rows: Opportunity[];
  summary: OpportunityPipelineSummary | null;
  filters: OpportunityFilters;
  owners: OpportunityOwnerRef[];
  canUpdate: boolean;
  canRestore: boolean;
  currentUserId: string;
  onStageChange: (row: Opportunity, stage: OpportunityStage) => void;
  onMarkWon: (row: Opportunity) => void;
  onMarkLost: (row: Opportunity, reason: OpportunityLostReason) => void;
  onReopen: (row: Opportunity) => void;
  onRestore: (row: Opportunity) => void;
}) {
  const visibleStages = filters.stage && ALL_STAGES.includes(filters.stage as OpportunityStage)
    ? [filters.stage as OpportunityStage]
    : ALL_STAGES;
  const currency = summary?.currency ?? rows[0]?.baseCurrencyCode ?? rows[0]?.currencyCode ?? "USD";
  return (
    <div className="grid gap-4 overflow-x-auto pb-2" style={{ gridTemplateColumns: `repeat(${visibleStages.length}, minmax(260px, 1fr))` }}>
      {visibleStages.map((stage) => {
        const stageRows = rows.filter((row) => row.stage === stage);
        const stageSummary = summary?.stages.find((item) => item.stage === stage);
        return (
          <div key={stage} className="flex min-h-[420px] flex-col rounded-2xl border border-slate-200/80 bg-slate-50/70">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3">
              <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${stageAccent[stage]}`} /><p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">{opportunityStageLabel(stage)}</p></div>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">{stageSummary?.count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2 text-[11px] text-slate-500"><span>Pipeline</span><span className="font-semibold tabular-nums">{formatMoney(money(stageSummary?.value ?? "0"), currency)}</span></div>
            <div className="flex flex-1 flex-col gap-3 p-3">
              {stageRows.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 px-3 py-8 text-center text-xs text-slate-400">No deals in this stage</p> : null}
              {stageRows.map((row) => (
                <OpportunityCard key={row.id} row={row} owners={owners} canUpdate={canUpdate && !row.deletedAt} canRestore={canRestore} currentUserId={currentUserId} onStageChange={onStageChange} onMarkWon={onMarkWon} onMarkLost={onMarkLost} onReopen={onReopen} onRestore={onRestore} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OpportunityCard({
  row,
  owners,
  canUpdate,
  canRestore,
  currentUserId,
  onStageChange,
  onMarkWon,
  onMarkLost,
  onReopen,
  onRestore,
}: {
  row: Opportunity;
  owners: OpportunityOwnerRef[];
  canUpdate: boolean;
  canRestore: boolean;
  currentUserId: string;
  onStageChange: (row: Opportunity, stage: OpportunityStage) => void;
  onMarkWon: (row: Opportunity) => void;
  onMarkLost: (row: Opportunity, reason: OpportunityLostReason) => void;
  onReopen: (row: Opportunity) => void;
  onRestore: (row: Opportunity) => void;
}) {
          const owner = (owners ?? []).find((item) => item.id === row.ownerUserId);
  const overdue = row.nextActionDueAt && new Date(row.nextActionDueAt).getTime() < Date.now();
  return (
    <article className={`rounded-xl border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${row.deletedAt ? "border-rose-200 opacity-70" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <Link className="min-w-0 text-sm font-semibold leading-5 text-slate-950 hover:text-brand-800" to={`/opportunities/${row.id}`}>{row.title}</Link>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${stageTone[row.stage]}`}>{row.probabilityPercent}%</span>
      </div>
      <p className="mt-1 truncate text-xs text-slate-500">{row.opportunityNumber} · {row.customer?.displayName ?? row.prospectDisplayName ?? "Prospect"}</p>
      <p className="mt-2 text-base font-bold tracking-tight text-slate-950 tabular-nums">{formatMoney(money(row.estimatedValue), row.currencyCode)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold">{owner ? `${owner.firstName[0]}${owner.lastName[0]}` : "—"}</span>
        {row.ownerUserId === currentUserId ? <span className="rounded bg-brand-50 px-1.5 py-0.5 font-bold text-brand-700">YOU</span> : null}
        {row.expectedCloseDate ? <span className="rounded bg-slate-100 px-1.5 py-0.5">Close {row.expectedCloseDate.slice(5)}</span> : null}
        {overdue ? <span className="rounded bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-700">Follow-up overdue</span> : null}
      </div>
      {row.nextAction ? <p className="mt-2 truncate text-[11px] text-slate-600">Next: {row.nextAction}</p> : null}
      {row.deletedAt ? (
        canRestore ? <Button variant="secondary" className="mt-3 h-7 w-full px-2 text-[11px]" onClick={() => onRestore(row)}>Restore deal</Button> : null
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {canUpdate && (OPEN_STAGES as string[]).includes(row.stage) ? (
            <select
              aria-label={`Move ${row.title} to stage`}
              className="h-7 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-600"
              value={row.stage}
              onChange={(event) => onStageChange(row, event.target.value as OpportunityStage)}
            >
              <option value={row.stage}>Move to…</option>
              {OPEN_STAGES.filter((stage) => stage !== row.stage).map((stage) => <option key={stage} value={stage}>Move to {opportunityStageLabel(stage)}</option>)}
            </select>
          ) : null}
          {canUpdate && (OPEN_STAGES as string[]).includes(row.stage) ? <button type="button" className="h-7 rounded-md bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100" onClick={() => onMarkWon(row)}>Won</button> : null}
          {canUpdate && (OPEN_STAGES as string[]).includes(row.stage) ? <button type="button" className="h-7 rounded-md bg-rose-50 px-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-100" onClick={() => onMarkLost(row, "PRICE")}>Lost</button> : null}
          {canUpdate && ["WON", "LOST"].includes(row.stage) ? <button type="button" className="h-7 w-full rounded-md bg-brand-50 px-2 text-[11px] font-semibold text-brand-700 hover:bg-brand-100" onClick={() => onReopen(row)}>Reopen deal</button> : null}
        </div>
      )}
    </article>
  );
}

function OpportunityTable({
  rows,
  owners,
  canUpdate,
  canRestore,
  currentUserId,
  onStageChange,
  onMarkWon,
  onMarkLost,
  onReopen,
  onRestore,
}: {
  rows: Opportunity[];
  owners: OpportunityOwnerRef[];
  canUpdate: boolean;
  canRestore: boolean;
  currentUserId: string;
  onStageChange: (row: Opportunity, stage: OpportunityStage) => void;
  onMarkWon: (row: Opportunity) => void;
  onMarkLost: (row: Opportunity, reason: OpportunityLostReason) => void;
  onReopen: (row: Opportunity) => void;
  onRestore: (row: Opportunity) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Opportunity</th><th className="px-5 py-3">Customer / prospect</th><th className="px-5 py-3">Stage</th><th className="px-5 py-3">Value</th><th className="px-5 py-3">Owner</th><th className="px-5 py-3">Next step</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="transition hover:bg-slate-50/60">
                <td className="px-5 py-4"><Link className="font-semibold text-slate-950 hover:text-brand-800" to={`/opportunities/${row.id}`}>{row.title}</Link><p className="mt-0.5 text-[11px] text-slate-500">{row.opportunityNumber}</p></td>
                <td className="px-5 py-4 text-xs text-slate-600">{row.customer?.displayName ?? row.prospectDisplayName ?? "Prospect"}</td>
                <td className="px-5 py-4"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${stageTone[row.stage]}`}>{opportunityStageLabel(row.stage)}</span></td>
                <td className="px-5 py-4 font-semibold tabular-nums text-slate-900">{formatMoney(money(row.estimatedValue), row.currencyCode)}<p className="text-[10px] font-normal text-slate-500">{row.probabilityPercent}% probability</p></td>
                <td className="px-5 py-4 text-xs text-slate-600">{row.owner?.firstName ?? "—"} {row.owner?.lastName ?? ""}{row.ownerUserId === currentUserId ? <span className="ml-1 rounded bg-brand-50 px-1 text-[9px] font-bold text-brand-700">YOU</span> : null}</td>
                <td className="max-w-[220px] px-5 py-4 text-xs text-slate-600"><p className="truncate">{row.nextAction ?? "Not scheduled"}</p>{row.expectedCloseDate ? <p className="text-[10px] text-slate-400">Close {row.expectedCloseDate.slice(0, 10)}</p> : null}</td>
                <td className="px-5 py-4"><div className="flex justify-end gap-1.5">
                  <Link to={`/opportunities/${row.id}`}><IconAction label="View" icon="eye" /></Link>
                  {row.deletedAt ? canRestore ? <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50" onClick={() => onRestore(row)}>Restore</button> : null : (
                    <>
                      {canUpdate && (OPEN_STAGES as string[]).includes(row.stage) ? <select aria-label="Move stage" className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs" value={row.stage} onChange={(event) => onStageChange(row, event.target.value as OpportunityStage)}>{OPEN_STAGES.map((stage) => <option key={stage} value={stage}>{opportunityStageLabel(stage)}</option>)}</select> : null}
                      {canUpdate && (OPEN_STAGES as string[]).includes(row.stage) ? <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50" onClick={() => onMarkWon(row)}>Won</button> : null}
                      {canUpdate && (OPEN_STAGES as string[]).includes(row.stage) ? <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50" onClick={() => onMarkLost(row, "PRICE")}>Lost</button> : null}
                      {canUpdate && ["WON", "LOST"].includes(row.stage) ? <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50" onClick={() => onReopen(row)}>Reopen</button> : null}
                    </>
                  )}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-slate-100 xl:hidden">
        {rows.map((row) => {
  const owner = (owners ?? []).find((item) => item.id === row.ownerUserId);
          return <div key={row.id} className="p-4"><OpportunityCard row={row} owners={owners} canUpdate={canUpdate && !row.deletedAt} canRestore={canRestore} currentUserId={currentUserId} onStageChange={onStageChange} onMarkWon={onMarkWon} onMarkLost={onMarkLost} onReopen={onReopen} onRestore={onRestore} /><p className="mt-2 text-[11px] text-slate-500">Owner: {owner ? `${owner.firstName} ${owner.lastName}` : row.owner?.firstName ?? "Unassigned"}</p></div>;
        })}
      </div>
    </div>
  );
}

function AnalyticsPanel({ summary }: { summary: OpportunityPipelineSummary | null }) {
  const currency = summary?.currency ?? "USD";
  const stages = summary?.stages ?? [];
  const forecast = summary?.forecast ?? [];
  const reasons = summary?.lostReasons ?? [];
  const maxStageValue = Math.max(...ALL_STAGES.map((stage) => money(stages.find((item) => item.stage === stage)?.value ?? "0")), 1);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Stage distribution" subtitle="Deals and value by pipeline stage">
        <div className="space-y-3.5 p-5">
          {ALL_STAGES.map((stage) => {
            const stageSummary = stages.find((item) => item.stage === stage);
            const value = money(stageSummary?.value ?? "0");
            return <div key={stage}><div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-700">{opportunityStageLabel(stage)}</span><span className="text-slate-500">{stageSummary?.count ?? 0} deals · {formatMoney(value, currency)}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${stageAccent[stage]}`} style={{ width: `${Math.max(4, value / maxStageValue * 100)}%` }} /></div></div>;
          })}
        </div>
      </Panel>
      <Panel title="Expected close forecast" subtitle="Open pipeline grouped by close month">
        <div className="space-y-3 p-5">
          {forecast.map((row) => <div key={row.month} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs"><span className="font-semibold text-slate-700">{row.month}</span><span className="font-bold tabular-nums text-slate-950">{formatMoney(money(row.value), currency)}</span></div>)}
          {forecast.length === 0 ? <p className="py-8 text-center text-xs text-slate-400">No expected close dates in this view.</p> : null}
        </div>
      </Panel>
      <Panel title="Loss reasons" subtitle="Where deals are being lost" className="lg:col-span-2">
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((row) => <div key={row.reason} className="rounded-xl border border-rose-100 bg-rose-50/60 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">{lostReasonLabel(row.reason)}</p><p className="mt-1 text-xl font-bold tabular-nums text-rose-950">{row.count}</p></div>)}
          {reasons.length === 0 ? <p className="py-6 text-center text-xs text-slate-400 sm:col-span-2 lg:col-span-4">No lost deals in this view.</p> : null}
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, subtitle, className = "", children }: { title: string; subtitle: string; className?: string; children: ReactNode }) {
  return <section className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ${className}`}><header className="border-b border-slate-100 bg-slate-50/50 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{subtitle}</p></header>{children}</section>;
}

function EmptyState({ canClear, canCreate, onClear }: { canClear: boolean; canCreate: boolean; onClear: () => void }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Icon name="target" className="h-7 w-7" /></span><p className="mt-3 text-sm font-semibold text-slate-900">No opportunities found</p><p className="mt-1 text-xs text-slate-500">Adjust filters or create the first deal for this view.</p><div className="mt-4 flex justify-center gap-2">{canClear ? <Button variant="secondary" className="h-9 px-3 text-xs" onClick={onClear}>Clear filters</Button> : null}{canCreate ? <Link to="/opportunities/new"><Button className="h-9 bg-brand-800 px-3 text-xs">New opportunity</Button></Link> : null}</div></div>;
}

function ErrorPanel({ message }: { message: string }) {
  return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{message}</div>;
}

function IconAction({ label, icon }: { label: string; icon: IconName }) {
  return <span title={label} aria-label={label} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"><Icon name={icon} className="h-4 w-4" /></span>;
}

function money(value: string | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return value.toFixed(0);
  }
}

type IconName = "target" | "plus" | "refresh" | "chart" | "spark" | "check" | "flag" | "columns" | "list" | "x" | "eye";

function Icon({ name, className }: { name: IconName; className?: string }) {
  switch (name) {
    case "target": return <Svg className={className}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Svg>;
    case "plus": return <Svg className={className}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Svg>;
    case "refresh": return <Svg className={className}><path d="M20 11a8 8 0 0 0-14-5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14 5l2-2" /><path d="M20 20v-4h-4" /></Svg>;
    case "chart": return <Svg className={className}><line x1="4" y1="20" x2="20" y2="20" /><rect x="6" y="11" width="3" height="6" rx="1" /><rect x="11" y="7" width="3" height="10" rx="1" /><rect x="16" y="4" width="3" height="13" rx="1" /></Svg>;
    case "spark": return <Svg className={className}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z" /></Svg>;
    case "check": return <Svg className={className}><path d="M20 6L9 17l-5-5" /></Svg>;
    case "flag": return <Svg className={className}><path d="M4 22V4M4 5h13l-2 4 2 4H4" /></Svg>;
    case "columns": return <Svg className={className}><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="11" rx="1" /><rect x="17" y="4" width="4" height="14" rx="1" /></Svg>;
    case "list": return <Svg className={className}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></Svg>;
    case "x": return <Svg className={className}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></Svg>;
    case "eye": return <Svg className={className}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></Svg>;
  }
}

function Svg({ className, children }: { className?: string; children: ReactNode }) {
  return <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

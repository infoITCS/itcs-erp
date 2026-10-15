import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  ALL_STAGES,
  OPEN_STAGES,
  getOpportunityFormOptions,
  listOpportunities,
  restoreOpportunity,
  type Opportunity,
  type OpportunityStage,
} from "./api.ts";

const PAGE_SIZE = 50;

export default function OpportunitiesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);

  const params = {
    q: debouncedQ || undefined,
    stage: stage || undefined,
    ownerUserId: ownerUserId || undefined,
    includeDeleted: includeDeleted ? "true" : undefined,
    cursor,
    limit: PAGE_SIZE,
  };

  const opportunities = useQuery({
    queryKey: queryKeys.list("opportunities", params),
    queryFn: () => listOpportunities(params),
  });
  const formOptions = useQuery({
    queryKey: ["opportunities", "form-options"],
    queryFn: getOpportunityFormOptions,
  });

  const restore = useMutation({
    mutationFn: restoreOpportunity,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["opportunities", "list"] });
    },
  });

  const rows = opportunities.data?.items ?? [];
  const hasNextPage = opportunities.data?.pageInfo.hasNextPage ?? false;
  const hasPreviousPage = cursors.length > 1;
  const error = opportunities.isError ? getApiErrorMessage(opportunities.error) : null;
  const actionError = restore.isError ? getApiErrorMessage(restore.error) : null;
  const pageSummary = `${rows.length} opportunit${rows.length === 1 ? "y" : "ies"} on page ${cursors.length}`;
  const filtersActive = Boolean(q || stage || ownerUserId || includeDeleted);

  const newCount = rows.filter((row) => !row.deletedAt && row.stage === "NEW").length;
  const openCount = rows.filter((row) => !row.deletedAt && (OPEN_STAGES as string[]).includes(row.stage)).length;
  const wonCount = rows.filter((row) => !row.deletedAt && row.stage === "WON").length;
  const lostCount = rows.filter((row) => !row.deletedAt && row.stage === "LOST").length;

  function resetPage() {
    setCursors([undefined]);
  }

  function setStageFilter(next: string) {
    setStage((current) => (current === next ? "" : next));
    resetPage();
  }

  function clearFilters() {
    setQ("");
    setStage("");
    setOwnerUserId("");
    setIncludeDeleted(false);
    resetPage();
  }

  function nextPage() {
    const next = opportunities.data?.pageInfo.nextCursor;
    if (next) {
      setCursors((current) => [...current, next]);
    }
  }

  function previousPage() {
    setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col items-start justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-teal-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal-600" />
            CRM / Pipeline
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">Opportunities</h1>
          <p className="mt-1 text-sm text-slate-600">Deals from first contact through close, including prospects.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Link to="/opportunities/new">
            <Button className="h-10 bg-teal-800 px-4 transition hover:bg-teal-900 hover:shadow-sm">Add New Opportunity</Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 sm:grid-cols-5 sm:divide-y-0">
        <SummaryItem
          label="Visible"
          value={rows.length.toString()}
          tone="slate"
          active={!stage}
          onClick={() => {
            setStage("");
            resetPage();
          }}
        />
        <SummaryItem
          label="New"
          value={newCount.toString()}
          tone="teal"
          active={stage === "NEW"}
          onClick={() => setStageFilter("NEW")}
        />
        <SummaryItem
          label="Open"
          value={openCount.toString()}
          tone="teal"
          active={stage !== "" && (OPEN_STAGES as string[]).includes(stage) && stage !== "NEW"}
          hint="Use stage chips below"
          onClick={() => {
            if (!stage || stage === "NEW" || stage === "WON" || stage === "LOST") {
              setStage("QUALIFICATION");
            }
            resetPage();
          }}
        />
        <SummaryItem
          label="Won"
          value={wonCount.toString()}
          tone="teal"
          active={stage === "WON"}
          onClick={() => setStageFilter("WON")}
        />
        <SummaryItem
          label="Lost"
          value={lostCount.toString()}
          tone="amber"
          active={stage === "LOST"}
          onClick={() => setStageFilter("LOST")}
        />
      </div>

      <section aria-label="Opportunity filters" className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_190px_220px]">
          <Input
            className="h-10"
            type="search"
            aria-label="Search opportunities by title, number or prospect"
            value={q}
            placeholder="Search title, number or prospect"
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
          />
          <select
            aria-label="Filter by stage"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 transition focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={stage}
            onChange={(event) => {
              setStage(event.target.value);
              resetPage();
            }}
          >
            <option value="">All stages</option>
            {ALL_STAGES.map((value) => (
              <option key={value} value={value}>
                {stageLabel(value)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by owner"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 transition focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={ownerUserId}
            onChange={(event) => {
              setOwnerUserId(event.target.value);
              resetPage();
            }}
          >
            <option value="">All owners</option>
            {(formOptions.data?.owners ?? []).map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.firstName} {owner.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3" role="group" aria-label="Quick stage filters">
          <button
            type="button"
            onClick={() => setStageFilter("")}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              !stage ? "bg-teal-800 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All
          </button>
          {ALL_STAGES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStageFilter(value)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                stage === value
                  ? value === "LOST"
                    ? "bg-amber-700 text-white shadow-sm"
                    : value === "WON"
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "bg-teal-800 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {stageLabel(value)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <label className="inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-sm text-slate-700 transition hover:bg-slate-50">
            <input
              className="accent-teal-800"
              type="checkbox"
              checked={includeDeleted}
              onChange={(event) => {
                setIncludeDeleted(event.target.checked);
                resetPage();
              }}
            />
            Include deleted opportunities
          </label>
          {filtersActive ? (
            <button
              type="button"
              className="text-xs font-medium text-teal-800 underline-offset-2 transition hover:underline"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      {actionError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-slate-300">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Opportunity pipeline</h2>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
              {rows.length}
            </span>
            {stage ? (
              <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-100">
                {stageLabel(stage)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="divide-y divide-slate-200 xl:hidden">
          {opportunities.isPending ? <p className="px-4 py-10 text-center text-sm text-slate-500">Loading opportunities…</p> : null}
          {!opportunities.isPending && error ? <p className="px-4 py-10 text-center text-sm text-red-700">{error}</p> : null}
          {!opportunities.isPending && !error && rows.length === 0 ? <EmptyState filtersActive={filtersActive} onClear={clearFilters} /> : null}
          {!opportunities.isPending && !error
            ? rows.map((row) => (
                <OpportunityMobileCard
                  key={row.id}
                  row={row}
                  restoring={restore.isPending && restore.variables === row.id}
                  onRestore={() => restore.mutate(row.id)}
                />
              ))
            : null}
        </div>

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Opportunity</th>
                <th className="px-4 py-3">Customer / prospect</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right">Probability</th>
                <th className="px-4 py-3">Expected close</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.isPending ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    Loading opportunities…
                  </td>
                </tr>
              ) : null}
              {!opportunities.isPending && error ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-red-700">
                    {error}
                  </td>
                </tr>
              ) : null}
              {!opportunities.isPending && !error && rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-4">
                    <EmptyState filtersActive={filtersActive} onClear={clearFilters} />
                  </td>
                </tr>
              ) : null}
              {!opportunities.isPending && !error
                ? rows.map((row) => {
                    const overdue = isOverdue(row.expectedCloseDate) && (OPEN_STAGES as string[]).includes(row.stage);
                    return (
                      <tr
                        key={row.id}
                        className={`border-t border-slate-100 transition-colors ${
                          row.deletedAt ? "opacity-70" : "cursor-pointer hover:bg-teal-50/40"
                        }`}
                        onClick={() => {
                          if (!row.deletedAt) {
                            navigate(`/opportunities/${row.id}`);
                          }
                        }}
                      >
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs font-medium text-slate-500">
                          {row.opportunityNumber}
                        </td>
                        <td className="max-w-[240px] px-5 py-4">
                          <span className={`font-semibold ${row.deletedAt ? "text-slate-500" : "text-slate-950"}`}>{row.title}</span>
                          {row.nextAction ? (
                            <p className="mt-0.5 truncate text-xs text-slate-500">Next: {row.nextAction}</p>
                          ) : null}
                        </td>
                        <td className="max-w-[220px] px-5 py-4">
                          <p className="truncate font-medium text-slate-800">
                            {row.customer?.displayName ?? row.prospectDisplayName ?? "—"}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {row.customer ? row.customer.customerNumber : row.prospectEmail ?? "Prospect"}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <StageBadge stage={row.stage} deleted={Boolean(row.deletedAt)} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums font-medium text-slate-800">
                          {formatMoney(row.estimatedValue, row.currencyCode)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <ProbabilityBar value={row.probabilityPercent} />
                        </td>
                        <td className={`whitespace-nowrap px-5 py-4 ${overdue ? "font-medium text-amber-800" : "text-slate-700"}`}>
                          {row.expectedCloseDate ? String(row.expectedCloseDate).slice(0, 10) : "—"}
                          {overdue ? <span className="ml-1 text-xs">Overdue</span> : null}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4" onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end gap-1 text-xs font-medium">
                            {row.deletedAt ? (
                              <button
                                type="button"
                                disabled={restore.isPending && restore.variables === row.id}
                                className="rounded px-2 py-1.5 text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-50"
                                onClick={() => restore.mutate(row.id)}
                              >
                                {restore.isPending && restore.variables === row.id ? "Restoring…" : "Restore"}
                              </button>
                            ) : (
                              <>
                                <Link className="rounded px-2 py-1.5 text-slate-700 transition hover:bg-slate-100" to={`/opportunities/${row.id}`}>
                                  View
                                </Link>
                                <Link
                                  className="rounded px-2 py-1.5 text-slate-700 transition hover:bg-slate-100"
                                  to={`/opportunities/${row.id}/edit`}
                                >
                                  Edit
                                </Link>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{pageSummary}</span>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="secondary" className="h-8 px-3 text-xs" disabled={!hasPreviousPage} onClick={previousPage}>
              Previous
            </Button>
            <Button variant="secondary" className="h-8 px-3 text-xs" disabled={!hasNextPage} onClick={nextPage}>
              Next
            </Button>
          </div>
        </footer>
      </div>
    </section>
  );
}

export function stageLabel(stage: string): string {
  return stage
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

function SummaryItem({
  label,
  value,
  tone,
  active,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  tone: "slate" | "teal" | "amber";
  active?: boolean;
  hint?: string;
  onClick?: () => void;
}) {
  const valueColor = tone === "teal" ? "text-teal-800" : tone === "amber" ? "text-amber-800" : "text-slate-950";
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={`flex min-h-[76px] w-full flex-col justify-center px-4 py-3 text-left transition first:pl-0 sm:pl-5 ${
        active ? "bg-teal-50/70" : "hover:bg-slate-50"
      }`}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums transition ${valueColor}`}>{value}</p>
      {active ? <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-700">Filtered</p> : null}
    </button>
  );
}

function StageBadge({ stage, deleted }: { stage: OpportunityStage; deleted: boolean }) {
  if (deleted) {
    return <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Deleted</span>;
  }
  if (stage === "WON") {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
        Won
      </span>
    );
  }
  if (stage === "LOST") {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
        Lost
      </span>
    );
  }
  if (stage === "NEW") {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-200">
        New
      </span>
    );
  }
  return (
    <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {stageLabel(stage)}
    </span>
  );
}

function ProbabilityBar({ value }: { value: number }) {
  return (
    <div className="inline-flex min-w-[72px] flex-col items-end gap-1">
      <span className="tabular-nums text-slate-700">{value}%</span>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <span
          className="block h-full rounded-full bg-teal-600 transition-all duration-300"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </span>
    </div>
  );
}

function EmptyState({ filtersActive, onClear }: { filtersActive: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <p className="text-sm font-medium text-slate-800">
        {filtersActive ? "No opportunities match these filters." : "No opportunities yet."}
      </p>
      <p className="max-w-sm text-sm text-slate-500">
        {filtersActive
          ? "Try another stage chip or clear the filters."
          : "Create a prospect or customer-linked deal to start the pipeline."}
      </p>
      {filtersActive ? (
        <Button variant="secondary" className="h-9" onClick={onClear}>
          Clear filters
        </Button>
      ) : (
        <Link to="/opportunities/new">
          <Button className="h-9 bg-teal-800 hover:bg-teal-900">Add New Opportunity</Button>
        </Link>
      )}
    </div>
  );
}

function formatMoney(amount: string, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${amount} ${currency}`;
  }
}

function isOverdue(dateValue: string | null): boolean {
  if (!dateValue) {
    return false;
  }
  const day = String(dateValue).slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return day < today;
}

function OpportunityMobileCard({
  row,
  restoring,
  onRestore,
}: {
  row: Opportunity;
  restoring: boolean;
  onRestore: () => void;
}) {
  const overdue = isOverdue(row.expectedCloseDate) && (OPEN_STAGES as string[]).includes(row.stage);
  return (
    <article className="flex flex-col gap-3 p-4 transition hover:bg-teal-50/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-slate-500">{row.opportunityNumber}</p>
          {row.deletedAt ? (
            <p className="mt-1 break-words font-semibold text-slate-500">{row.title}</p>
          ) : (
            <Link className="mt-1 block break-words font-semibold text-slate-950 transition hover:text-teal-800" to={`/opportunities/${row.id}`}>
              {row.title}
            </Link>
          )}
          <p className="mt-0.5 break-words text-xs text-slate-500">
            {row.customer?.displayName ?? row.prospectDisplayName ?? "No party linked"}
          </p>
        </div>
        <StageBadge stage={row.stage} deleted={Boolean(row.deletedAt)} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-slate-100 py-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Value</dt>
          <dd className="mt-0.5 tabular-nums font-medium text-slate-800">{formatMoney(row.estimatedValue, row.currencyCode)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Probability</dt>
          <dd className="mt-0.5">
            <ProbabilityBar value={row.probabilityPercent} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Expected close</dt>
          <dd className={`mt-0.5 ${overdue ? "font-medium text-amber-800" : "text-slate-800"}`}>
            {row.expectedCloseDate ? String(row.expectedCloseDate).slice(0, 10) : "—"}
            {overdue ? " · Overdue" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Owner</dt>
          <dd className="mt-0.5 text-slate-800">{row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : "—"}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
        {row.deletedAt ? (
          <button type="button" disabled={restoring} className="text-emerald-800 disabled:opacity-50" onClick={onRestore}>
            {restoring ? "Restoring…" : "Restore"}
          </button>
        ) : (
          <>
            <Link className="text-slate-700 transition hover:text-teal-800" to={`/opportunities/${row.id}`}>
              View
            </Link>
            <Link className="text-slate-700 transition hover:text-teal-800" to={`/opportunities/${row.id}/edit`}>
              Edit
            </Link>
          </>
        )}
      </div>
    </article>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable, type DataTableColumn } from "@/components/tables/DataTable.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { useHasPermission } from "@/hooks/useSession.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { LeadsAnalytics } from "./analytics.tsx";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  formatMoney,
  getLeadFormOptions,
  leadSourceLabel,
  leadStatusLabel,
  listLeads,
  restoreLead,
  type Lead,
  type LeadStatus,
} from "./api.ts";

const PAGE_SIZE = 50;

export default function LeadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canDelete = useHasPermission("leads:delete");
  const canRestore = useHasPermission("leads:restore");
  const canSeeDeleted = canDelete || canRestore;
  const [tab, setTab] = useState<"pipeline" | "analytics">("pipeline");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);

  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    source: source || undefined,
    ownerUserId: ownerUserId || undefined,
    includeDeleted: includeDeleted ? "true" : undefined,
    cursor,
    limit: PAGE_SIZE,
  };

  const leads = useQuery({
    queryKey: queryKeys.list("leads", params),
    queryFn: () => listLeads(params),
    enabled: tab === "pipeline",
  });
  const formOptions = useQuery({
    queryKey: ["leads", "form-options"],
    queryFn: getLeadFormOptions,
  });

  const restore = useMutation({
    mutationFn: restoreLead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leads", "list"] });
    },
  });

  const rows = leads.data?.items ?? [];
  const hasNextPage = leads.data?.pageInfo.hasNextPage ?? false;
  const hasPreviousPage = cursors.length > 1;
  const error = leads.isError ? getApiErrorMessage(leads.error) : null;
  const actionError = restore.isError ? getApiErrorMessage(restore.error) : null;
  const filtersActive = Boolean(q || status || source || ownerUserId || includeDeleted);

  const counts = {
    new: rows.filter((row) => !row.deletedAt && row.status === "NEW").length,
    qualified: rows.filter((row) => !row.deletedAt && row.status === "QUALIFIED").length,
    converted: rows.filter((row) => !row.deletedAt && row.status === "CONVERTED").length,
    won: rows.filter((row) => !row.deletedAt && row.status === "WON").length,
  };

  function resetPage() {
    setCursors([undefined]);
  }

  function clearFilters() {
    setQ("");
    setStatus("");
    setSource("");
    setOwnerUserId("");
    setIncludeDeleted(false);
    resetPage();
  }

  const columns: DataTableColumn<Lead>[] = [
    {
      id: "lead",
      header: "Lead",
      cell: (row) => (
        <div className="min-w-[180px]">
          <p className="font-mono text-xs text-slate-500">{row.leadNumber}</p>
          {row.deletedAt ? (
            <p className="mt-0.5 font-semibold text-slate-500">{row.displayName}</p>
          ) : (
            <Link
              className="mt-0.5 block font-semibold text-slate-950 transition hover:text-teal-800"
              to={`/leads/${row.id}`}
            >
              {row.displayName}
            </Link>
          )}
          {row.companyName ? <p className="mt-0.5 truncate text-xs text-slate-500">{row.companyName}</p> : null}
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (row) => (
        <div className="min-w-[160px] text-sm">
          <p className="truncate text-slate-800">{row.email ?? "—"}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{row.phone ?? row.countryCode}</p>
        </div>
      ),
    },
    {
      id: "source",
      header: "Source",
      cell: (row) => <span className="whitespace-nowrap text-slate-700">{leadSourceLabel(row.source)}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} deleted={Boolean(row.deletedAt)} />,
    },
    {
      id: "value",
      header: "Value",
      cell: (row) => (
        <span className="whitespace-nowrap text-right tabular-nums font-medium text-slate-800">
          {formatMoney(row.estimatedValue, row.currencyCode)}
        </span>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      cell: (row) => (
        <span className="whitespace-nowrap text-slate-700">
          {row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : "—"}
        </span>
      ),
    },
    {
      id: "nextAction",
      header: "Next action",
      cell: (row) => {
        const overdue = isOverdue(row.nextActionDueAt) && !["CONVERTED", "WON"].includes(row.status);
        return (
          <div className={`min-w-[150px] text-sm ${overdue ? "font-medium text-amber-800" : "text-slate-700"}`}>
            <p className="max-w-[220px] truncate">{row.nextAction ?? "—"}</p>
            {row.nextActionDueAt ? (
              <p className="mt-0.5 text-xs">
                {row.nextActionDueAt.slice(0, 10)}
                {overdue ? " · Overdue" : ""}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex justify-end gap-1 whitespace-nowrap text-xs font-medium">
          {row.deletedAt ? (
            canRestore ? (
              <button
                type="button"
                disabled={restore.isPending && restore.variables === row.id}
                className="rounded px-2 py-1.5 text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-50"
                onClick={() => restore.mutate(row.id)}
              >
                {restore.isPending && restore.variables === row.id ? "Restoring…" : "Restore"}
              </button>
            ) : null
          ) : (
            <>
              <button
                type="button"
                className="rounded px-2 py-1.5 text-slate-700 transition hover:bg-slate-100"
                onClick={() => navigate(`/leads/${row.id}`)}
              >
                View
              </button>
              <button
                type="button"
                className="rounded px-2 py-1.5 text-slate-700 transition hover:bg-slate-100"
                onClick={() => navigate(`/leads/${row.id}/edit`)}
              >
                Edit
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col items-start justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-teal-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal-600" />
            CRM / Lead management
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">Leads</h1>
          <p className="mt-1 text-sm text-slate-600">
            Capture enquiries, qualify them, then convert into customers and opportunities.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Link to="/leads/new">
            <Button className="h-10 bg-teal-800 px-4 transition hover:bg-teal-900 hover:shadow-sm">Add New Lead</Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
        <TabButton active={tab === "pipeline"} onClick={() => setTab("pipeline")}>
          Pipeline
        </TabButton>
        <TabButton active={tab === "analytics"} onClick={() => setTab("analytics")}>
          Analytics
        </TabButton>
      </div>

      {tab === "analytics" ? <LeadsAnalytics /> : null}

      {tab === "pipeline" ? (
        <>
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 sm:grid-cols-5 sm:divide-y-0">
            <SummaryItem
              label="Visible"
              value={rows.length.toString()}
              active={!status}
              onClick={() => {
                setStatus("");
                resetPage();
              }}
            />
            <SummaryItem label="New" value={counts.new.toString()} tone="teal" active={status === "NEW"} onClick={() => toggleStatus("NEW")} />
            <SummaryItem
              label="Qualified"
              value={counts.qualified.toString()}
              tone="teal"
              active={status === "QUALIFIED"}
              onClick={() => toggleStatus("QUALIFIED")}
            />
            <SummaryItem
              label="Converted"
              value={counts.converted.toString()}
              tone="teal"
              active={status === "CONVERTED"}
              onClick={() => toggleStatus("CONVERTED")}
            />
            <SummaryItem label="Won" value={counts.won.toString()} tone="emerald" active={status === "WON"} onClick={() => toggleStatus("WON")} />
          </div>

          <section
            aria-label="Lead filters"
            className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 sm:p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_180px_190px_220px]">
              <Input
                className="h-10"
                type="search"
                aria-label="Search leads by name, company, number, email or phone"
                value={q}
                placeholder="Search name, company, number, email or phone"
                onChange={(event) => {
                  setQ(event.target.value);
                  resetPage();
                }}
              />
              <select
                aria-label="Filter by status"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 transition focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  resetPage();
                }}
              >
                <option value="">All statuses</option>
                {LEAD_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {leadStatusLabel(value)}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by source"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 transition focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
                value={source}
                onChange={(event) => {
                  setSource(event.target.value);
                  resetPage();
                }}
              >
                <option value="">All sources</option>
                {LEAD_SOURCES.map((value) => (
                  <option key={value} value={value}>
                    {leadSourceLabel(value)}
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

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3" role="group" aria-label="Quick status filters">
              <button
                type="button"
                onClick={() => {
                  setStatus("");
                  resetPage();
                }}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                  !status ? "bg-teal-800 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                All
              </button>
              {LEAD_STATUSES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleStatus(value)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                    status === value
                      ? value === "UNQUALIFIED"
                        ? "bg-amber-700 text-white shadow-sm"
                        : value === "WON"
                          ? "bg-emerald-700 text-white shadow-sm"
                          : "bg-teal-800 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {leadStatusLabel(value)}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              {canSeeDeleted ? (
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
                  Include deleted leads
                </label>
              ) : (
                <span />
              )}
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

          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            isLoading={leads.isPending}
            error={error}
            emptyMessage={filtersActive ? "No leads match these filters." : "No leads yet. Add your first lead to start qualifying."}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
            onNext={() => {
              const next = leads.data?.pageInfo.nextCursor;
              if (next) {
                setCursors((current) => [...current, next]);
              }
            }}
            onPrevious={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
          />

          <p className="text-xs text-slate-500">
            Page {cursors.length} · {rows.length} lead{rows.length === 1 ? "" : "s"} shown
          </p>
        </>
      ) : null}
    </section>
  );

  function toggleStatus(value: LeadStatus) {
    setStatus((current) => (current === value ? "" : value));
    resetPage();
  }
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
        active
          ? "border-teal-800 text-teal-900"
          : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryItem({
  label,
  value,
  tone = "slate",
  active,
  onClick,
}: {
  label: string;
  value: string;
  tone?: "slate" | "teal" | "emerald";
  active?: boolean;
  onClick?: () => void;
}) {
  const valueColor = tone === "teal" ? "text-teal-800" : tone === "emerald" ? "text-emerald-800" : "text-slate-950";
  return (
    <button
      type="button"
      onClick={onClick}
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

function StatusBadge({ status, deleted }: { status: LeadStatus; deleted: boolean }) {
  if (deleted) {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
        Deleted
      </span>
    );
  }
  const style =
    status === "WON"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : status === "CONVERTED"
        ? "bg-teal-50 text-teal-800 ring-teal-200"
        : status === "QUALIFIED"
          ? "bg-cyan-50 text-cyan-800 ring-cyan-200"
          : status === "UNQUALIFIED"
            ? "bg-amber-50 text-amber-800 ring-amber-200"
            : status === "CONTACTED"
              ? "bg-indigo-50 text-indigo-800 ring-indigo-200"
              : "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style}`}>
      {leadStatusLabel(status)}
    </span>
  );
}

function isOverdue(dateValue: string | null): boolean {
  if (!dateValue) {
    return false;
  }
  return dateValue.slice(0, 10) < new Date().toISOString().slice(0, 10);
}

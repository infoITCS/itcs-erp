import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  TENDER_STATUSES,
  getTenderFormOptions,
  listTenders,
  restoreTender,
  type Tender,
  type TenderStatus,
} from "./api.ts";
import {
  TenderStatusBadge,
  formatDate,
  formatDateTime,
  formatMoney,
  isDeadlineOverdue,
  statusLabel,
} from "./shared.tsx";

const PAGE_SIZE = 50;

export default function TendersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("tenders:create");
  const canEdit = useHasPermission("tenders:update");
  const canRestore = useHasPermission("tenders:restore");
  const canDelete = useHasPermission("tenders:delete");
  const canIncludeDeleted = canDelete || canRestore;

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);

  const params = {
    q: debouncedQ || undefined,
    status: (status || undefined) as TenderStatus | undefined,
    customerId: customerId || undefined,
    ownerUserId: ownerUserId || undefined,
    includeDeleted: canIncludeDeleted && includeDeleted ? "true" : undefined,
    cursor,
    limit: PAGE_SIZE,
  };

  const tenders = useQuery({
    queryKey: queryKeys.list("tenders", params),
    queryFn: () => listTenders(params),
  });
  const formOptions = useQuery({
    queryKey: ["tenders", "form-options"],
    queryFn: getTenderFormOptions,
  });

  const restore = useMutation({
    mutationFn: restoreTender,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tenders", "list"] });
    },
  });

  const rows = tenders.data?.items ?? [];
  const hasNextPage = tenders.data?.pageInfo.hasNextPage ?? false;
  const hasPreviousPage = cursors.length > 1;
  const error = tenders.isError ? getApiErrorMessage(tenders.error) : null;
  const actionError = restore.isError ? getApiErrorMessage(restore.error) : null;
  const pageSummary = `${rows.length} tender${rows.length === 1 ? "" : "s"} on page ${cursors.length}`;
  const filtersActive = Boolean(q || status || customerId || ownerUserId || includeDeleted);

  function resetPage() {
    setCursors([undefined]);
  }

  function setStatusFilter(next: string) {
    setStatus((current) => (current === next ? "" : next));
    resetPage();
  }

  function clearFilters() {
    setQ("");
    setStatus("");
    setCustomerId("");
    setOwnerUserId("");
    setIncludeDeleted(false);
    resetPage();
  }

  function nextPage() {
    const next = tenders.data?.pageInfo.nextCursor;
    if (next) {
      setCursors((current) => [...current, next]);
    }
  }

  function previousPage() {
    setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }

  const activeCount = rows.filter((row) => !row.deletedAt).length;

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col items-start justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-teal-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal-600" />
            CRM / Tenders
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">Tenders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track submissions from draft through award, with deadlines and customer links.
          </p>
        </div>
        {canCreate ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Link to="/tenders/new">
              <Button className="h-10 bg-teal-800 px-4 transition hover:bg-teal-900 hover:shadow-sm">
                Add New Tender
              </Button>
            </Link>
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 sm:grid-cols-4 lg:grid-cols-7 lg:divide-y-0">
        <SummaryItem
          label="Visible"
          value={activeCount.toString()}
          tone="slate"
          active={!status}
          onClick={() => {
            setStatus("");
            resetPage();
          }}
        />
        {TENDER_STATUSES.map((value) => (
          <SummaryItem
            key={value}
            label={statusLabel(value)}
            value={rows.filter((row) => !row.deletedAt && row.status === value).length.toString()}
            tone={statusTone(value)}
            active={status === value}
            onClick={() => setStatusFilter(value)}
          />
        ))}
      </div>

      <section
        aria-label="Tender filters"
        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 sm:p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_180px_210px_210px]">
          <Input
            className="h-10"
            type="search"
            aria-label="Search tenders by title, number, reference or customer"
            value={q}
            placeholder="Search title, number or reference"
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
            {TENDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by customer"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 transition focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={customerId}
            onChange={(event) => {
              setCustomerId(event.target.value);
              resetPage();
            }}
          >
            <option value="">All customers</option>
            {(formOptions.data?.customers ?? []).map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.displayName}
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          {canIncludeDeleted ? (
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
              Include deleted tenders
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

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-slate-300">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Tender register</h2>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
              {rows.length}
            </span>
            {status ? (
              <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-100">
                {statusLabel(status)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="divide-y divide-slate-200 xl:hidden">
          {tenders.isPending ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">Loading tenders…</p>
          ) : null}
          {!tenders.isPending && error ? (
            <p className="px-4 py-10 text-center text-sm text-red-700">{error}</p>
          ) : null}
          {!tenders.isPending && !error && rows.length === 0 ? (
            <EmptyState filtersActive={filtersActive} onClear={clearFilters} canCreate={canCreate} />
          ) : null}
          {!tenders.isPending && !error
            ? rows.map((row) => (
                <TenderMobileCard
                  key={row.id}
                  row={row}
                  canEdit={canEdit}
                  canRestore={canRestore}
                  restoring={restore.isPending && restore.variables === row.id}
                  onRestore={() => restore.mutate(row.id)}
                />
              ))
            : null}
        </div>

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Tender</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3">Award date</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenders.isPending ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    Loading tenders…
                  </td>
                </tr>
              ) : null}
              {!tenders.isPending && error ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-red-700">
                    {error}
                  </td>
                </tr>
              ) : null}
              {!tenders.isPending && !error && rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-4">
                    <EmptyState filtersActive={filtersActive} onClear={clearFilters} canCreate={canCreate} />
                  </td>
                </tr>
              ) : null}
              {!tenders.isPending && !error
                ? rows.map((row) => {
                    const overdue = isDeadlineOverdue(row.submissionDeadline, row.status);
                    return (
                      <tr
                        key={row.id}
                        className={`border-t border-slate-100 transition-colors ${
                          row.deletedAt ? "opacity-70" : "cursor-pointer hover:bg-teal-50/40"
                        }`}
                        onClick={() => {
                          if (!row.deletedAt) {
                            navigate(`/tenders/${row.id}`);
                          }
                        }}
                      >
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs font-medium text-slate-500">
                          {row.tenderNumber}
                        </td>
                        <td className="max-w-[250px] px-5 py-4">
                          <span className={`font-semibold ${row.deletedAt ? "text-slate-500" : "text-slate-950"}`}>
                            {row.title}
                          </span>
                          {row.referenceNumber ? (
                            <p className="mt-0.5 truncate text-xs text-slate-500">Ref: {row.referenceNumber}</p>
                          ) : null}
                        </td>
                        <td className="max-w-[220px] px-5 py-4">
                          <p className="truncate font-medium text-slate-800">
                            {row.customer?.displayName ?? "—"}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {row.customer?.customerNumber ?? ""}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <TenderStatusBadge status={row.status} deleted={Boolean(row.deletedAt)} />
                        </td>
                        <td
                          className={`whitespace-nowrap px-5 py-4 ${
                            overdue ? "font-medium text-amber-800" : "text-slate-700"
                          }`}
                        >
                          {formatDateTime(row.submissionDeadline)}
                          {overdue ? <span className="ml-1 text-xs">Overdue</span> : null}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums font-medium text-slate-800">
                          {formatMoney(row.estimatedValue, row.currencyCode)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatDate(row.expectedAwardDate)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : "—"}
                        </td>
                        <td
                          className="whitespace-nowrap px-5 py-4"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex justify-end gap-1 text-xs font-medium">
                            {row.deletedAt ? (
                              canRestore ? (
                                <button
                                  type="button"
                                  disabled={restore.isPending && restore.variables === row.id}
                                  className="rounded px-2 py-1.5 text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-50"
                                  onClick={() => restore.mutate(row.id)}
                                >
                                  {restore.isPending && restore.variables === row.id
                                    ? "Restoring…"
                                    : "Restore"}
                                </button>
                              ) : null
                            ) : (
                              <>
                                <Link
                                  className="rounded px-2 py-1.5 text-slate-700 transition hover:bg-slate-100"
                                  to={`/tenders/${row.id}`}
                                >
                                  View
                                </Link>
                                {canEdit ? (
                                  <Link
                                    className="rounded px-2 py-1.5 text-slate-700 transition hover:bg-slate-100"
                                    to={`/tenders/${row.id}/edit`}
                                  >
                                    Edit
                                  </Link>
                                ) : null}
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
            <Button
              variant="secondary"
              className="h-8 px-3 text-xs"
              disabled={!hasPreviousPage}
              onClick={previousPage}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              className="h-8 px-3 text-xs"
              disabled={!hasNextPage}
              onClick={nextPage}
            >
              Next
            </Button>
          </div>
        </footer>
      </div>
    </section>
  );
}

function SummaryItem({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: string;
  tone: "slate" | "teal" | "blue" | "emerald" | "amber";
  active?: boolean;
  onClick?: () => void;
}) {
  const valueColor =
    tone === "teal"
      ? "text-teal-800"
      : tone === "blue"
        ? "text-blue-800"
        : tone === "emerald"
          ? "text-emerald-800"
          : tone === "amber"
            ? "text-amber-800"
            : "text-slate-950";
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
      {active ? (
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-700">Filtered</p>
      ) : null}
    </button>
  );
}

function statusTone(status: TenderStatus): "slate" | "teal" | "blue" | "emerald" | "amber" {
  switch (status) {
    case "OPEN":
      return "teal";
    case "SUBMITTED":
      return "blue";
    case "WON":
      return "emerald";
    case "LOST":
      return "amber";
    default:
      return "slate";
  }
}

function EmptyState({
  filtersActive,
  onClear,
  canCreate,
}: {
  filtersActive: boolean;
  onClear: () => void;
  canCreate: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <p className="text-sm font-medium text-slate-800">
        {filtersActive ? "No tenders match these filters." : "No tenders yet."}
      </p>
      <p className="max-w-sm text-sm text-slate-500">
        {filtersActive
          ? "Try another status or clear the filters."
          : "Create a tender to track submissions, deadlines and awards."}
      </p>
      {filtersActive ? (
        <Button variant="secondary" className="h-9" onClick={onClear}>
          Clear filters
        </Button>
      ) : canCreate ? (
        <Link to="/tenders/new">
          <Button className="h-9 bg-teal-800 hover:bg-teal-900">Add New Tender</Button>
        </Link>
      ) : null}
    </div>
  );
}

function TenderMobileCard({
  row,
  canEdit,
  canRestore,
  restoring,
  onRestore,
}: {
  row: Tender;
  canEdit: boolean;
  canRestore: boolean;
  restoring: boolean;
  onRestore: () => void;
}) {
  const overdue = isDeadlineOverdue(row.submissionDeadline, row.status);
  return (
    <article className="flex flex-col gap-3 p-4 transition hover:bg-teal-50/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-slate-500">{row.tenderNumber}</p>
          {row.deletedAt ? (
            <p className="mt-1 break-words font-semibold text-slate-500">{row.title}</p>
          ) : (
            <Link
              className="mt-1 block break-words font-semibold text-slate-950 transition hover:text-teal-800"
              to={`/tenders/${row.id}`}
            >
              {row.title}
            </Link>
          )}
          <p className="mt-0.5 break-words text-xs text-slate-500">
            {row.customer?.displayName ?? "No customer linked"}
          </p>
        </div>
        <TenderStatusBadge status={row.status} deleted={Boolean(row.deletedAt)} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-slate-100 py-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Estimated value</dt>
          <dd className="mt-0.5 tabular-nums font-medium text-slate-800">
            {formatMoney(row.estimatedValue, row.currencyCode)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Deadline</dt>
          <dd className={`mt-0.5 ${overdue ? "font-medium text-amber-800" : "text-slate-800"}`}>
            {formatDateTime(row.submissionDeadline)}
            {overdue ? " · Overdue" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Award date</dt>
          <dd className="mt-0.5 text-slate-800">{formatDate(row.expectedAwardDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Owner</dt>
          <dd className="mt-0.5 text-slate-800">
            {row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : "—"}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
        {row.deletedAt ? (
          canRestore ? (
            <button
              type="button"
              disabled={restoring}
              className="text-emerald-800 disabled:opacity-50"
              onClick={onRestore}
            >
              {restoring ? "Restoring…" : "Restore"}
            </button>
          ) : null
        ) : (
          <>
            <Link className="text-slate-700 transition hover:text-teal-800" to={`/tenders/${row.id}`}>
              View
            </Link>
            {canEdit ? (
              <Link
                className="text-slate-700 transition hover:text-teal-800"
                to={`/tenders/${row.id}/edit`}
              >
                Edit
              </Link>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

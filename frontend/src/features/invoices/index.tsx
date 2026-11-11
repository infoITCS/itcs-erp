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
import {
  INVOICE_STATUSES,
  getInvoiceFormOptions,
  listInvoices,
  restoreInvoice,
  type Invoice,
} from "./api.ts";
import { StatusPill, formatDate, formatMoney, statusLabel } from "../sales/shared.tsx";

const PAGE_SIZE = 50;

export default function InvoicesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canDelete = useHasPermission("invoices:delete");
  const canRestore = useHasPermission("invoices:restore");
  const canSeeDeleted = canDelete || canRestore;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);

  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    ownerUserId: ownerUserId || undefined,
    includeDeleted: includeDeleted ? "true" : undefined,
    cursor,
    limit: PAGE_SIZE,
  };

  const invoices = useQuery({ queryKey: queryKeys.list("invoices", params), queryFn: () => listInvoices(params) });
  const formOptions = useQuery({ queryKey: ["invoices", "form-options"], queryFn: getInvoiceFormOptions });

  const restore = useMutation({
    mutationFn: restoreInvoice,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const rows = invoices.data?.items ?? [];
  const filtersActive = Boolean(q || status || ownerUserId || includeDeleted);
  const error = invoices.isError ? getApiErrorMessage(invoices.error) : null;
  const actionError = restore.isError ? getApiErrorMessage(restore.error) : null;

  function resetPage() {
    setCursors([undefined]);
  }

  function clearFilters() {
    setQ("");
    setStatus("");
    setOwnerUserId("");
    setIncludeDeleted(false);
    resetPage();
  }

  const columns: DataTableColumn<Invoice>[] = [
    {
      id: "invoice",
      header: "Invoice",
      cell: (row) => (
        <div className="min-w-[170px]">
          <p className="font-mono text-xs text-slate-500">{row.invoiceNumber}</p>
          {row.deletedAt ? (
            <p className="mt-0.5 font-semibold text-slate-500">{row.customer?.displayName ?? "—"}</p>
          ) : (
            <Link
              className="mt-0.5 block font-semibold text-slate-950 transition hover:text-teal-800"
              to={`/invoices/${row.id}`}
            >
              {row.customer?.displayName ?? "—"}
            </Link>
          )}
          {row.sourceSalesOrder ? (
            <p className="mt-0.5 truncate text-xs text-slate-500">Order {row.sourceSalesOrder.salesOrderNumber}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "dates",
      header: "Dates",
      cell: (row) => {
        const overdue =
          row.dueDate && !["PAID", "VOID"].includes(row.status) && row.dueDate.slice(0, 10) < today();
        return (
          <div className={`whitespace-nowrap text-xs ${overdue ? "font-medium text-amber-800" : "text-slate-600"}`}>
            <p>Issued {formatDate(row.issueDate)}</p>
            <p className="mt-0.5">Due {formatDate(row.dueDate)}</p>
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusPill status={row.status} deleted={Boolean(row.deletedAt)} />,
    },
    {
      id: "total",
      header: "Total",
      cell: (row) => (
        <span className="whitespace-nowrap text-right font-medium tabular-nums text-slate-800">
          {formatMoney(row.total, row.currencyCode)}
        </span>
      ),
    },
    {
      id: "balance",
      header: "Balance",
      cell: (row) => (
        <div className="whitespace-nowrap text-right text-xs">
          <p className="tabular-nums text-slate-800">
            {formatMoney(Number(row.total) - Number(row.amountPaid), row.currencyCode)}
          </p>
          <p className="mt-0.5 text-slate-500">Paid {formatMoney(row.amountPaid, row.currencyCode)}</p>
        </div>
      ),
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
                className="rounded px-2 py-1.5 text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-50"
                disabled={restore.isPending && restore.variables === row.id}
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
                onClick={() => navigate(`/invoices/${row.id}`)}
              >
                View
              </button>
              {row.status === "DRAFT" ? (
                <button
                  type="button"
                  className="rounded px-2 py-1.5 text-slate-700 transition hover:bg-slate-100"
                  onClick={() => navigate(`/invoices/${row.id}/edit`)}
                >
                  Edit
                </button>
              ) : null}
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
            Sales / Receivables
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">Invoices</h1>
          <p className="mt-1 text-sm text-slate-600">
            Issue invoices, track payments and keep an eye on overdue balances.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Link to="/invoices/new">
            <Button className="h-10 bg-teal-800 px-4 transition hover:bg-teal-900">New Invoice</Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 lg:grid-cols-4 lg:divide-y-0">
        {[
          { label: "Outstanding", value: rows.reduce((sum, row) => sum + (row.deletedAt ? 0 : Number(row.total) - Number(row.amountPaid)), 0) },
          { label: "Paid", value: rows.reduce((sum, row) => sum + (row.status === "PAID" && !row.deletedAt ? Number(row.total) : 0), 0) },
          { label: "Overdue", value: rows.reduce((sum, row) => sum + (row.status === "OVERDUE" && !row.deletedAt ? Number(row.total) - Number(row.amountPaid) : 0), 0) },
          { label: "Draft", value: rows.reduce((sum, row) => sum + (row.status === "DRAFT" && !row.deletedAt ? Number(row.total) : 0), 0) },
        ].map((item) => (
          <div key={item.label} className="flex min-h-[76px] flex-col justify-center px-4 py-3 first:pl-0 sm:pl-5">
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-slate-950">
              {formatMoney(item.value, rows[0]?.currencyCode ?? "PKR")}
            </p>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_190px_220px]">
          <Input
            className="h-10"
            type="search"
            aria-label="Search invoices"
            value={q}
            placeholder="Search invoice number, customer, order or reference"
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
          />
          <select
            aria-label="Filter by status"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              resetPage();
            }}
          >
            <option value="">All statuses</option>
            {INVOICE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by owner"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
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
          {canSeeDeleted ? (
            <label className="inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-sm text-slate-700">
              <input
                className="accent-teal-800"
                type="checkbox"
                checked={includeDeleted}
                onChange={(event) => {
                  setIncludeDeleted(event.target.checked);
                  resetPage();
                }}
              />
              Include deleted invoices
            </label>
          ) : (
            <span />
          )}
          {filtersActive ? (
            <button
              type="button"
              className="text-xs font-medium text-teal-800 underline-offset-2 hover:underline"
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
        isLoading={invoices.isPending}
        error={error}
        emptyMessage={filtersActive ? "No invoices match these filters." : "No invoices yet."}
        hasNextPage={invoices.data?.pageInfo.hasNextPage ?? false}
        hasPreviousPage={cursors.length > 1}
        onNext={() => {
          const next = invoices.data?.pageInfo.nextCursor;
          if (next) {
            setCursors((current) => [...current, next]);
          }
        }}
        onPrevious={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
      />

      <p className="text-xs text-slate-500">
        Page {cursors.length} · {rows.length} invoice{rows.length === 1 ? "" : "s"} shown
      </p>
    </section>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

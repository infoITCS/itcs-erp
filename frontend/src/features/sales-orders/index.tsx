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
  SALES_ORDER_STATUSES,
  getSalesOrderFormOptions,
  listSalesOrders,
  restoreSalesOrder,
  type SalesOrder,
} from "./api.ts";
import { StatusPill, formatDate, formatMoney, statusLabel } from "../sales/shared.tsx";

const PAGE_SIZE = 50;

export default function SalesOrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canDelete = useHasPermission("sales-orders:delete");
  const canRestore = useHasPermission("sales-orders:restore");
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

  const orders = useQuery({ queryKey: queryKeys.list("sales-orders", params), queryFn: () => listSalesOrders(params) });
  const formOptions = useQuery({ queryKey: ["sales-orders", "form-options"], queryFn: getSalesOrderFormOptions });

  const restore = useMutation({
    mutationFn: restoreSalesOrder,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    },
  });

  const rows = orders.data?.items ?? [];
  const filtersActive = Boolean(q || status || ownerUserId || includeDeleted);
  const error = orders.isError ? getApiErrorMessage(orders.error) : null;
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

  const columns: DataTableColumn<SalesOrder>[] = [
    {
      id: "order",
      header: "Order",
      cell: (row) => (
        <div className="min-w-[170px]">
          <p className="font-mono text-xs text-slate-500">{row.salesOrderNumber}</p>
          {row.deletedAt ? (
            <p className="mt-0.5 font-semibold text-slate-500">{row.customer?.displayName ?? "—"}</p>
          ) : (
            <Link
              className="mt-0.5 block font-semibold text-slate-950 transition hover:text-brand-800"
              to={`/sales-orders/${row.id}`}
            >
              {row.customer?.displayName ?? "—"}
            </Link>
          )}
          {row.sourceQuote ? (
            <p className="mt-0.5 truncate text-xs text-slate-500">From {row.sourceQuote.quoteNumber}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "dates",
      header: "Dates",
      cell: (row) => (
        <div className="whitespace-nowrap text-xs text-slate-600">
          <p>Ordered {formatDate(row.orderDate)}</p>
          <p className="mt-0.5">Delivery {formatDate(row.expectedDeliveryDate)}</p>
        </div>
      ),
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
      id: "invoices",
      header: "Invoices",
      cell: (row) => <span className="text-slate-700">{row._count?.invoices ?? 0}</span>,
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
                onClick={() => navigate(`/sales-orders/${row.id}`)}
              >
                View
              </button>
              {row.status === "DRAFT" ? (
                <button
                  type="button"
                  className="rounded px-2 py-1.5 text-slate-700 transition hover:bg-slate-100"
                  onClick={() => navigate(`/sales-orders/${row.id}/edit`)}
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
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-brand-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-600" />
            Sales / Order management
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">Sales orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Confirm orders, track fulfilment, then raise invoices from completed work.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Link to="/sales-orders/new">
            <Button className="h-10 bg-brand-800 px-4 transition hover:bg-brand-900">New Order</Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 sm:grid-cols-4 sm:divide-y-0">
        {["CONFIRMED", "PROCESSING", "FULFILLED", "CLOSED"].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setStatus((current) => (current === value ? "" : value));
              resetPage();
            }}
            className={`flex min-h-[76px] flex-col justify-center px-4 py-3 text-left transition first:pl-0 sm:pl-5 ${
              status === value ? "bg-brand-50/70" : "hover:bg-slate-50"
            }`}
          >
            <p className="text-xs font-medium text-slate-500">{statusLabel(value)}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
              {rows.filter((row) => row.status === value && !row.deletedAt).length}
            </p>
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_190px_220px]">
          <Input
            className="h-10"
            type="search"
            aria-label="Search sales orders"
            value={q}
            placeholder="Search order number, customer, quote or reference"
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
          />
          <select
            aria-label="Filter by status"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              resetPage();
            }}
          >
            <option value="">All statuses</option>
            {SALES_ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by owner"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
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
                className="accent-brand-800"
                type="checkbox"
                checked={includeDeleted}
                onChange={(event) => {
                  setIncludeDeleted(event.target.checked);
                  resetPage();
                }}
              />
              Include deleted orders
            </label>
          ) : (
            <span />
          )}
          {filtersActive ? (
            <button
              type="button"
              className="text-xs font-medium text-brand-800 underline-offset-2 hover:underline"
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
        isLoading={orders.isPending}
        error={error}
        emptyMessage={filtersActive ? "No sales orders match these filters." : "No sales orders yet."}
        hasNextPage={orders.data?.pageInfo.hasNextPage ?? false}
        hasPreviousPage={cursors.length > 1}
        onNext={() => {
          const next = orders.data?.pageInfo.nextCursor;
          if (next) {
            setCursors((current) => [...current, next]);
          }
        }}
        onPrevious={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
      />

      <p className="text-xs text-slate-500">
        Page {cursors.length} · {rows.length} order{rows.length === 1 ? "" : "s"} shown
      </p>
    </section>
  );
}

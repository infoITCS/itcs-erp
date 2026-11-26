import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { DataTable, type DataTableColumn } from "@/components/tables/DataTable.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { useHasPermission } from "@/hooks/useSession.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  PURCHASE_ORDER_STATUSES,
  PURCHASING_PERMISSIONS,
  getPurchaseOrderFormOptions,
  listPurchaseOrders,
  restorePurchaseOrder,
  type PurchaseOrder,
} from "../api.ts";
import { PageHeader, StatusPill, docNumber, formatDate, formatMoney, statusLabel } from "../shared.tsx";

const PAGE_SIZE = 50;

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const canCreate = useHasPermission(PURCHASING_PERMISSIONS.create);
  const canRestore = useHasPermission(PURCHASING_PERMISSIONS.restore);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [vendorId, setVendorId] = useState(searchParams.get("vendorId") ?? "");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);

  useEffect(() => {
    const nextStatus = searchParams.get("status") ?? "";
    setStatus((current) => (current === nextStatus ? current : nextStatus));
  }, [searchParams]);

  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    vendorId: vendorId || undefined,
    includeDeleted: canRestore && includeDeleted ? "true" : undefined,
    cursor,
    limit: PAGE_SIZE,
  };

  const orders = useQuery({ queryKey: queryKeys.list("purchasing/orders", params), queryFn: () => listPurchaseOrders(params) });
  const formOptions = useQuery({ queryKey: ["purchasing", "orders", "form-options"], queryFn: getPurchaseOrderFormOptions });

  const restore = useMutation({
    mutationFn: restorePurchaseOrder,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchasing", "orders"] });
    },
  });

  const rows = orders.data?.items ?? [];
  const activeRows = rows.filter((row) => !row.deletedAt);
  const kpis = [
    { label: "Drafts", value: String(activeRows.filter((row) => row.status === "DRAFT").length) },
    { label: "Awaiting receipt", value: String(activeRows.filter((row) => ["APPROVED", "SENT", "PARTIALLY_RECEIVED"].includes(row.status)).length) },
    { label: "Received", value: String(activeRows.filter((row) => row.status === "RECEIVED").length) },
    { label: "Page value", value: formatMoney(activeRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0), activeRows[0]?.currencyCode ?? "PKR") },
  ];
  const filtersActive = Boolean(q || status || vendorId || includeDeleted);

  function resetPage() {
    setCursors([undefined]);
  }

  function clearFilters() {
    setQ("");
    setStatus("");
    setVendorId("");
    setIncludeDeleted(false);
    resetPage();
  }

  const columns: DataTableColumn<PurchaseOrder>[] = [
    {
      id: "order",
      header: "Order",
      cell: (row) => (
        <div className="min-w-[180px]">
          <p className="font-mono text-xs text-slate-500">{docNumber(row)}</p>
          {row.deletedAt ? (
            <p className="mt-0.5 font-semibold text-slate-500">{row.vendor?.displayName ?? row.vendor?.name ?? "—"}</p>
          ) : (
            <Link className="mt-0.5 block font-semibold text-slate-950 hover:text-brand-800" to={`/purchasing/orders/${row.id}`}>
              {row.vendor?.displayName ?? row.vendor?.name ?? "—"}
            </Link>
          )}
          <p className="mt-0.5 truncate text-xs text-slate-500">{row.vendorReference ?? "No reference"}</p>
        </div>
      ),
    },
    {
      id: "dates",
      header: "Dates",
      cell: (row) => (
        <div className="whitespace-nowrap text-xs text-slate-600">
          <p>Ordered {formatDate(row.orderDate ?? row.issueDate)}</p>
          <p className="mt-0.5">Expected {formatDate(row.expectedDeliveryDate)}</p>
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
      cell: (row) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-800">{formatMoney(row.total, row.currencyCode)}</span>,
    },
    {
      id: "lines",
      header: "Lines",
      cell: (row) => <span className="tabular-nums text-slate-700">{row._count?.lines ?? row.lines?.length ?? 0}</span>,
    },
    {
      id: "documents",
      header: "Linked",
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-slate-600">
          {row._count?.receipts ?? row.receipts?.length ?? 0} receipts · {row._count?.bills ?? row.bills?.length ?? 0} bills
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
                className="rounded px-2 py-1.5 text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                disabled={restore.isPending && restore.variables === row.id}
                onClick={() => restore.mutate(row.id)}
              >
                {restore.isPending && restore.variables === row.id ? "Restoring…" : "Restore"}
              </button>
            ) : null
          ) : (
            <>
              <button type="button" className="rounded px-2 py-1.5 text-slate-700 hover:bg-slate-100" onClick={() => navigate(`/purchasing/orders/${row.id}`)}>
                View
              </button>
              {row.status === "DRAFT" ? (
                <button type="button" className="rounded px-2 py-1.5 text-slate-700 hover:bg-slate-100" onClick={() => navigate(`/purchasing/orders/${row.id}/edit`)}>
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
      <PageHeader
        section="Supply / Purchasing"
        title="Purchase orders"
        description="Raise orders, manage approvals and track receipts and bills against each commitment."
        actions={
          canCreate ? (
            <Link to="/purchasing/orders/new">
              <Button className="h-10 bg-brand-800 px-4 hover:bg-brand-900">New order</Button>
            </Link>
          ) : null
        }
      />

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 sm:grid-cols-4 sm:divide-y-0">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex min-h-[76px] flex-col justify-center px-4 py-3 first:pl-0 sm:pl-5">
            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
            <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-slate-950" title={kpi.value}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_190px_240px]">
          <Input
            className="h-10"
            type="search"
            aria-label="Search purchase orders"
            value={q}
            placeholder="Search order number, vendor or reference"
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
          />
          <select
            aria-label="Filter by status"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              resetPage();
            }}
          >
            <option value="">All statuses</option>
            {PURCHASE_ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by vendor"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={vendorId}
            onChange={(event) => {
              setVendorId(event.target.value);
              resetPage();
            }}
          >
            <option value="">All vendors</option>
            {(formOptions.data?.vendors ?? []).map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.displayName ?? vendor.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          {canRestore ? (
            <label className="inline-flex min-h-9 items-center gap-2 px-2 text-sm text-slate-700">
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
            <button type="button" className="text-xs font-medium text-brand-800 hover:underline" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      {restore.isError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {getApiErrorMessage(restore.error)}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={orders.isPending}
        error={orders.isError ? getApiErrorMessage(orders.error) : null}
        emptyMessage={filtersActive ? "No purchase orders match these filters." : "No purchase orders yet."}
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

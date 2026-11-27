import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DataTable, type DataTableColumn } from "@/components/tables/DataTable.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { useHasPermission } from "@/hooks/useSession.ts";
import { purchasingKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  PURCHASING_PERMISSIONS,
  RECEIPT_STATUSES,
  getPurchaseOrderFormOptions,
  listGoodsReceipts,
  listPurchaseOrders,
  restoreGoodsReceipt,
  type GoodsReceipt,
} from "../api.ts";
import {
  ErrorState,
  MetricCard,
  MetricGrid,
  PageHeader,
  RowLink,
  StatusPill,
  docNumber,
  formatDate,
  statusLabel,
  useFilterParams,
} from "../shared.tsx";

const FILTER_KEYS = ["q", "status", "vendorId", "purchaseOrderId", "includeDeleted"] as const;

export default function GoodsReceiptsPage() {
  const queryClient = useQueryClient();
  const { filters, setFilter, clearFilters } = useFilterParams(FILTER_KEYS);
  const canCreate = useHasPermission(PURCHASING_PERMISSIONS.create);
  const canRestore = useHasPermission(PURCHASING_PERMISSIONS.restore);
  const [pageSize, setPageSize] = useState(50);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const q = filters.q ?? "";
  const status = filters.status ?? "";
  const vendorId = filters.vendorId ?? "";
  const purchaseOrderId = filters.purchaseOrderId ?? "";
  const includeDeleted = canRestore && filters.includeDeleted === "true";
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);

  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    vendorId: vendorId || undefined,
    purchaseOrderId: purchaseOrderId || undefined,
    includeDeleted: includeDeleted || undefined,
    cursor,
    limit: pageSize,
  };

  const receipts = useQuery({ queryKey: purchasingKeys.receipts.list(params), queryFn: () => listGoodsReceipts(params) });
  const formOptions = useQuery({ queryKey: purchasingKeys.orders.formOptions(), queryFn: getPurchaseOrderFormOptions });
  const orderOptions = useQuery({
    queryKey: purchasingKeys.orders.list({ limit: 100, vendorId: vendorId || undefined }),
    queryFn: () => listPurchaseOrders({ limit: 100, vendorId: vendorId || undefined }),
  });

  const restore = useMutation({
    mutationFn: restoreGoodsReceipt,
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: purchasingKeys.receipts.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() })]);
    },
  });

  const rows = receipts.data?.items ?? [];
  const activeRows = rows.filter((row) => !row.deletedAt);
  const filtersActive = Boolean(q || status || vendorId || purchaseOrderId || includeDeleted);

  function resetPage() {
    setCursors([undefined]);
  }

  const columns: DataTableColumn<GoodsReceipt>[] = [
    {
      id: "receipt",
      header: "Receipt",
      cell: (row) => (
        <div className="min-w-[170px]">
          <p className="font-mono text-xs text-slate-500">{docNumber(row)}</p>
          {row.deletedAt ? (
            <p className="mt-0.5 font-semibold text-slate-500">{row.vendor?.displayName ?? row.vendor?.name ?? "—"}</p>
          ) : (
            <RowLink to={`/purchasing/receipts/${row.id}`} muted>
              <span className="font-semibold text-slate-950">{row.vendor?.displayName ?? row.vendor?.name ?? "—"}</span>
            </RowLink>
          )}
          <p className="mt-0.5 truncate text-xs text-slate-500">{row.vendorReference ?? "No reference"}</p>
        </div>
      ),
    },
    {
      id: "order",
      header: "Purchase order",
      cell: (row) => (
        <div className="whitespace-nowrap text-xs text-slate-600">
          <RowLink to={`/purchasing/orders/${row.purchaseOrderId}`}>
            <span className="font-mono">{row.purchaseOrder ? docNumber(row.purchaseOrder) : row.purchaseOrderId.slice(0, 8)}</span>
          </RowLink>
          <p className="mt-0.5">{formatDate(row.receiptDate)}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusPill status={row.status} deleted={Boolean(row.deletedAt)} />,
    },
    {
      id: "lines",
      header: "Lines",
      align: "right",
      cell: (row) => <span className="tabular-nums text-slate-700">{row.lines?.length ?? 0}</span>,
    },
    {
      id: "currency",
      header: "Currency",
      cell: (row) => <span className="text-slate-700">{row.currencyCode}</span>,
    },
    {
      id: "posted",
      header: "Posted",
      cell: (row) => <span className="text-xs text-slate-600">{formatDate(row.postedAt)}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
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
            <RowLink to={`/purchasing/receipts/${row.id}`}>View</RowLink>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <PageHeader
        section="Purchasing"
        title="Goods receipts"
        description="Record what actually arrived against each order, then post the receipt to update stock."
        actions={
          canCreate ? (
            <Link to="/purchasing/receipts/new">
              <Button className="h-10 bg-brand-800 px-4 hover:bg-brand-900">New receipt</Button>
            </Link>
          ) : null
        }
      />

      <MetricGrid>
        <MetricCard label="Draft" value={String(activeRows.filter((row) => row.status === "DRAFT").length)} hint="Waiting to be posted" />
        <MetricCard label="Posted" value={String(activeRows.filter((row) => row.status === "POSTED").length)} hint="Stock updated" />
        <MetricCard label="Cancelled" value={String(activeRows.filter((row) => row.status === "CANCELLED").length)} hint="No stock impact" />
        <MetricCard label="Page receipts" value={String(activeRows.length)} hint="Records in this view" />
      </MetricGrid>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_190px_220px_240px]">
          <Input
            className="h-10"
            type="search"
            aria-label="Search receipts"
            value={q}
            placeholder="Search receipt number, order or reference"
            onChange={(event) => {
              setFilter("q", event.target.value);
              resetPage();
            }}
          />
          <select
            aria-label="Filter by status"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={status}
            onChange={(event) => {
              setFilter("status", event.target.value);
              resetPage();
            }}
          >
            <option value="">All statuses</option>
            {RECEIPT_STATUSES.map((value) => (
              <option key={value} value={value}>{statusLabel(value)}</option>
            ))}
          </select>
          <select
            aria-label="Filter by vendor"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={vendorId}
            onChange={(event) => {
              setFilter("vendorId", event.target.value);
              setFilter("purchaseOrderId", "");
              resetPage();
            }}
          >
            <option value="">All vendors</option>
            {(formOptions.data?.vendors ?? []).map((vendor) => (
              <option key={vendor.id} value={vendor.id}>{vendor.displayName ?? vendor.name}</option>
            ))}
          </select>
          <select
            aria-label="Filter by purchase order"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={purchaseOrderId}
            onChange={(event) => {
              setFilter("purchaseOrderId", event.target.value);
              resetPage();
            }}
          >
            <option value="">All purchase orders</option>
            {(orderOptions.data?.items ?? []).map((order) => (
              <option key={order.id} value={order.id}>{docNumber(order)}</option>
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
                  setFilter("includeDeleted", event.target.checked ? "true" : "");
                  resetPage();
                }}
              />
              Include deleted receipts
            </label>
          ) : (
            <span />
          )}
          {filtersActive ? (
            <button type="button" className="text-xs font-medium text-brand-800 hover:underline" onClick={() => { clearFilters(); resetPage(); }}>
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      {restore.isError ? (
        <ErrorState message={getApiErrorMessage(restore.error)} onRetry={() => { if (restore.variables) restore.mutate(restore.variables); }} backTo="/purchasing/receipts" backLabel="Back to receipts" />
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={receipts.isPending}
        error={receipts.isError ? getApiErrorMessage(receipts.error) : null}
        emptyMessage={filtersActive ? "No goods receipts match these filters." : "No goods receipts yet."}
        hasNextPage={receipts.data?.pageInfo.hasNextPage ?? false}
        hasPreviousPage={cursors.length > 1}
        onNext={() => {
          const next = receipts.data?.pageInfo.nextCursor;
          if (next) {
            setCursors((current) => [...current, next]);
          }
        }}
        onPrevious={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size);
          resetPage();
        }}
        onRetry={() => receipts.refetch()}
        onClearFilters={filtersActive ? () => { clearFilters(); resetPage(); } : undefined}
        backTo="/purchasing"
      />
    </section>
  );
}

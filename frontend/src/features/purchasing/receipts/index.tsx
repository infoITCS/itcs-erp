import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { DataTable, type DataTableColumn } from "@/components/tables/DataTable.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { useHasPermission } from "@/hooks/useSession.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  PURCHASING_PERMISSIONS,
  RECEIPT_STATUSES,
  listGoodsReceipts,
  restoreGoodsReceipt,
  type GoodsReceipt,
} from "../api.ts";
import { PageHeader, StatusPill, docNumber, formatDate, statusLabel } from "../shared.tsx";

const PAGE_SIZE = 50;

export default function GoodsReceiptsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const canCreate = useHasPermission(PURCHASING_PERMISSIONS.create);
  const canRestore = useHasPermission(PURCHASING_PERMISSIONS.restore);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);

  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    includeDeleted: canRestore && includeDeleted ? "true" : undefined,
    cursor,
    limit: PAGE_SIZE,
  };

  const receipts = useQuery({ queryKey: queryKeys.list("purchasing/receipts", params), queryFn: () => listGoodsReceipts(params) });
  const restore = useMutation({
    mutationFn: restoreGoodsReceipt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchasing", "receipts"] });
    },
  });

  const rows = receipts.data?.items ?? [];
  const activeRows = rows.filter((row) => !row.deletedAt);
  const filtersActive = Boolean(q || status || includeDeleted);

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
            <Link className="mt-0.5 block font-semibold text-slate-950 hover:text-brand-800" to={`/purchasing/receipts/${row.id}`}>
              {row.vendor?.displayName ?? row.vendor?.name ?? "—"}
            </Link>
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
          <Link className="font-mono hover:text-brand-800 hover:underline" to={`/purchasing/orders/${row.purchaseOrderId}`}>
            {row.purchaseOrder ? docNumber(row.purchaseOrder) : row.purchaseOrderId.slice(0, 8)}
          </Link>
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
      cell: (row) => <span className="text-xs text-slate-600">{formatDate((row as GoodsReceipt & { postedAt?: string | null }).postedAt)}</span>,
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
            <button type="button" className="rounded px-2 py-1.5 text-slate-700 hover:bg-slate-100" onClick={() => navigate(`/purchasing/receipts/${row.id}`)}>
              View
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <PageHeader
        section="Supply / Purchasing"
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

      <div className="grid grid-cols-2 divide-x divide-y border-y border-slate-200 sm:grid-cols-4 sm:divide-y-0">
        {[
          { label: "Draft", value: String(activeRows.filter((row) => row.status === "DRAFT").length) },
          { label: "Posted", value: String(activeRows.filter((row) => row.status === "POSTED").length) },
          { label: "Cancelled", value: String(activeRows.filter((row) => row.status === "CANCELLED").length) },
          { label: "Page receipts", value: String(activeRows.length) },
        ].map((kpi) => (
          <div key={kpi.label} className="flex min-h-[76px] flex-col justify-center px-4 py-3 first:pl-0 sm:pl-5">
            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{kpi.value}</p>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            className="h-10"
            type="search"
            aria-label="Search receipts"
            value={q}
            placeholder="Search receipt number, order or reference"
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
            {RECEIPT_STATUSES.map((value) => (
              <option key={value} value={value}>{statusLabel(value)}</option>
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
              Include deleted receipts
            </label>
          ) : (
            <span />
          )}
          {filtersActive ? (
            <button type="button" className="text-xs font-medium text-brand-800 hover:underline" onClick={() => {
              setQ("");
              setStatus("");
              setIncludeDeleted(false);
              resetPage();
            }}>
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
        isLoading={receipts.isPending}
        error={receipts.isError ? getApiErrorMessage(receipts.error) : null}
        emptyMessage={filtersActive ? "No receipts match these filters." : "No goods receipts yet."}
        hasNextPage={receipts.data?.pageInfo.hasNextPage ?? false}
        hasPreviousPage={cursors.length > 1}
        onNext={() => {
          const next = receipts.data?.pageInfo.nextCursor;
          if (next) {
            setCursors((current) => [...current, next]);
          }
        }}
        onPrevious={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
      />
    </section>
  );
}

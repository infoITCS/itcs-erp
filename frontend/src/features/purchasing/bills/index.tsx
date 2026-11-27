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
  BILL_STATUSES,
  PURCHASING_PERMISSIONS,
  getBillFormOptions,
  listVendorBills,
  restoreVendorBill,
  type VendorBill,
} from "../api.ts";
import {
  ErrorState,
  MetricCard,
  MetricGrid,
  PageHeader,
  RowLink,
  StatusPill,
  billBalance,
  docNumber,
  formatDate,
  formatMoney,
  statusLabel,
  useFilterParams,
} from "../shared.tsx";

const FILTER_KEYS = ["q", "status", "vendorId", "purchaseOrderId", "includeDeleted"] as const;

export default function VendorBillsPage() {
  const queryClient = useQueryClient();
  const { filters, setFilter, clearFilters } = useFilterParams(FILTER_KEYS);
  const canCreate = useHasPermission(PURCHASING_PERMISSIONS.create);
  const canUpdate = useHasPermission(PURCHASING_PERMISSIONS.update);
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

  const bills = useQuery({ queryKey: purchasingKeys.bills.list(params), queryFn: () => listVendorBills(params) });
  const formOptions = useQuery({ queryKey: purchasingKeys.bills.formOptions(), queryFn: getBillFormOptions });

  const restore = useMutation({
    mutationFn: restoreVendorBill,
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: purchasingKeys.bills.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() })]);
    },
  });

  const rows = bills.data?.items ?? [];
  const activeRows = rows.filter((row) => !row.deletedAt);
  const currency = activeRows[0]?.currencyCode ?? "PKR";
  const filtersActive = Boolean(q || status || vendorId || purchaseOrderId || includeDeleted);

  function resetPage() {
    setCursors([undefined]);
  }

  const columns: DataTableColumn<VendorBill>[] = [
    {
      id: "bill",
      header: "Bill",
      cell: (row) => (
        <div className="min-w-[180px]">
          <p className="font-mono text-xs text-slate-500">{docNumber(row)}</p>
          {row.deletedAt ? (
            <p className="mt-0.5 font-semibold text-slate-500">{row.vendor?.displayName ?? row.vendor?.name ?? "—"}</p>
          ) : (
            <RowLink to={`/purchasing/bills/${row.id}`} muted>
              <span className="font-semibold text-slate-950">{row.vendor?.displayName ?? row.vendor?.name ?? "—"}</span>
            </RowLink>
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
          <p>Billed {formatDate(row.billDate)}</p>
          <p className="mt-0.5">Due {formatDate(row.dueDate)}</p>
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
      align: "right",
      cell: (row) => <span className="whitespace-nowrap tabular-nums text-slate-800">{formatMoney(row.total, row.currencyCode)}</span>,
    },
    {
      id: "balance",
      header: "Balance",
      align: "right",
      cell: (row) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-950">{formatMoney(billBalance(row), row.currencyCode)}</span>,
    },
    {
      id: "order",
      header: "Order",
      cell: (row) =>
        row.purchaseOrderId ? (
          <RowLink to={`/purchasing/orders/${row.purchaseOrderId}`}>
            <span className="font-mono">{row.purchaseOrder ? docNumber(row.purchaseOrder) : row.purchaseOrderId.slice(0, 8)}</span>
          </RowLink>
        ) : (
          <span className="whitespace-nowrap text-xs text-slate-500">Standalone</span>
        ),
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
            <>
              <RowLink to={`/purchasing/bills/${row.id}`}>View</RowLink>
              {canUpdate && row.status === "DRAFT" ? (
                <RowLink to={`/purchasing/bills/${row.id}/edit`}>Edit</RowLink>
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
        section="Purchasing"
        title="Vendor bills"
        description="Capture supplier invoices from purchase orders or standalone, then approve and track payments."
        actions={
          canCreate ? (
            <Link to="/purchasing/bills/new">
              <Button className="h-10 bg-brand-800 px-4 hover:bg-brand-900">New bill</Button>
            </Link>
          ) : null
        }
      />

      <MetricGrid>
        <MetricCard label="Drafts" value={String(activeRows.filter((row) => row.status === "DRAFT").length)} hint="Awaiting approval" />
        <MetricCard label="Approved" value={String(activeRows.filter((row) => row.status === "APPROVED").length)} hint="Ready for payment" />
        <MetricCard label="Partially paid" value={String(activeRows.filter((row) => row.status === "PARTIALLY_PAID").length)} hint="Open balances" />
        <MetricCard
          label="Outstanding"
          value={formatMoney(activeRows.reduce((sum, row) => sum + billBalance(row), 0), currency)}
          hint="Across this page"
        />
      </MetricGrid>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_190px_220px_240px]">
          <Input
            className="h-10"
            type="search"
            aria-label="Search vendor bills"
            value={q}
            placeholder="Search bill number, vendor or reference"
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
            {BILL_STATUSES.map((value) => (
              <option key={value} value={value}>{statusLabel(value)}</option>
            ))}
          </select>
          <select
            aria-label="Filter by vendor"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={vendorId}
            onChange={(event) => {
              setFilter("vendorId", event.target.value);
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
            {(formOptions.data?.purchaseOrders ?? []).map((order) => (
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
              Include deleted bills
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
        <ErrorState message={getApiErrorMessage(restore.error)} onRetry={() => { if (restore.variables) restore.mutate(restore.variables); }} backTo="/purchasing/bills" backLabel="Back to bills" />
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={bills.isPending}
        error={bills.isError ? getApiErrorMessage(bills.error) : null}
        emptyMessage={filtersActive ? "No vendor bills match these filters." : "No vendor bills yet."}
        hasNextPage={bills.data?.pageInfo.hasNextPage ?? false}
        hasPreviousPage={cursors.length > 1}
        onNext={() => {
          const next = bills.data?.pageInfo.nextCursor;
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
        onRetry={() => bills.refetch()}
        onClearFilters={filtersActive ? () => { clearFilters(); resetPage(); } : undefined}
        backTo="/purchasing"
      />
    </section>
  );
}

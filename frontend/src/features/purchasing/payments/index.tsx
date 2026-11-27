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
  VENDOR_PAYMENT_STATUSES,
  getVendorPaymentFormOptions,
  listVendorPayments,
  restoreVendorPayment,
  type VendorPayment,
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
  formatMoney,
  statusLabel,
  useFilterParams,
} from "../shared.tsx";

const FILTER_KEYS = ["q", "status", "vendorId", "includeDeleted"] as const;

export default function VendorPaymentsPage() {
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
  const includeDeleted = canRestore && filters.includeDeleted === "true";
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);

  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    vendorId: vendorId || undefined,
    includeDeleted: includeDeleted || undefined,
    cursor,
    limit: pageSize,
  };

  const payments = useQuery({ queryKey: purchasingKeys.payments.list(params), queryFn: () => listVendorPayments(params) });
  const formOptions = useQuery({ queryKey: purchasingKeys.payments.formOptions(), queryFn: getVendorPaymentFormOptions });
  const restore = useMutation({
    mutationFn: restoreVendorPayment,
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: purchasingKeys.payments.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() })]);
    },
  });

  const rows = payments.data?.items ?? [];
  const activeRows = rows.filter((row) => !row.deletedAt);
  const currency = activeRows[0]?.currencyCode ?? "PKR";
  const filtersActive = Boolean(q || status || vendorId || includeDeleted);

  function resetPage() {
    setCursors([undefined]);
  }

  const columns: DataTableColumn<VendorPayment>[] = [
    {
      id: "payment",
      header: "Payment",
      cell: (row) => (
        <div className="min-w-[170px]">
          <p className="font-mono text-xs text-slate-500">{docNumber(row)}</p>
          {row.deletedAt ? (
            <p className="mt-0.5 font-semibold text-slate-500">{row.vendor?.displayName ?? row.vendor?.name ?? "—"}</p>
          ) : (
            <RowLink to={`/purchasing/payments/${row.id}`} muted>
              <span className="font-semibold text-slate-950">{row.vendor?.displayName ?? row.vendor?.name ?? "—"}</span>
            </RowLink>
          )}
          <p className="mt-0.5 truncate text-xs text-slate-500">{row.reference ?? "No reference"}</p>
        </div>
      ),
    },
    {
      id: "date",
      header: "Paid date",
      cell: (row) => <span className="whitespace-nowrap text-xs text-slate-600">{formatDate(row.paidDate)}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusPill status={row.status} deleted={Boolean(row.deletedAt)} />,
    },
    {
      id: "method",
      header: "Method",
      cell: (row) => <span className="text-slate-700">{statusLabel(row.method)}</span>,
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      cell: (row) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-800">{formatMoney(row.amount, row.currencyCode)}</span>,
    },
    {
      id: "allocations",
      header: "Bills",
      align: "right",
      cell: (row) => <span className="tabular-nums text-slate-700">{row._count?.allocations ?? row.allocations?.length ?? 0}</span>,
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
              <RowLink to={`/purchasing/payments/${row.id}`}>View</RowLink>
              {canUpdate && row.status === "DRAFT" ? (
                <RowLink to={`/purchasing/payments/${row.id}/edit`}>Edit</RowLink>
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
        title="Vendor payments"
        description="Record outbound payments, allocate them to bills and approve them for release."
        actions={
          canCreate ? (
            <Link to="/purchasing/payments/new">
              <Button className="h-10 bg-brand-800 px-4 hover:bg-brand-900">Record payment</Button>
            </Link>
          ) : null
        }
      />

      <MetricGrid>
        <MetricCard label="Drafts" value={String(activeRows.filter((row) => row.status === "DRAFT").length)} hint="Awaiting approval" />
        <MetricCard label="Paid" value={String(activeRows.filter((row) => row.status === "PAID").length)} hint="Approved and released" />
        <MetricCard
          label="Page value"
          value={formatMoney(activeRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0), currency)}
          hint="Total on this page"
        />
        <MetricCard
          label="Allocations"
          value={String(activeRows.reduce((sum, row) => sum + (row.allocations?.length ?? 0), 0))}
          hint="Bills linked on this page"
        />
      </MetricGrid>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Input
            className="h-10"
            type="search"
            aria-label="Search vendor payments"
            value={q}
            placeholder="Search payment number, vendor or reference"
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
            {VENDOR_PAYMENT_STATUSES.map((value) => (
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
              Include deleted payments
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
        <ErrorState message={getApiErrorMessage(restore.error)} onRetry={() => { if (restore.variables) restore.mutate(restore.variables); }} backTo="/purchasing/payments" backLabel="Back to payments" />
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={payments.isPending}
        error={payments.isError ? getApiErrorMessage(payments.error) : null}
        emptyMessage={filtersActive ? "No vendor payments match these filters." : "No vendor payments yet."}
        hasNextPage={payments.data?.pageInfo.hasNextPage ?? false}
        hasPreviousPage={cursors.length > 1}
        onNext={() => {
          const next = payments.data?.pageInfo.nextCursor;
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
        onRetry={() => payments.refetch()}
        onClearFilters={filtersActive ? () => { clearFilters(); resetPage(); } : undefined}
        backTo="/purchasing"
      />
    </section>
  );
}

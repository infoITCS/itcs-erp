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
  BILL_STATUSES,
  PURCHASING_PERMISSIONS,
  getBillFormOptions,
  listVendorBills,
  restoreVendorBill,
  type VendorBill,
} from "../api.ts";
import { PageHeader, StatusPill, billBalance, docNumber, formatDate, formatMoney, statusLabel } from "../shared.tsx";

const PAGE_SIZE = 50;

export default function VendorBillsPage() {
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

  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    vendorId: vendorId || undefined,
    includeDeleted: canRestore && includeDeleted ? "true" : undefined,
    cursor,
    limit: PAGE_SIZE,
  };

  const bills = useQuery({ queryKey: queryKeys.list("purchasing/bills", params), queryFn: () => listVendorBills(params) });
  const formOptions = useQuery({ queryKey: ["purchasing", "bills", "form-options"], queryFn: getBillFormOptions });

  const restore = useMutation({
    mutationFn: restoreVendorBill,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchasing", "bills"] });
    },
  });

  const rows = bills.data?.items ?? [];
  const activeRows = rows.filter((row) => !row.deletedAt);
  const currency = activeRows[0]?.currencyCode ?? "PKR";
  const kpis = [
    { label: "Drafts", value: String(activeRows.filter((row) => row.status === "DRAFT").length) },
    { label: "Approved", value: String(activeRows.filter((row) => row.status === "APPROVED").length) },
    { label: "Partially paid", value: String(activeRows.filter((row) => row.status === "PARTIALLY_PAID").length) },
    { label: "Outstanding", value: formatMoney(activeRows.reduce((sum, row) => sum + billBalance(row), 0), currency) },
  ];
  const filtersActive = Boolean(q || status || vendorId || includeDeleted);

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
            <Link className="mt-0.5 block font-semibold text-slate-950 hover:text-brand-800" to={`/purchasing/bills/${row.id}`}>
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
      cell: (row) => <span className="whitespace-nowrap tabular-nums text-slate-800">{formatMoney(row.total, row.currencyCode)}</span>,
    },
    {
      id: "balance",
      header: "Balance",
      cell: (row) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-950">{formatMoney(billBalance(row), row.currencyCode)}</span>,
    },
    {
      id: "order",
      header: "Order",
      cell: (row) => (
        <span className="whitespace-nowrap font-mono text-xs text-slate-600">
          {row.purchaseOrder ? docNumber(row.purchaseOrder) : "Standalone"}
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
              <button type="button" className="rounded px-2 py-1.5 text-slate-700 hover:bg-slate-100" onClick={() => navigate(`/purchasing/bills/${row.id}`)}>
                View
              </button>
              {row.status === "DRAFT" ? (
                <button type="button" className="rounded px-2 py-1.5 text-slate-700 hover:bg-slate-100" onClick={() => navigate(`/purchasing/bills/${row.id}/edit`)}>
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

      <div className="grid grid-cols-2 divide-x divide-y border-y border-slate-200 sm:grid-cols-4 sm:divide-y-0">
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
            aria-label="Search vendor bills"
            value={q}
            placeholder="Search bill number, vendor or reference"
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
            {BILL_STATUSES.map((value) => (
              <option key={value} value={value}>{statusLabel(value)}</option>
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
                  setIncludeDeleted(event.target.checked);
                  resetPage();
                }}
              />
              Include deleted bills
            </label>
          ) : (
            <span />
          )}
          {filtersActive ? (
            <button type="button" className="text-xs font-medium text-brand-800 hover:underline" onClick={() => {
              setQ("");
              setStatus("");
              setVendorId("");
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
      />
    </section>
  );
}

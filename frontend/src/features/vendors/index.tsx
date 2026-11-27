import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DataTable, type DataTableColumn } from "@/components/tables/DataTable.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { useHasPermission } from "@/hooks/useSession.ts";
import { purchasingKeys, vendorKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  ErrorState,
  MetricCard,
  MetricGrid,
  PageHeader,
  RowLink,
  StatusPill,
  formatDate,
  statusLabel,
  useFilterParams,
} from "../purchasing/shared.tsx";
import {
  VENDOR_PERMISSIONS,
  getVendorFormOptions,
  listVendors,
  restoreVendor,
  type Vendor,
} from "./api.ts";

const FILTER_KEYS = ["q", "status", "currencyCode", "paymentTermId", "sort", "order", "includeDeleted"] as const;
const FALLBACK_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"];

export default function VendorsPage() {
  const queryClient = useQueryClient();
  const { filters, setFilter, clearFilters } = useFilterParams(FILTER_KEYS);
  const canCreate = useHasPermission(VENDOR_PERMISSIONS.create);
  const canUpdate = useHasPermission(VENDOR_PERMISSIONS.update);
  const canRestore = useHasPermission(VENDOR_PERMISSIONS.restore);
  const [pageSize, setPageSize] = useState(50);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const q = filters.q ?? "";
  const status = filters.status ?? "";
  const currencyCode = filters.currencyCode ?? "";
  const paymentTermId = filters.paymentTermId ?? "";
  const sort = filters.sort ?? "createdAt";
  const order = filters.order === "asc" ? "asc" : "desc";
  const includeDeleted = canRestore && filters.includeDeleted === "true";
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);

  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    currencyCode: currencyCode || undefined,
    paymentTermId: paymentTermId || undefined,
    includeDeleted: includeDeleted || undefined,
    sort,
    order,
    cursor,
    limit: pageSize,
  };

  const vendors = useQuery({ queryKey: vendorKeys.list(params), queryFn: () => listVendors(params) });
  const formOptions = useQuery({ queryKey: vendorKeys.formOptions(), queryFn: getVendorFormOptions });

  const restore = useMutation({
    mutationFn: restoreVendor,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: vendorKeys.all() }),
        queryClient.invalidateQueries({ queryKey: purchasingKeys.formOptions() }),
        queryClient.invalidateQueries({ queryKey: purchasingKeys.orders.formOptions() }),
        queryClient.invalidateQueries({ queryKey: purchasingKeys.bills.formOptions() }),
        queryClient.invalidateQueries({ queryKey: purchasingKeys.payments.formOptions() }),
        queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
      ]);
    },
  });

  const rows = vendors.data?.items ?? [];
  const activeRows = rows.filter((row) => !row.deletedAt);
  const filtersActive = Boolean(q || status || currencyCode || paymentTermId || includeDeleted);

  function resetPage() {
    setCursors([undefined]);
  }

  function changeSort(key: string) {
    if (sort === key) {
      setFilter("order", order === "asc" ? "desc" : "asc");
    } else {
      setFilter("sort", key);
      setFilter("order", "asc");
    }
    resetPage();
  }

  const columns: DataTableColumn<Vendor>[] = [
    {
      id: "name",
      header: "Vendor",
      sortable: true,
      cell: (row) => (
        <div className="min-w-[200px]">
          <p className="font-mono text-xs text-slate-500">{row.code ?? "—"}</p>
          {row.deletedAt ? (
            <p className="mt-0.5 font-semibold text-slate-500">{row.displayName ?? row.name}</p>
          ) : (
            <RowLink to={`/vendors/${row.id}`} muted>
              <span className="font-semibold text-slate-950">{row.displayName ?? row.name}</span>
            </RowLink>
          )}
          <p className="mt-0.5 truncate text-xs text-slate-500">{row.legalName ?? row.email ?? "—"}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (row) => <StatusPill status={row.status} deleted={Boolean(row.deletedAt)} />,
    },
    {
      id: "commercial",
      header: "Commercial",
      cell: (row) => (
        <div className="whitespace-nowrap text-xs text-slate-600">
          <p>{row.currencyCode}</p>
          <p className="mt-0.5">{row.paymentTerm?.name ?? "No payment term"}</p>
        </div>
      ),
    },
    {
      id: "vendorType",
      header: "Type",
      cell: (row) => (
        <div className="whitespace-nowrap text-xs text-slate-600">
          <p>{row.vendorType ? statusLabel(row.vendorType) : "—"}</p>
          <p className="mt-0.5">{row.category ?? "Uncategorized"}</p>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (row) => (
        <div className="whitespace-nowrap text-xs text-slate-600">
          <p>{row.email ?? "—"}</p>
          <p className="mt-0.5">{row.phone ?? "—"}</p>
        </div>
      ),
    },
    {
      id: "createdAt",
      header: "Created",
      sortable: true,
      cell: (row) => <span className="whitespace-nowrap text-xs text-slate-600">{formatDate(row.createdAt)}</span>,
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
              <RowLink to={`/vendors/${row.id}`}>View</RowLink>
              {canUpdate ? <RowLink to={`/vendors/${row.id}/edit`}>Edit</RowLink> : null}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <PageHeader
        section="Vendors"
        title="Vendors"
        description="Maintain supplier identities, commercial terms, contacts and banking details."
        actions={
          canCreate ? (
            <Link to="/vendors/new">
              <Button className="h-10 bg-brand-800 px-4 hover:bg-brand-900">New vendor</Button>
            </Link>
          ) : null
        }
      />

      <MetricGrid>
        <MetricCard label="Vendors on this page" value={String(activeRows.length)} hint="Visible records" />
        <MetricCard label="Active" value={String(activeRows.filter((row) => row.status === "ACTIVE").length)} hint="Approved for purchasing" />
        <MetricCard
          label="On hold or blocked"
          value={String(activeRows.filter((row) => row.status !== "ACTIVE").length)}
          hint="Needs review before use"
        />
        <MetricCard label="Currencies" value={String(new Set(activeRows.map((row) => row.currencyCode)).size)} hint="Distinct settlement currencies" />
      </MetricGrid>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_180px_180px_220px]">
          <Input
            className="h-10"
            type="search"
            aria-label="Search vendors"
            value={q}
            placeholder="Search code, name, legal name or email"
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
            {(formOptions.data?.statuses ?? FALLBACK_STATUSES.map((value) => ({ value, label: statusLabel(value) }))).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            aria-label="Filter by currency"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={currencyCode}
            onChange={(event) => {
              setFilter("currencyCode", event.target.value);
              resetPage();
            }}
          >
            <option value="">All currencies</option>
            {(formOptions.data?.currencies ?? []).map((currency) => (
              <option key={currency.code} value={currency.code}>{currency.code}</option>
            ))}
          </select>
          <select
            aria-label="Filter by payment term"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={paymentTermId}
            onChange={(event) => {
              setFilter("paymentTermId", event.target.value);
              resetPage();
            }}
          >
            <option value="">All payment terms</option>
            {(formOptions.data?.paymentTerms ?? []).map((term) => (
              <option key={term.id} value={term.id}>{term.name} ({term.dueDays} days)</option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500" htmlFor="vendor-sort">Sort by</label>
            <select
              id="vendor-sort"
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              value={sort}
              onChange={(event) => {
                setFilter("sort", event.target.value);
                resetPage();
              }}
            >
              <option value="createdAt">Created</option>
              <option value="name">Name</option>
              <option value="code">Code</option>
              <option value="status">Status</option>
            </select>
            <select
              aria-label="Sort direction"
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              value={order}
              onChange={(event) => {
                setFilter("order", event.target.value);
                resetPage();
              }}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
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
                Include deleted
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
        </div>
      </section>

      {restore.isError ? (
        <ErrorState message={getApiErrorMessage(restore.error)} onRetry={() => { if (restore.variables) restore.mutate(restore.variables); }} backTo="/vendors" backLabel="Back to vendors" />
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={vendors.isPending}
        error={vendors.isError ? getApiErrorMessage(vendors.error) : null}
        emptyMessage={filtersActive ? "No vendors match these filters." : "No vendors yet. Add your first supplier."}
        hasNextPage={vendors.data?.pageInfo.hasNextPage ?? false}
        hasPreviousPage={cursors.length > 1}
        onNext={() => {
          const next = vendors.data?.pageInfo.nextCursor;
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
        sort={{ key: sort, direction: order }}
        onSort={changeSort}
        onRetry={() => vendors.refetch()}
        onClearFilters={filtersActive ? () => { clearFilters(); resetPage(); } : undefined}
        backTo="/purchasing"
      />

      <p className="text-xs text-slate-500">
        Page {cursors.length} · {rows.length} vendor{rows.length === 1 ? "" : "s"} shown
      </p>
    </section>
  );
}

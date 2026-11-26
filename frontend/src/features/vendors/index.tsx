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
import { Detail, Panel, StatusPill, formatDate, statusLabel } from "../sales/shared.tsx";
import {
  VENDOR_PERMISSIONS,
  VENDOR_STATUSES,
  getVendorFormOptions,
  listVendors,
  restoreVendor,
  type Vendor,
} from "./api.ts";

const PAGE_SIZE = 50;

export default function VendorsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(VENDOR_PERMISSIONS.create);
  const canRestore = useHasPermission(VENDOR_PERMISSIONS.restore);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [paymentTermId, setPaymentTermId] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);

  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    currencyCode: currencyCode || undefined,
    paymentTermId: paymentTermId || undefined,
    includeDeleted: canRestore && includeDeleted ? "true" : undefined,
    sort,
    order,
    cursor,
    limit: PAGE_SIZE,
  };

  const vendors = useQuery({ queryKey: queryKeys.list("vendors", params), queryFn: () => listVendors(params) });
  const formOptions = useQuery({ queryKey: ["vendors", "form-options"], queryFn: getVendorFormOptions });

  const restore = useMutation({
    mutationFn: restoreVendor,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });

  const rows = vendors.data?.items ?? [];
  const activeRows = rows.filter((row) => !row.deletedAt);
  const kpis = [
    { label: "Vendors on this page", value: String(activeRows.length), note: "Visible records" },
    {
      label: "Active",
      value: String(activeRows.filter((row) => row.status === "ACTIVE").length),
      note: "Approved for purchasing",
    },
    {
      label: "On hold or blocked",
      value: String(activeRows.filter((row) => row.status === "HOLD" || row.status === "BLOCKED").length),
      note: "Needs review before use",
    },
    {
      label: "Currencies",
      value: String(new Set(activeRows.map((row) => row.currencyCode)).size),
      note: "Distinct settlement currencies",
    },
  ];
  const filtersActive = Boolean(q || status || currencyCode || paymentTermId || includeDeleted);

  function resetPage() {
    setCursors([undefined]);
  }

  function clearFilters() {
    setQ("");
    setStatus("");
    setCurrencyCode("");
    setPaymentTermId("");
    setIncludeDeleted(false);
    resetPage();
  }

  const columns: DataTableColumn<Vendor>[] = [
    {
      id: "vendor",
      header: "Vendor",
      cell: (row) => (
        <div className="min-w-[200px]">
          <p className="font-mono text-xs text-slate-500">{row.code ?? "—"}</p>
          {row.deletedAt ? (
            <p className="mt-0.5 font-semibold text-slate-500">{row.displayName ?? row.name}</p>
          ) : (
            <Link className="mt-0.5 block font-semibold text-slate-950 hover:text-brand-800" to={`/vendors/${row.id}`}>
              {row.displayName ?? row.name}
            </Link>
          )}
          <p className="mt-0.5 truncate text-xs text-slate-500">{row.legalName ?? row.email ?? "—"}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
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
      id: "type",
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
      id: "created",
      header: "Created",
      cell: (row) => <span className="whitespace-nowrap text-xs text-slate-600">{formatDate(row.createdAt)}</span>,
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
              <button type="button" className="rounded px-2 py-1.5 text-slate-700 hover:bg-slate-100" onClick={() => navigate(`/vendors/${row.id}`)}>
                View
              </button>
              <button type="button" className="rounded px-2 py-1.5 text-slate-700 hover:bg-slate-100" onClick={() => navigate(`/vendors/${row.id}/edit`)}>
                Edit
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col items-start justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
            <span className="h-2 w-2 rounded-full bg-brand-600" />
            Supply / Vendor master
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">Vendors</h1>
          <p className="mt-1 text-sm text-slate-600">Maintain supplier identities, commercial terms, contacts and banking details.</p>
        </div>
        {canCreate ? (
          <Link to="/vendors/new">
            <Button className="h-10 bg-brand-800 px-4 hover:bg-brand-900">New vendor</Button>
          </Link>
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Panel key={kpi.label} title={kpi.label}>
            <p className="text-2xl font-semibold tabular-nums text-slate-950">{kpi.value}</p>
            <p className="mt-1 text-xs text-slate-500">{kpi.note}</p>
          </Panel>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_180px_180px_220px]">
          <Input
            className="h-10"
            type="search"
            aria-label="Search vendors"
            value={q}
            placeholder="Search code, name, legal name or email"
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
            {(formOptions.data?.statuses ?? VENDOR_STATUSES.map((value) => ({ value, label: statusLabel(value) }))).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by currency"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={currencyCode}
            onChange={(event) => {
              setCurrencyCode(event.target.value);
              resetPage();
            }}
          >
            <option value="">All currencies</option>
            {(formOptions.data?.currencies ?? []).map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.code}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by payment term"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={paymentTermId}
            onChange={(event) => {
              setPaymentTermId(event.target.value);
              resetPage();
            }}
          >
            <option value="">All payment terms</option>
            {(formOptions.data?.paymentTerms ?? []).map((term) => (
              <option key={term.id} value={term.id}>
                {term.name} ({term.dueDays} days)
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500" htmlFor="vendor-sort">
              Sort by
            </label>
            <select
              id="vendor-sort"
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
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
                setOrder(event.target.value);
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
                    setIncludeDeleted(event.target.checked);
                    resetPage();
                  }}
                />
                Include deleted
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
      />

      <p className="text-xs text-slate-500">
        Page {cursors.length} · {rows.length} vendor{rows.length === 1 ? "" : "s"} shown
      </p>

      <Detail label="Tip" value="Vendors on hold or blocked cannot be used for new purchase orders until their status is updated." />
    </section>
  );
}

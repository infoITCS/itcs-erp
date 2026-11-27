import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DataTable, type DataTableColumn } from "@/components/tables/DataTable.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { useHasPermission } from "@/hooks/useSession.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  ListFilters,
  MetricGrid,
  MetricCard,
  PageHeader,
  RowLink,
  UnauthorizedState,
  formatQuantity,
  numberValue,
  optionLabel,
  optionValue,
  statusLabel,
  useFilterParams,
} from "../purchasing/shared.tsx";
import {
  INVENTORY_PERMISSIONS,
  getInventoryFormOptions,
  listInventoryMovements,
  type InventoryMovement,
} from "./api.ts";

const FILTER_KEYS = ["q", "type", "productId", "location"] as const;
const PAGE_SIZE = 50;

export default function InventoryMovementsPage() {
  const { filters, setFilter, clearFilters } = useFilterParams(FILTER_KEYS);
  const canRead = useHasPermission(INVENTORY_PERMISSIONS.read);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const q = filters.q ?? "";
  const movementType = filters.type ?? "";
  const productId = filters.productId ?? "";
  const location = filters.location ?? "";
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);
  const filtersActive = Boolean(q || movementType || productId || location);

  const params = {
    q: debouncedQ || undefined,
    type: movementType || undefined,
    productId: productId || undefined,
    location: location || undefined,
    cursor,
    limit: pageSize,
  };

  const movements = useQuery({
    queryKey: queryKeys.list("inventory/movements", params),
    queryFn: () => listInventoryMovements(params),
    enabled: canRead,
  });
  const formOptions = useQuery({
    queryKey: ["inventory", "form-options"],
    queryFn: getInventoryFormOptions,
    enabled: canRead,
  });

  if (!canRead) {
    return <UnauthorizedState backTo="/purchasing" backLabel="Back to purchasing" />;
  }

  const rows = movements.data?.items ?? [];
  const inward = rows.reduce((sum, row) => sum + Math.max(numberValue(row.quantity), 0), 0);
  const outward = rows.reduce((sum, row) => sum + Math.abs(Math.min(numberValue(row.quantity), 0)), 0);

  function resetPage() {
    setCursors([undefined]);
  }

  const columns: DataTableColumn<InventoryMovement>[] = [
    {
      id: "date",
      header: "Date",
      cell: (row) => <span className="whitespace-nowrap text-xs text-slate-600">{row.createdAt ? row.createdAt.slice(0, 16).replace("T", " ") : "—"}</span>,
    },
    {
      id: "product",
      header: "Product",
      cell: (row) => (
        <div className="min-w-[180px]">
          <p className="font-mono text-xs text-slate-500">{row.productCode ?? row.product?.code ?? "—"}</p>
          {row.productId ? (
            <RowLink to={`/products/${row.productId}`} muted>
              <span className="font-semibold text-slate-950">{row.productName ?? row.product?.name ?? "Product"}</span>
            </RowLink>
          ) : (
            <p className="mt-0.5 font-semibold text-slate-950">{row.productName ?? row.product?.name ?? "Product"}</p>
          )}
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: (row) => <span className="whitespace-nowrap text-slate-700">{statusLabel(row.movementType ?? row.type ?? "ADJUSTMENT")}</span>,
    },
    {
      id: "direction",
      header: "Direction",
      cell: (row) => {
        const quantity = numberValue(row.quantity);
        const isInward = quantity >= 0 || String(row.direction ?? "").toUpperCase().includes("IN");
        return (
          <span className={`whitespace-nowrap text-xs font-semibold ${isInward ? "text-emerald-700" : "text-amber-800"}`}>
            {isInward ? "Inward" : "Outward"}
          </span>
        );
      },
    },
    {
      id: "quantity",
      header: "Quantity",
      cell: (row) => <span className="font-medium tabular-nums text-slate-900">{formatQuantity(row.quantity)}</span>,
    },
    {
      id: "balance",
      header: "Balance after",
      cell: (row) => <span className="tabular-nums text-slate-700">{formatQuantity(row.balanceAfter)}</span>,
    },
    {
      id: "location",
      header: "Location",
      cell: (row) => <span className="text-slate-700">{row.location ?? "Unassigned"}</span>,
    },
    {
      id: "reason",
      header: "Reason / reference",
      cell: (row) => (
        <div className="min-w-[170px] text-xs text-slate-600">
          <p>{row.reason ?? row.source ?? "—"}</p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-400">{row.reference ?? row.referenceType ?? ""}</p>
        </div>
      ),
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <PageHeader
        section="Supply chain / Inventory"
        title="Movement ledger"
        description="An append-only record of stock receipts, issues, transfers and manual adjustments."
        actions={
          <Link className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm text-slate-700 hover:bg-slate-50" to="/inventory">
            Stock on hand
          </Link>
        }
      />

      <MetricGrid>
        <MetricCard label="Movements on page" value={String(rows.length)} hint="Most recent ledger entries" />
        <MetricCard label="Inward units" value={formatQuantity(inward)} hint="Positive quantity movements" />
        <MetricCard label="Outward units" value={formatQuantity(outward)} hint="Negative quantity movements" />
        <MetricCard label="Products affected" value={String(new Set(rows.map((row) => row.productId)).size)} hint="Distinct products in view" />
      </MetricGrid>

      <ListFilters
        q={q}
        onSearch={(value) => {
          setFilter("q", value);
          resetPage();
        }}
        status={movementType}
        onStatus={(value) => {
          setFilter("type", value);
          resetPage();
        }}
        statuses={(formOptions.data?.movementTypes ?? []).map((option) => ({ value: optionValue(option), label: optionLabel(option) }))}
        statusFilterLabel="Movement type"
        extra={
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              aria-label="Filter by product"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={productId}
              onChange={(event) => {
                setFilter("productId", event.target.value);
                resetPage();
              }}
            >
              <option value="">All products</option>
              {(formOptions.data?.products ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.code ? `${product.code} · ` : ""}{product.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by location"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={location}
              onChange={(event) => {
                setFilter("location", event.target.value);
                resetPage();
              }}
            >
              <option value="">All locations</option>
              {(formOptions.data?.locations ?? []).map((option) => (
                <option key={optionValue(option)} value={optionValue(option)}>{optionLabel(option)}</option>
              ))}
            </select>
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={movements.isPending}
        error={movements.isError ? getApiErrorMessage(movements.error) : null}
        emptyMessage={filtersActive ? "No movements match these filters." : "No stock movements recorded yet."}
        hasNextPage={movements.data?.pageInfo.hasNextPage ?? false}
        hasPreviousPage={cursors.length > 1}
        onNext={() => {
          const next = movements.data?.pageInfo.nextCursor;
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
        onRetry={() => movements.refetch()}
        onClearFilters={filtersActive ? () => { clearFilters(); resetPage(); } : undefined}
        backTo="/inventory"
      />
    </section>
  );
}

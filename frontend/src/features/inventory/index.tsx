import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "@/components/modals/Modal.tsx";
import { DataTable, type DataTableColumn } from "@/components/tables/DataTable.tsx";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
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
  useFilterParams,
} from "../purchasing/shared.tsx";
import {
  INVENTORY_PERMISSIONS,
  createInventoryAdjustment,
  getInventoryFormOptions,
  listStock,
  type StockItem,
} from "./api.ts";

function unitLabel(value: unknown): string {
  if (typeof value === "string" && value) {
    return value;
  }
  if (value && typeof value === "object") {
    const unit = value as { code?: unknown; name?: unknown };
    if (typeof unit.code === "string" && unit.code) {
      return unit.code;
    }
    if (typeof unit.name === "string" && unit.name) {
      return unit.name;
    }
  }
  return "—";
}

const FILTER_KEYS = ["q", "location"] as const;
const PAGE_SIZE = 50;

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { filters, setFilter, clearFilters } = useFilterParams(FILTER_KEYS);
  const canRead = useHasPermission(INVENTORY_PERMISSIONS.read);
  const canAdjust = useHasPermission(INVENTORY_PERMISSIONS.manage);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [adjustLocation, setAdjustLocation] = useState("");
  const [reason, setReason] = useState("Manual adjustment");
  const [formError, setFormError] = useState<string | null>(null);
  const q = filters.q ?? "";
  const location = filters.location ?? "";
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);
  const filtersActive = Boolean(q || location);

  const params = {
    q: debouncedQ || undefined,
    location: location || undefined,
    cursor,
    limit: pageSize,
  };

  const stock = useQuery({
    queryKey: queryKeys.list("inventory/stock", params),
    queryFn: () => listStock(params),
    enabled: canRead,
  });
  const formOptions = useQuery({
    queryKey: ["inventory", "form-options"],
    queryFn: getInventoryFormOptions,
    enabled: canRead || canAdjust,
  });

  const adjust = useMutation({
    mutationFn: () =>
      createInventoryAdjustment({
        productId,
        quantity,
        location: adjustLocation || undefined,
        reason: reason || undefined,
      }),
    onSuccess: async () => {
      setAdjustOpen(false);
      setProductId("");
      setQuantity("");
      setFormError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory/stock"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory/movements"] }),
        queryClient.invalidateQueries({ queryKey: ["purchasing", "hub"] }),
      ]);
    },
    onError: (error) => setFormError(getApiErrorMessage(error)),
  });

  if (!canRead) {
    return <UnauthorizedState backTo="/purchasing" backLabel="Back to purchasing" />;
  }

  const rows = stock.data?.items ?? [];
  const totalOnHand = rows.reduce(
    (sum, row) => sum + numberValue(row.quantity ?? row.quantityOnHand ?? row.availableQuantity),
    0,
  );
  const totalAvailable = rows.reduce((sum, row) => sum + numberValue(row.availableQuantity ?? row.quantity ?? row.quantityOnHand), 0);
  const locationCount = new Set(rows.map((row) => row.location ?? row.warehouse ?? "Unassigned").filter(Boolean)).size;

  function resetPage() {
    setCursors([undefined]);
  }

  function openAdjustment() {
    setFormError(null);
    setProductId("");
    setQuantity("");
    setAdjustLocation(location);
    setReason("Manual adjustment");
    setAdjustOpen(true);
  }

  const columns: DataTableColumn<StockItem>[] = [
    {
      id: "product",
      header: "Product",
      cell: (row) => (
        <div className="min-w-[190px]">
          <p className="font-mono text-xs text-slate-500">{row.productCode ?? row.product?.code ?? "—"}</p>
          {row.productId ? (
            <RowLink to={`/products/${row.productId}`} muted>
              <span className="font-semibold text-slate-950">{row.productName ?? row.product?.name ?? "Product"}</span>
            </RowLink>
          ) : (
            <p className="mt-0.5 font-semibold text-slate-950">{row.productName ?? row.product?.name ?? "Product"}</p>
          )}
          <p className="mt-0.5 text-xs text-slate-500">
            {unitLabel(row.unitOfMeasure ?? row.product?.unitOfMeasure)}
          </p>
        </div>
      ),
    },
    {
      id: "on-hand",
      header: "On hand",
      cell: (row) => (
        <span className="font-medium tabular-nums text-slate-900">
          {formatQuantity(row.quantity ?? row.quantityOnHand ?? row.availableQuantity)}
        </span>
      ),
    },
    {
      id: "available",
      header: "Available",
      cell: (row) => (
        <span className="tabular-nums text-slate-700">
          {formatQuantity(row.availableQuantity ?? row.quantity ?? row.quantityOnHand)}
        </span>
      ),
    },
    {
      id: "reserved",
      header: "Reserved",
      cell: (row) => (
        <span className="tabular-nums text-slate-700">
          {formatQuantity(row.reservedQuantity ?? row.committedQuantity ?? "0")}
        </span>
      ),
    },
    {
      id: "location",
      header: "Location",
      cell: (row) => <span className="text-slate-700">{row.location ?? row.warehouse ?? "Unassigned"}</span>,
    },
    {
      id: "updated",
      header: "Updated",
      cell: (row) => <span className="text-xs text-slate-500">{row.updatedAt ? row.updatedAt.slice(0, 10) : "—"}</span>,
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <PageHeader
        section="Supply chain / Inventory"
        title="Stock on hand"
        description="Review live stock levels by product and location, then post controlled adjustments."
        actions={
          <>
            <Link className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm text-slate-700 hover:bg-slate-50" to="/inventory/movements">
              Movement ledger
            </Link>
            {canAdjust ? (
              <Button className="h-10 bg-brand-800 px-4 hover:bg-brand-900" onClick={openAdjustment}>Adjust stock</Button>
            ) : null}
          </>
        }
      />

      <MetricGrid>
        <MetricCard label="Products on page" value={String(rows.length)} hint="Distinct stock records loaded" />
        <MetricCard label="Units on hand" value={formatQuantity(totalOnHand)} hint="Across the current page" />
        <MetricCard label="Units available" value={formatQuantity(totalAvailable)} hint="After reservations" />
        <MetricCard label="Locations" value={String(locationCount)} hint="Distinct storage locations" />
      </MetricGrid>

      <ListFilters
        q={q}
        onSearch={(value) => {
          setFilter("q", value);
          resetPage();
        }}
        status={location}
        onStatus={(value) => {
          setFilter("location", value);
          resetPage();
        }}
        statuses={(formOptions.data?.locations ?? []).map((option) => ({ value: optionValue(option), label: optionLabel(option) }))}
        statusFilterLabel="Location"
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id ?? row.productId}
        isLoading={stock.isPending}
        error={stock.isError ? getApiErrorMessage(stock.error) : null}
        emptyMessage={filtersActive ? "No stock records match these filters." : "No stock records yet."}
        hasNextPage={stock.data?.pageInfo.hasNextPage ?? false}
        hasPreviousPage={cursors.length > 1}
        onNext={() => {
          const next = stock.data?.pageInfo.nextCursor;
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
        onRetry={() => stock.refetch()}
        onClearFilters={filtersActive ? () => { clearFilters(); resetPage(); } : undefined}
        backTo="/purchasing"
      />

      <Modal
        open={adjustOpen}
        title="Adjust stock"
        onClose={adjust.isPending ? () => undefined : () => setAdjustOpen(false)}
        footer={
          <>
            <Button variant="secondary" disabled={adjust.isPending} onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button
              disabled={adjust.isPending || !productId || !quantity || Number(quantity) === 0}
              onClick={() => {
                setFormError(null);
                if (!productId) {
                  setFormError("Choose a product.");
                  return;
                }
                if (!quantity || Number(quantity) === 0) {
                  setFormError("Enter a non-zero adjustment quantity. Use a negative value to reduce stock.");
                  return;
                }
                adjust.mutate();
              }}
            >
              {adjust.isPending ? "Posting…" : "Post adjustment"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <FormField label="Product" htmlFor="adjust-product" required>
            <select
              id="adjust-product"
              required
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Choose a product</option>
              {(formOptions.data?.products ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.code ? `${product.code} · ` : ""}{product.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Adjustment quantity" htmlFor="adjust-quantity" required>
            <Input
              id="adjust-quantity"
              required
              inputMode="decimal"
              value={quantity}
              placeholder="Positive to increase, negative to decrease"
              onChange={(event) => setQuantity(event.target.value)}
            />
          </FormField>
          <FormField label="Location" htmlFor="adjust-location">
            <Input
              id="adjust-location"
              list="inventory-locations"
              value={adjustLocation}
              onChange={(event) => setAdjustLocation(event.target.value)}
            />
            <datalist id="inventory-locations">
              {(formOptions.data?.locations ?? []).map((option) => (
                <option key={optionValue(option)} value={optionValue(option)}>{optionLabel(option)}</option>
              ))}
            </datalist>
          </FormField>
          <FormField label="Reason" htmlFor="adjust-reason">
            <Input
              id="adjust-reason"
              list="inventory-reasons"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <datalist id="inventory-reasons">
              {(formOptions.data?.reasons ?? []).map((option) => (
                <option key={optionValue(option)} value={optionValue(option)}>{optionLabel(option)}</option>
              ))}
            </datalist>
          </FormField>
          {formError ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </p>
          ) : null}
        </div>
      </Modal>
    </section>
  );
}

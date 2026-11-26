import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormField } from "@/components/forms/FormField.tsx";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  createPrice,
  deletePrice,
  deleteProduct,
  getProduct,
  type PriceType,
  type PriceWrite,
  type ProductPrice,
  type ProductStatus,
  updatePrice,
  updateProduct,
} from "./api.ts";

type PendingDelete = { kind: "product" } | { kind: "price"; id: string; label: string };

const inputClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 transition focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100";

export default function ProductDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission("products:update");
  const canDelete = useHasPermission("products:delete");
  const canReadQuotes = useHasPermission("quotes:read");
  const canReadOrders = useHasPermission("sales-orders:read");
  const canReadInvoices = useHasPermission("invoices:read");
  const [priceOpen, setPriceOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<ProductPrice | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const product = useQuery({ queryKey: ["products", id], queryFn: () => getProduct(id) });
  const priceDialogOpen = priceOpen || editingPrice !== null;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["products", id] });
    await queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  const removeProduct = useMutation({
    mutationFn: () => deleteProduct(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate("/products");
    },
  });

  const toggleStatus = useMutation({
    mutationFn: (status: ProductStatus) => updateProduct(id, { status }),
    onSuccess: refresh,
  });

  function closePriceDialog() {
    setPriceOpen(false);
    setEditingPrice(null);
    setFormError(null);
  }

  async function savePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: PriceWrite = {
      priceType: String(form.get("priceType") ?? "SALES") as PriceWrite["priceType"],
      priceListCode: String(form.get("priceListCode") ?? "STANDARD").toUpperCase() || "STANDARD",
      currencyCode: String(form.get("currencyCode") ?? "").toUpperCase(),
      amount: String(form.get("amount") ?? ""),
      effectiveDate: String(form.get("effectiveDate") ?? ""),
      expiryDate: String(form.get("expiryDate") ?? "") || null,
      isActive: form.get("isActive") === "on",
    };
    setFormError(null);
    try {
      if (editingPrice) {
        await updatePrice(editingPrice.id, body);
      } else {
        await createPrice(id, body);
      }
      await refresh();
      closePriceDialog();
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    setConfirmBusy(true);
    try {
      if (pendingDelete.kind === "product") {
        await removeProduct.mutateAsync();
      } else {
        await deletePrice(pendingDelete.id);
        await refresh();
      }
      setPendingDelete(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      {product.isPending ? <p className="text-sm text-slate-500">Loading catalog item…</p> : null}
      {product.isError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {getApiErrorMessage(product.error)}
        </p>
      ) : null}
      {product.data ? (
        <>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/products" className="transition hover:text-brand-800">
              Products and services
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-slate-700">{product.data.code}</span>
          </nav>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-5 bg-gradient-to-br from-white via-white to-brand-50/50 p-5 md:p-7">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">Supply / Catalog</p>
                <p className="mt-2 font-mono text-xs text-slate-500">{product.data.code}</p>
                <h1 className="mt-1 break-words text-2xl font-semibold text-slate-950 md:text-3xl">{product.data.name}</h1>
                {product.data.description ? (
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">{product.data.description}</p>
                ) : null}
                {product.data.notes ? (
                  <p className="mt-2 max-w-2xl text-xs italic text-slate-500">{product.data.notes}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <StatusChip status={product.data.status} />
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 ring-1 ring-inset ring-violet-200">
                    {product.data.productType === "SERVICE" ? "Service" : "Physical product"}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {product.data.unitOfMeasure.code}
                  </span>
                  {product.data.taxCode ? (
                    <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
                      Tax {product.data.taxCode.code} · {product.data.taxCode.rate}%
                    </span>
                  ) : (
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">No tax</span>
                  )}
                  {product.data.trackInventory ? (
                    <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                      Inventory tracked
                    </span>
                  ) : (
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      Non-stock item
                    </span>
                  )}
                </div>
              </div>
              <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto">
                {canUpdate ? (
                  <Link
                    to={`/products/${id}/edit`}
                    className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:flex-none"
                  >
                    Edit item
                  </Link>
                ) : null}
                {canUpdate ? (
                  <Button
                    variant="secondary"
                    className="h-10 flex-1 sm:flex-none"
                    disabled={toggleStatus.isPending}
                    onClick={() => {
                      const next: ProductStatus = product.data?.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                      toggleStatus.mutate(next);
                    }}
                  >
                    {product.data.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    variant="secondary"
                    className="h-10 flex-1 text-red-700 hover:bg-red-50 sm:flex-none"
                    onClick={() => setPendingDelete({ kind: "product" })}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <DetailMetric
              label="Standard sales price"
              value={currentStandardPrice(product.data.prices, "SALES") ? formatProductPrice(currentStandardPrice(product.data.prices, "SALES")!) : "Not set"}
              hint="Used in sales documents"
            />
            <DetailMetric
              label="Standard purchase price"
              value={currentStandardPrice(product.data.prices, "PURCHASE") ? formatProductPrice(currentStandardPrice(product.data.prices, "PURCHASE")!) : "Not set"}
              hint="Procurement costing"
            />
            <DetailMetric label="Price versions" value={product.data.prices.length.toString()} hint="Including future and expired" />
            <DetailMetric label="Category" value={product.data.category?.name ?? "Uncategorised"} hint="Catalog taxonomy" />
            <DetailMetric label="Lifecycle" value={product.data.status === "ACTIVE" ? "Active" : "Inactive"} hint="Form availability" />
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Price book</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Dated prices with overlap protection and audit history.</p>
                </div>
                {canUpdate ? (
                  <Button
                    className="h-9"
                    onClick={() => {
                      setEditingPrice(null);
                      setPriceOpen(true);
                    }}
                  >
                    Add price
                  </Button>
                ) : null}
              </div>
              {product.data.prices.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">No prices yet. Add a standard sales price to use this item in sales documents.</p>
              ) : null}
              <ul className="flex flex-col gap-2 p-3 sm:p-4">
                {product.data.prices.map((price) => (
                  <li
                    key={price.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 transition hover:border-brand-200 hover:bg-brand-50/30"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold tabular-nums text-slate-950">{formatProductPrice(price)}</p>
                        <PricePhaseChip price={price} />
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {price.priceType} · {price.priceListCode} · {String(price.effectiveDate).slice(0, 10)} →{" "}
                        {price.expiryDate ? String(price.expiryDate).slice(0, 10) : "open"}
                      </p>
                    </div>
                    {canUpdate ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-50"
                          onClick={() => {
                            setPriceOpen(false);
                            setEditingPrice(price);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
                          onClick={() =>
                            setPendingDelete({
                              kind: "price",
                              id: price.id,
                              label: `${price.priceType} · ${price.amount} ${price.currencyCode}`,
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            <aside className="flex h-fit flex-col gap-5">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Catalog structure</h2>
                <dl className="mt-3 flex flex-col gap-3 text-sm">
                  <Field label="Category" value={product.data.category?.name ?? "None"} />
                  <Field label="Unit of measure" value={`${product.data.unitOfMeasure.code} · ${product.data.unitOfMeasure.name}`} />
                  <Field label="Tax" value={product.data.taxCode ? `${product.data.taxCode.code} · ${product.data.taxCode.rate}%` : "None"} />
                  <Field label="Inventory" value={product.data.trackInventory ? "Tracked" : "Non-stock"} />
                  <Field label="Valuation" value={product.data.valuationMethod === "FIFO" ? "First in, first out" : "Weighted average price"} />
                  <Field label="Weighted average price" value={formatDecimal(product.data.weightedAveragePrice)} />
                  <Field label="Negative stock" value={product.data.allowNegativeStock ? "Authorized" : "Not authorized"} />
                  <Field label="Minimum stock" value={formatDecimal(product.data.minimumStockQuantity)} />
                  <Field label="Receiving location" value={product.data.receivingLocation} />
                  <Field label="Picking/Delivery" value={product.data.deliveryLocation} />
                  <Field label="Inventory account" value={product.data.inventoryAccount ?? "—"} />
                  <Field label="Transit account" value={product.data.inventoryTransitAccount ?? "—"} />
                  <Field label="COGS account" value={product.data.cogsAccount} />
                  <Field label="Income account" value={product.data.incomeAccount} />
                  <Field label="Dimensions" value={`${formatDecimal(product.data.netWeight)} kg · ${formatDecimal(product.data.width)} × ${formatDecimal(product.data.length)} × ${formatDecimal(product.data.height)} ${product.data.dimensionUnit.toLowerCase()}`} />
                  <Field label="Private note" value={product.data.privateNote ?? "—"} />
                </dl>
              </section>

              <section className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">Connected workflows</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-700">
                  Active items with a current standard price can be selected in sales documents. Tax and UOM defaults travel
                  with the item.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                  {canReadQuotes ? (
                    <Link className="rounded-md bg-white px-2 py-1 text-brand-800 ring-1 ring-brand-200" to="/quotes">
                      Quotes
                    </Link>
                  ) : null}
                  {canReadOrders ? (
                    <Link className="rounded-md bg-white px-2 py-1 text-brand-800 ring-1 ring-brand-200" to="/sales-orders">
                      Sales orders
                    </Link>
                  ) : null}
                  {canReadInvoices ? (
                    <Link className="rounded-md bg-white px-2 py-1 text-brand-800 ring-1 ring-brand-200" to="/invoices">
                      Invoices
                    </Link>
                  ) : null}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
                <p className="font-semibold text-slate-900">Change history</p>
                <p className="mt-1">
                  Catalog edits, price changes, status changes, and deletion are recorded in the activity log for audit.
                </p>
              </section>
            </aside>
          </div>

          <ConfirmDialog
            open={pendingDelete !== null}
            title={pendingDelete?.kind === "product" ? "Delete catalog item?" : "Remove price?"}
            description={
              pendingDelete?.kind === "product" ? (
                <p>
                  Soft-delete <span className="font-medium text-slate-900">{product.data.name}</span>? You can restore it later
                  with the right permission.
                </p>
              ) : (
                <p>
                  Remove <span className="font-medium text-slate-900">{pendingDelete?.label}</span>? Historical pricing stays
                  soft-deleted.
                </p>
              )
            }
            confirmLabel={pendingDelete?.kind === "product" ? "Delete item" : "Remove"}
            busy={confirmBusy || removeProduct.isPending || toggleStatus.isPending}
            onCancel={() => setPendingDelete(null)}
            onConfirm={() => {
              void confirmDelete();
            }}
          />

          <Modal
            open={priceDialogOpen}
            title={editingPrice ? "Edit price" : "Add price"}
            onClose={closePriceDialog}
          >
            <form key={editingPrice?.id ?? "new"} className="flex flex-col gap-3" onSubmit={savePrice}>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Type" htmlFor="priceType">
                  <select id="priceType" name="priceType" className={inputClass} defaultValue={editingPrice?.priceType ?? "SALES"}>
                    <option value="SALES">Sales</option>
                    <option value="PURCHASE">Purchase</option>
                  </select>
                </FormField>
                <FormField label="Price list" htmlFor="priceListCode">
                  <Input
                    id="priceListCode"
                    name="priceListCode"
                    className={inputClass}
                    maxLength={32}
                    defaultValue={editingPrice?.priceListCode ?? "STANDARD"}
                  />
                </FormField>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Amount" htmlFor="amount">
                  <Input id="amount" name="amount" required placeholder="1500.0000" defaultValue={editingPrice?.amount ?? ""} />
                </FormField>
                <FormField label="Currency" htmlFor="currencyCode">
                  <Input
                    id="currencyCode"
                    name="currencyCode"
                    required
                    maxLength={3}
                    defaultValue={editingPrice?.currencyCode ?? "PKR"}
                  />
                </FormField>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Effective date" htmlFor="effectiveDate">
                  <Input
                    id="effectiveDate"
                    name="effectiveDate"
                    type="date"
                    required
                    defaultValue={editingPrice ? String(editingPrice.effectiveDate).slice(0, 10) : new Date().toISOString().slice(0, 10)}
                  />
                </FormField>
                <FormField label="Expiry date" htmlFor="expiryDate">
                  <Input
                    id="expiryDate"
                    name="expiryDate"
                    type="date"
                    defaultValue={editingPrice?.expiryDate ? String(editingPrice.expiryDate).slice(0, 10) : ""}
                  />
                </FormField>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="isActive" defaultChecked={editingPrice?.isActive ?? true} />
                Active price
              </label>
              {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
              <div className="flex gap-2">
                <Button type="submit">{editingPrice ? "Save price" : "Add price"}</Button>
                <Button type="button" variant="secondary" onClick={closePriceDialog}>
                  Cancel
                </Button>
              </div>
            </form>
          </Modal>
        </>
      ) : null}
    </section>
  );
}

function StatusChip({ status }: { status: ProductStatus }) {
  const active = status === "ACTIVE";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        active ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function PricePhaseChip({ price }: { price: ProductPrice }) {
  const phase = pricePhase(price);
  const tones: Record<ReturnType<typeof pricePhase>, string> = {
    Current: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    Upcoming: "bg-sky-50 text-sky-800 ring-sky-200",
    Expired: "bg-amber-50 text-amber-800 ring-amber-200",
    Inactive: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tones[phase]}`}>
      {phase}
    </span>
  );
}

function DetailMetric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-slate-950" title={value}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function pricePhase(price: ProductPrice): "Current" | "Upcoming" | "Expired" | "Inactive" {
  if (!price.isActive) {
    return "Inactive";
  }
  const today = new Date().toISOString().slice(0, 10);
  const effective = String(price.effectiveDate).slice(0, 10);
  const expiry = price.expiryDate ? String(price.expiryDate).slice(0, 10) : null;
  if (expiry && expiry < today) {
    return "Expired";
  }
  if (effective > today) {
    return "Upcoming";
  }
  return "Current";
}

function currentStandardPrice(prices: ProductPrice[], priceType: PriceType): ProductPrice | undefined {
  return prices.find(
    (price) => price.priceType === priceType && price.priceListCode === "STANDARD" && pricePhase(price) === "Current",
  );
}

function formatDecimal(value: string | number | null | undefined): string {
  return Number(value ?? 0).toFixed(2);
}

function formatProductPrice(price: ProductPrice): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: price.currencyCode,
      maximumFractionDigits: 2,
    }).format(Number(price.amount));
  } catch {
    return `${price.amount} ${price.currencyCode}`;
  }
}

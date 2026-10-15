import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormField } from "@/components/forms/FormField.tsx";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  createPrice,
  deletePrice,
  deleteProduct,
  getProduct,
  listProductAudit,
  type PriceWrite,
} from "./api.ts";

type PendingDelete = { kind: "product" } | { kind: "price"; id: string; label: string };

export default function ProductDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [priceOpen, setPriceOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const product = useQuery({ queryKey: ["products", id], queryFn: () => getProduct(id) });
  const audit = useQuery({ queryKey: ["products", id, "audit"], queryFn: () => listProductAudit(id) });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["products", id] });
  };

  const removeProduct = useMutation({
    mutationFn: () => deleteProduct(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products", "list"] });
      navigate("/products");
    },
  });

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
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {product.isPending ? <p className="text-sm text-slate-500">Loading product…</p> : null}
      {product.isError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {getApiErrorMessage(product.error)}
        </p>
      ) : null}
      {product.data ? (
        <>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/products" className="hover:text-slate-900">
              Products
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-slate-700">{product.data.code}</span>
          </nav>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-5 p-5 md:p-7">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Supply / Catalog</p>
                <p className="mt-2 font-mono text-xs text-slate-500">{product.data.code}</p>
                <h1 className="mt-1 break-words text-2xl font-semibold text-slate-950 md:text-3xl">{product.data.name}</h1>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                    {product.data.status === "ACTIVE" ? "Active" : "Inactive"}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {product.data.productType === "SERVICE" ? "Service" : "Physical product"}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {product.data.unitOfMeasure.code}
                  </span>
                  {product.data.taxCode ? (
                    <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">
                      Tax {product.data.taxCode.code}
                    </span>
                  ) : null}
                  {product.data.trackInventory ? (
                    <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">Inventory tracked</span>
                  ) : null}
                </div>
              </div>
              <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                <Link
                  to={`/products/${id}/edit`}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:flex-none"
                >
                  Edit
                </Link>
                <Button variant="secondary" className="h-10 flex-1 text-red-700 hover:bg-red-50 sm:flex-none" onClick={() => setPendingDelete({ kind: "product" })}>
                  Delete
                </Button>
              </div>
            </div>
            {product.data.description || product.data.notes ? (
              <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-700 md:px-7">
                {[product.data.description, product.data.notes].filter(Boolean).join(" · ")}
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Prices</h2>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
                  {product.data.prices.length}
                </span>
              </div>
              <Button variant="secondary" className="h-9" onClick={() => setPriceOpen(true)}>
                Add price
              </Button>
            </div>
            {product.data.prices.length === 0 ? <p className="text-sm text-slate-500">No prices yet.</p> : null}
            <ul className="flex flex-col gap-2">
              {product.data.prices.map((price) => (
                <li
                  key={price.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm transition hover:border-teal-200 hover:bg-teal-50/30"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {price.priceType} · {price.amount} {price.currencyCode} · {price.priceListCode}
                    </p>
                    <p className="text-slate-600">
                      {String(price.effectiveDate).slice(0, 10)}
                      {price.expiryDate ? ` → ${String(price.expiryDate).slice(0, 10)}` : " → open"}
                      {price.isActive ? "" : " · inactive"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded px-2 py-1 text-red-700 transition hover:bg-red-50"
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
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-slate-900">Recent audit</h2>
            {audit.isPending ? <p className="mt-3 text-sm text-slate-500">Loading audit…</p> : null}
            {(audit.data?.items ?? []).length === 0 && !audit.isPending ? (
              <p className="mt-3 text-sm text-slate-500">No audit events yet.</p>
            ) : null}
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-slate-700">
              {(audit.data?.items ?? []).map((event) => (
                <li key={event.id} className="rounded-md px-2 py-1.5 transition hover:bg-slate-50">
                  {event.action} · {new Date(event.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>

          <ConfirmDialog
            open={pendingDelete !== null}
            title={pendingDelete?.kind === "product" ? "Delete product?" : "Remove price?"}
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
            confirmLabel={pendingDelete?.kind === "product" ? "Delete product" : "Remove"}
            busy={confirmBusy || removeProduct.isPending}
            onCancel={() => setPendingDelete(null)}
            onConfirm={() => {
              void confirmDelete();
            }}
          />

          <Modal open={priceOpen} title="Add price" onClose={() => setPriceOpen(false)}>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const body: PriceWrite = {
                  priceType: String(form.get("priceType") ?? "SALES") as PriceWrite["priceType"],
                  currencyCode: String(form.get("currencyCode") ?? "").toUpperCase(),
                  amount: String(form.get("amount") ?? ""),
                  effectiveDate: String(form.get("effectiveDate") ?? ""),
                  expiryDate: String(form.get("expiryDate") ?? "") || undefined,
                };
                setFormError(null);
                try {
                  await createPrice(id, body);
                  await refresh();
                  setPriceOpen(false);
                } catch (error) {
                  setFormError(getApiErrorMessage(error));
                }
              }}
            >
              <FormField label="Type" htmlFor="priceType">
                <select id="priceType" name="priceType" className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm" defaultValue="SALES">
                  <option value="SALES">Sales</option>
                  <option value="PURCHASE">Purchase</option>
                </select>
              </FormField>
              <FormField label="Amount" htmlFor="amount">
                <Input id="amount" name="amount" required placeholder="1500.0000" />
              </FormField>
              <FormField label="Currency" htmlFor="currencyCode">
                <Input id="currencyCode" name="currencyCode" required maxLength={3} defaultValue="PKR" />
              </FormField>
              <FormField label="Effective date" htmlFor="effectiveDate">
                <Input id="effectiveDate" name="effectiveDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </FormField>
              <FormField label="Expiry date" htmlFor="expiryDate">
                <Input id="expiryDate" name="expiryDate" type="date" />
              </FormField>
              {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
              <Button type="submit">Save price</Button>
            </form>
          </Modal>
        </>
      ) : null}
    </section>
  );
}

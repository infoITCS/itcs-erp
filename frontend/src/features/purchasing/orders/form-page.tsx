import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { purchasingKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  PURCHASING_PERMISSIONS,
  createPurchaseOrder,
  getPurchaseOrder,
  getPurchaseOrderFormOptions,
  updatePurchaseOrder,
  type PurchaseOrderWrite,
} from "../api.ts";
import { LinesEditor, PageHeader, computeDocumentTotals, emptyLine, formatMoney, type DocumentLineInput } from "../shared.tsx";

export default function PurchaseOrderFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(PURCHASING_PERMISSIONS.create);
  const canUpdate = useHasPermission(PURCHASING_PERMISSIONS.update);
  const isEdit = Boolean(id);
  const allowed = isEdit ? canUpdate : canCreate;
  const requestedVendorId = searchParams.get("vendorId") ?? "";

  const existing = useQuery({ queryKey: purchasingKeys.orders.detail(id as string), queryFn: () => getPurchaseOrder(id as string), enabled: isEdit });
  const formOptions = useQuery({ queryKey: purchasingKeys.orders.formOptions(), queryFn: getPurchaseOrderFormOptions });

  const [vendorId, setVendorId] = useState(requestedVendorId);
  const [orderDate, setOrderDate] = useState(today());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [vendorReference, setVendorReference] = useState("");
  const [currencyCode, setCurrencyCode] = useState("PKR");
  const [paymentTermId, setPaymentTermId] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [lines, setLines] = useState<DocumentLineInput[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ vendorId?: string; lines?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isEdit || !requestedVendorId || !formOptions.data) {
      return;
    }
    const vendor = formOptions.data.vendors.find((item) => item.id === requestedVendorId);
    const active = vendor?.status === "ACTIVE";
    setVendorId(active ? requestedVendorId : "");
    if (active && vendor) {
      setCurrencyCode(vendor.currencyCode || "PKR");
      setPaymentTermId(vendor.paymentTermId ?? "");
    }
  }, [formOptions.data, isEdit, requestedVendorId]);

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    const order = existing.data;
    setVendorId(order.vendorId);
    setOrderDate((order.orderDate ?? order.issueDate ?? "").slice(0, 10));
    setExpectedDeliveryDate(order.expectedDeliveryDate ? order.expectedDeliveryDate.slice(0, 10) : "");
    setVendorReference(order.vendorReference ?? "");
    setCurrencyCode(order.currencyCode);
    setPaymentTermId(order.paymentTermId ?? "");
    setNotes(order.notes ?? "");
    setTerms(order.terms ?? "");
    setLines(
      (order.lines ?? []).map((line) => ({
        productId: line.productId ?? undefined,
        productCode: line.productCode ?? undefined,
        productName: line.productName,
        description: line.description ?? undefined,
        unitOfMeasure: line.unitOfMeasure ?? undefined,
        quantity: Number(line.quantity).toFixed(4),
        unitPrice: Number(line.unitPrice).toFixed(4),
        discountPercent: Number(line.discountPercent ?? 0).toFixed(4),
        taxCodeId: line.taxCodeId ?? undefined,
        taxRate: Number(line.taxRate ?? 0).toFixed(4),
      })),
    );
  }, [existing.data]);

  const selectedVendor = formOptions.data?.vendors.find((item) => item.id === vendorId);
  const totals = computeDocumentTotals(lines);

  function selectVendor(value: string) {
    setVendorId(value);
    setFieldErrors((current) => ({ ...current, vendorId: undefined }));
    const vendor = formOptions.data?.vendors.find((item) => item.id === value);
    if (vendor) {
      setCurrencyCode(vendor.currencyCode || "PKR");
      setPaymentTermId(vendor.paymentTermId ?? "");
    }
  }

  async function refreshAfterSave() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: purchasingKeys.orders.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.orders.all() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
    ]);
  }

  async function submit() {
    setError(null);
    setFieldErrors({});
    if (!vendorId) {
      setFieldErrors({ vendorId: "Choose a vendor." });
      return;
    }
    if (formOptions.data && !formOptions.data.vendors.some((vendor) => vendor.id === vendorId && vendor.status === "ACTIVE")) {
      setFieldErrors({ vendorId: "Choose an active vendor." });
      return;
    }
    const invalid = lines.findIndex((line) => !line.productId);
    if (invalid >= 0) {
      setFieldErrors({ lines: `Line ${invalid + 1}: choose a product.` });
      return;
    }
    const linePayload = lines.map((line) => ({
      productId: line.productId,
      productCode: line.productCode,
      productName: line.productName,
      description: line.description,
      unitOfMeasure: line.unitOfMeasure,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent || "0",
      taxCodeId: line.taxCodeId,
      taxRate: line.taxRate || "0",
    }));
    const body: PurchaseOrderWrite = {
      vendorId,
      orderDate: orderDate || undefined,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      vendorReference: vendorReference || undefined,
      currencyCode,
      paymentTermId: paymentTermId || undefined,
      notes: notes || undefined,
      terms: terms || undefined,
      lines: linePayload,
    };
    setBusy(true);
    try {
      if (id) {
        const updateBody: Partial<PurchaseOrderWrite> = {
          ...body,
          expectedDeliveryDate: expectedDeliveryDate || null,
          vendorReference: vendorReference || null,
          paymentTermId: paymentTermId || null,
          notes: notes || null,
          terms: terms || null,
        };
        await updatePurchaseOrder(id, updateBody);
        await refreshAfterSave();
        navigate(`/purchasing/orders/${id}`);
        return;
      }
      const created = await createPurchaseOrder(body);
      await refreshAfterSave();
      navigate(`/purchasing/orders/${created.id}`);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return <p className="text-sm text-red-700">You do not have permission to {isEdit ? "edit" : "create"} purchase orders.</p>;
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <PageHeader
        section="Supply / Purchasing / Orders"
        title={isEdit ? "Edit purchase order" : "New purchase order"}
        description="Orders start as drafts. Approve and send them from the detail page before receiving goods."
      />

      {existing.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(existing.error)}</p> : null}
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <fieldset className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <legend className="mb-1 text-sm font-semibold text-slate-900">Order details</legend>
          <FormField label="Vendor" htmlFor="vendorId" error={fieldErrors.vendorId} required>
            <select
              id="vendorId"
              required
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-50"
              value={vendorId}
              disabled={isEdit}
              onChange={(event) => selectVendor(event.target.value)}
            >
              <option value="">Choose a vendor</option>
              {(formOptions.data?.vendors ?? []).filter((vendor) => vendor.status === "ACTIVE").map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.code ? `${vendor.code} A� ` : ""}
                  {vendor.displayName ?? vendor.name}
                </option>
              ))}
              {selectedVendor && selectedVendor.status !== "ACTIVE" ? (
                <option value={selectedVendor.id}>
                  {selectedVendor.code ? `${selectedVendor.code} A� ` : ""}
                  {selectedVendor.displayName ?? selectedVendor.name}
                </option>
              ) : null}
            </select>
          </FormField>
          <FormField label="Currency" htmlFor="currencyCode" required>
            <select
              id="currencyCode"
              required
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={currencyCode}
              onChange={(event) => setCurrencyCode(event.target.value)}
            >
              <option value="">Choose a currency</option>
              {(formOptions.data?.currencies ?? []).map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code}
                  {currency.name ? ` · ${currency.name}` : ""}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Payment term" htmlFor="paymentTermId">
            <select
              id="paymentTermId"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={paymentTermId}
              onChange={(event) => setPaymentTermId(event.target.value)}
            >
              <option value="">None</option>
              {(formOptions.data?.paymentTerms ?? []).map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name} ({term.dueDays} days)
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Issue date" htmlFor="orderDate">
            <Input id="orderDate" type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
          </FormField>
          <FormField label="Expected delivery" htmlFor="expectedDeliveryDate">
            <Input
              id="expectedDeliveryDate"
              type="date"
              value={expectedDeliveryDate}
              onChange={(event) => setExpectedDeliveryDate(event.target.value)}
            />
          </FormField>
          <FormField label="Vendor reference" htmlFor="vendorReference">
            <Input id="vendorReference" value={vendorReference} placeholder="Vendor quotation or reference" onChange={(event) => setVendorReference(event.target.value)} />
          </FormField>
        </fieldset>

        <div className="border-t border-slate-100 pt-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Order lines</h2>
          <LinesEditor
            lines={lines}
            onChange={(updated) => {
              setLines(updated);
              setFieldErrors((current) => ({ ...current, lines: undefined }));
            }}
            products={formOptions.data?.products ?? []}
            taxCodes={formOptions.data?.taxCodes ?? []}
            currency={currencyCode}
            disabled={busy}
            invalidLines={lines.flatMap((line, index) => (!line.productId ? [index] : []))}
          />
          {fieldErrors.lines ? (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {fieldErrors.lines}
            </p>
          ) : null}
          <dl className="ml-auto mt-4 grid max-w-xs grid-cols-2 gap-y-1 text-sm">
            <dt className="text-slate-500">Subtotal</dt>
            <dd className="text-right tabular-nums text-slate-800">{formatMoney(totals.subtotal, currencyCode)}</dd>
            <dt className="text-slate-500">Discount</dt>
            <dd className="text-right tabular-nums text-slate-800">{formatMoney(totals.discountTotal, currencyCode)}</dd>
            <dt className="text-slate-500">Tax</dt>
            <dd className="text-right tabular-nums text-slate-800">{formatMoney(totals.taxTotal, currencyCode)}</dd>
            <dt className="border-t border-slate-200 pt-1 font-semibold text-slate-900">Total</dt>
            <dd className="border-t border-slate-200 pt-1 text-right font-semibold tabular-nums text-slate-950">
              {formatMoney(totals.total, currencyCode)}
            </dd>
          </dl>
        </div>

        <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <FormField label="Notes" htmlFor="notes">
            <textarea
              id="notes"
              className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>
          <FormField label="Terms" htmlFor="terms">
            <textarea
              id="terms"
              className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={terms}
              onChange={(event) => setTerms(event.target.value)}
            />
          </FormField>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Link className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm text-slate-700" to={id ? `/purchasing/orders/${id}` : "/purchasing/orders"}>
            Cancel
          </Link>
          <Button className="h-9 bg-brand-800 hover:bg-brand-900" disabled={busy || existing.isLoading} onClick={submit}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create order"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

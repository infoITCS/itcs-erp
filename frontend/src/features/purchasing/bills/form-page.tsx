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
  createVendorBill,
  getBillFormOptions,
  getPurchaseOrder,
  getVendorBill,
  updateVendorBill,
  type VendorBillCreate,
  type VendorBillWrite,
} from "../api.ts";
import { LinesEditor, PageHeader, computeDocumentTotals, emptyLine, formatMoney, type DocumentLineInput } from "../shared.tsx";

export default function VendorBillFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(PURCHASING_PERMISSIONS.create);
  const canUpdate = useHasPermission(PURCHASING_PERMISSIONS.update);
  const isEdit = Boolean(id);
  const allowed = isEdit ? canUpdate : canCreate;
  const requestedOrderId = searchParams.get("purchaseOrderId") ?? "";
  const requestedVendorId = searchParams.get("vendorId") ?? "";

  const existing = useQuery({ queryKey: purchasingKeys.bills.detail(id as string), queryFn: () => getVendorBill(id as string), enabled: isEdit });
  const formOptions = useQuery({ queryKey: purchasingKeys.bills.formOptions(), queryFn: getBillFormOptions });
  const selectedOrder = useQuery({
    queryKey: purchasingKeys.orders.detail(requestedOrderId),
    queryFn: () => getPurchaseOrder(requestedOrderId),
    enabled: !isEdit && Boolean(requestedOrderId),
  });

  const [purchaseOrderId, setPurchaseOrderId] = useState(requestedOrderId);
  const [vendorId, setVendorId] = useState(requestedVendorId);
  const [billDate, setBillDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [vendorReference, setVendorReference] = useState("");
  const [currencyCode, setCurrencyCode] = useState("PKR");
  const [paymentTermId, setPaymentTermId] = useState("");
  const [expenseAccount, setExpenseAccount] = useState("");
  const [liabilityAccount, setLiabilityAccount] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DocumentLineInput[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ vendorId?: string; lines?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isEdit || !existing.data) {
      return;
    }
    const bill = existing.data;
    setPurchaseOrderId(bill.purchaseOrderId ?? "");
    setVendorId(bill.vendorId);
    setBillDate(bill.billDate.slice(0, 10));
    setDueDate(bill.dueDate ? bill.dueDate.slice(0, 10) : "");
    setVendorReference(bill.vendorReference ?? "");
    setCurrencyCode(bill.currencyCode);
    setPaymentTermId(bill.paymentTermId ?? "");
    setExpenseAccount(bill.expenseAccount ?? "");
    setLiabilityAccount(bill.liabilityAccount ?? "");
    setNotes(bill.notes ?? "");
    setLines(
      (bill.lines ?? []).map((line) => ({
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
  }, [existing.data, isEdit]);

  useEffect(() => {
    if (isEdit || !selectedOrder.data) {
      return;
    }
    const order = selectedOrder.data;
    setVendorId(order.vendorId);
    setCurrencyCode(order.currencyCode || "PKR");
    setPurchaseOrderId(order.id);
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
  }, [isEdit, selectedOrder.data]);

  useEffect(() => {
    if (isEdit || purchaseOrderId || !requestedVendorId) {
      return;
    }
    const vendor = formOptions.data?.vendors.find((item) => item.id === requestedVendorId);
    if (vendor?.status === "ACTIVE") {
      setVendorId(vendor.id);
      setCurrencyCode(vendor.currencyCode || "PKR");
      setPaymentTermId(vendor.paymentTermId ?? "");
    }
  }, [formOptions.data, isEdit, purchaseOrderId, requestedVendorId]);

  const totals = computeDocumentTotals(lines);

  async function selectOrder(value: string) {
    setPurchaseOrderId(value);
    setFieldErrors({});
    if (!value) {
      return;
    }
    const option = formOptions.data?.purchaseOrders.find((item) => item.id === value);
    if (option) {
      setVendorId(option.vendorId);
      setCurrencyCode(option.currencyCode || "PKR");
    }
    try {
      const order = await queryClient.fetchQuery({
        queryKey: purchasingKeys.orders.detail(value),
        queryFn: () => getPurchaseOrder(value),
      });
      setVendorId(order.vendorId);
      setCurrencyCode(order.currencyCode || "PKR");
      setPaymentTermId(order.paymentTermId ?? "");
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
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    }
  }

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
      queryClient.invalidateQueries({ queryKey: purchasingKeys.bills.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.bills.all() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.payments.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.payments.all() }),
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
    const shouldOmitLines = !isEdit && Boolean(purchaseOrderId);
    const mappedLines = lines.map((line) => ({
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
      expenseAccount: expenseAccount || undefined,
    }));
  const body: VendorBillWrite = {
      vendorId,
      billDate,
      dueDate: dueDate || undefined,
      vendorReference: vendorReference || undefined,
      currencyCode,
      paymentTermId: paymentTermId || undefined,
      expenseAccount: expenseAccount || undefined,
      liabilityAccount: liabilityAccount || undefined,
      notes: notes || undefined,
      lines: shouldOmitLines ? [] : mappedLines,
    };
    setBusy(true);
    try {
      if (id) {
        const updateBody: Partial<VendorBillWrite> = {
          ...body,
          dueDate: dueDate || null,
          vendorReference: vendorReference || null,
          paymentTermId: paymentTermId || null,
          expenseAccount: expenseAccount || null,
          liabilityAccount: liabilityAccount || null,
          notes: notes || null,
        };
        await updateVendorBill(id, updateBody);
        await refreshAfterSave();
        navigate(`/purchasing/bills/${id}`);
        return;
      }
      const createBody: VendorBillCreate = {
        ...body,
        purchaseOrderId: purchaseOrderId || undefined,
      };
      if (shouldOmitLines) {
        delete (createBody as Partial<VendorBillCreate>).lines;
      }
      const created = await createVendorBill(createBody);
      await refreshAfterSave();
      navigate(`/purchasing/bills/${created.id}`);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return <p className="text-sm text-red-700">You do not have permission to {isEdit ? "edit" : "create"} vendor bills.</p>;
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <PageHeader
        section="Supply / Purchasing / Bills"
        title={isEdit ? "Edit vendor bill" : "New vendor bill"}
        description="Link a bill to a purchase order or enter a standalone invoice, then approve it for payment."
      />

      {existing.isError || selectedOrder.isError ? (
        <p className="text-sm text-red-700">
          {getApiErrorMessage(existing.error ?? selectedOrder.error)}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <fieldset className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <legend className="mb-1 text-sm font-semibold text-slate-900">Bill details</legend>
          <FormField label="Purchase order" htmlFor="purchaseOrderId">
            <select
              id="purchaseOrderId"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-50"
              value={purchaseOrderId}
              disabled={isEdit}
              onChange={(event) => selectOrder(event.target.value)}
            >
              <option value="">Standalone bill</option>
              {(formOptions.data?.purchaseOrders ?? []).map((order) => (
                <option key={order.id} value={order.id}>
                  {order.purchaseOrderNumber ?? order.orderNumber ?? order.id.slice(0, 8)} · {order.vendor?.displayName ?? order.vendor?.name ?? "Vendor"}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Vendor" htmlFor="vendorId" error={fieldErrors.vendorId} required>
            <select
              id="vendorId"
              required
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={vendorId}
              onChange={(event) => selectVendor(event.target.value)}
            >
              <option value="">Choose a vendor</option>
              {(formOptions.data?.vendors ?? []).filter((vendor) => vendor.status === "ACTIVE").map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.displayName ?? vendor.name}
                </option>
              ))}
              {vendorId && !(formOptions.data?.vendors ?? []).some((vendor) => vendor.id === vendorId && vendor.status === "ACTIVE") ? (
                <option value={vendorId}>{(formOptions.data?.vendors ?? []).find((vendor) => vendor.id === vendorId)?.displayName ?? (formOptions.data?.vendors ?? []).find((vendor) => vendor.id === vendorId)?.name ?? existing.data?.vendor?.displayName ?? existing.data?.vendor?.name ?? vendorId}</option>
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
                <option key={currency.code} value={currency.code}>{currency.code}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Bill date" htmlFor="billDate">
            <Input id="billDate" type="date" value={billDate} onChange={(event) => setBillDate(event.target.value)} />
          </FormField>
          <FormField label="Due date" htmlFor="dueDate">
            <Input id="dueDate" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
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
                <option key={term.id} value={term.id}>{term.name} ({term.dueDays} days)</option>
              ))}
            </select>
          </FormField>
          <FormField label="Vendor reference" htmlFor="vendorReference">
            <Input id="vendorReference" value={vendorReference} placeholder="Invoice number from vendor" onChange={(event) => setVendorReference(event.target.value)} />
          </FormField>
        </fieldset>

        <fieldset className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-semibold text-slate-900">Accounting</legend>
          <FormField label="Expense account" htmlFor="expenseAccount">
            <Input
              id="expenseAccount"
              list="expense-accounts"
              value={expenseAccount}
              onChange={(event) => setExpenseAccount(event.target.value)}
            />
            <datalist id="expense-accounts">
              {(formOptions.data?.expenseAccounts ?? []).map((account) => (
                <option key={account} value={account} />
              ))}
            </datalist>
          </FormField>
          <FormField label="Liability account" htmlFor="liabilityAccount">
            <Input
              id="liabilityAccount"
              list="liability-accounts"
              value={liabilityAccount}
              onChange={(event) => setLiabilityAccount(event.target.value)}
            />
            <datalist id="liability-accounts">
              {(formOptions.data?.liabilityAccounts ?? []).map((account) => (
                <option key={account} value={account} />
              ))}
            </datalist>
          </FormField>
        </fieldset>

        <div className="border-t border-slate-100 pt-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Bill lines</h2>
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

        <FormField label="Notes" htmlFor="notes">
          <textarea
            id="notes"
            className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Link className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm text-slate-700" to={id ? `/purchasing/bills/${id}` : "/purchasing/bills"}>
            Cancel
          </Link>
          <Button className="h-9 bg-brand-800 hover:bg-brand-900" disabled={busy || existing.isLoading} onClick={submit}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create bill"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

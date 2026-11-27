import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { purchasingKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  PURCHASING_PERMISSIONS,
  createGoodsReceipt,
  getPurchaseOrder,
  listPurchaseOrders,
  type PurchaseOrder,
} from "../api.ts";
import { PageHeader, docNumber as numberLabel, formatDate, formatQuantity, numberValue, remainingQuantity, statusLabel } from "../shared.tsx";

interface ReceiptLineDraft {
  purchaseOrderLineId: string;
  productName: string;
  productCode: string;
  orderedQuantity: string;
  alreadyReceived: string;
  receivedQuantity: string;
  location: string;
}

const ELIGIBLE_STATUSES = ["APPROVED", "SENT", "PARTIALLY_RECEIVED"];

export default function GoodsReceiptFormPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(PURCHASING_PERMISSIONS.create);
  const requestedId = searchParams.get("purchaseOrderId") ?? "";

  const [purchaseOrderId, setPurchaseOrderId] = useState(requestedId);
  const [receiptDate, setReceiptDate] = useState(today());
  const [currencyCode, setCurrencyCode] = useState("PKR");
  const [vendorReference, setVendorReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ReceiptLineDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ purchaseOrderId?: string; lines?: string }>({});
  const [busy, setBusy] = useState(false);

  const availableOrders = useQuery({
    queryKey: purchasingKeys.orders.receivable(),
    queryFn: () => listPurchaseOrders({ limit: 100 }),
    enabled: canCreate,
  });
  const selectedOrder = useQuery({
    queryKey: purchasingKeys.orders.detail(purchaseOrderId),
    queryFn: () => getPurchaseOrder(purchaseOrderId),
    enabled: Boolean(purchaseOrderId),
  });

  const eligibleOrders = (availableOrders.data?.items ?? []).filter(
    (order) => ELIGIBLE_STATUSES.includes(order.status) && !order.deletedAt,
  );
  const currentOrder = availableOrders.data?.items.find((order) => order.id === purchaseOrderId) ?? selectedOrder.data;

  useEffect(() => {
    const order = selectedOrder.data;
    if (!order) {
      return;
    }
    setCurrencyCode(order.currencyCode || "PKR");
    setLines(
      (order.lines ?? []).map((line) => {
        const ordered = numberValue(line.quantity);
        const alreadyReceived = numberValue(line.receivedQuantity);
        const available = remainingQuantity(line);
        return {
          purchaseOrderLineId: line.id ?? line.purchaseOrderLineId ?? "",
          productName: line.productName ?? line.description ?? "Item",
          productCode: line.productCode ?? "",
          orderedQuantity: String(ordered),
          alreadyReceived: String(alreadyReceived),
          receivedQuantity: String(Math.max(available, 0)),
          location: line.location ?? "",
        };
      }),
    );
  }, [selectedOrder.data]);

  function selectOrder(value: string) {
    setPurchaseOrderId(value);
    setFieldErrors((current) => ({ ...current, purchaseOrderId: undefined, lines: undefined }));
    const order = availableOrders.data?.items.find((item) => item.id === value);
    if (order) {
      setCurrencyCode(order.currencyCode || "PKR");
    }
  }

  function updateLine(index: number, patch: Partial<ReceiptLineDraft>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function refreshAfterSave() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: purchasingKeys.receipts.all() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.orders.all() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
    ]);
  }

  async function submit() {
    setError(null);
    setFieldErrors({});
    if (!purchaseOrderId) {
      setFieldErrors({ purchaseOrderId: "Choose an approved or sent purchase order." });
      return;
    }
    if (lines.length === 0) {
      setFieldErrors({ lines: "This purchase order has no lines available to receive." });
      return;
    }
    const selected = lines.filter((line) => numberValue(line.receivedQuantity) > 0);
    if (selected.length === 0) {
      setFieldErrors({ lines: "Enter a received quantity greater than zero on at least one line." });
      return;
    }
    const invalid = selected.find((line) => {
      const source = (selectedOrder.data?.lines ?? []).find((item) => (item.id ?? item.purchaseOrderLineId) === line.purchaseOrderLineId);
      const remaining = source ? remainingQuantity(source) : Math.max(numberValue(line.orderedQuantity) - numberValue(line.alreadyReceived), 0);
      return numberValue(line.receivedQuantity) > remaining + 0.0001;
    });
    if (invalid) {
      setFieldErrors({ lines: `${invalid.productName}: received quantity exceeds the open quantity on the order.` });
      return;
    }
    setBusy(true);
    try {
      const created = await createGoodsReceipt({
        purchaseOrderId,
        receiptDate,
        vendorReference: vendorReference || null,
        notes: notes || null,
        lines: selected.map((line) => ({
          purchaseOrderLineId: line.purchaseOrderLineId,
          receivedQuantity: line.receivedQuantity,
          location: line.location || null,
        })),
      });
      await refreshAfterSave();
      navigate(`/purchasing/receipts/${created.id}`);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  if (!canCreate) {
    return <p className="text-sm text-red-700">You do not have permission to create goods receipts.</p>;
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader
        section="Supply / Purchasing / Receipts"
        title="New goods receipt"
        description="Select an approved order, confirm quantities received and record the storage location for each line."
      />

      {selectedOrder.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(selectedOrder.error)}</p> : null}
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <fieldset className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <legend className="mb-1 text-sm font-semibold text-slate-900">Receipt details</legend>
          <FormField label="Purchase order" htmlFor="purchaseOrderId" error={fieldErrors.purchaseOrderId} required>
            <select
              id="purchaseOrderId"
              required
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={purchaseOrderId}
              onChange={(event) => selectOrder(event.target.value)}
            >
              <option value="">Choose a purchase order</option>
              {eligibleOrders.map((order: PurchaseOrder) => (
                <option key={order.id} value={order.id}>
                  {numberLabel(order)} · {order.vendor?.displayName ?? order.vendor?.name ?? "Vendor"} · {statusLabel(order.status)}
                </option>
              ))}
              {purchaseOrderId && currentOrder && !eligibleOrders.some((order) => order.id === purchaseOrderId) ? (
                <option value={purchaseOrderId}>{numberLabel(currentOrder)}</option>
              ) : null}
            </select>
          </FormField>
          <FormField label="Receipt date" htmlFor="receiptDate">
            <Input id="receiptDate" type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} />
          </FormField>
          <FormField label="Currency (from order)" htmlFor="currencyCode">
            <Input id="currencyCode" readOnly className="bg-slate-50" value={currencyCode} />
          </FormField>
          <FormField label="Vendor reference" htmlFor="vendorReference">
            <Input id="vendorReference" value={vendorReference} placeholder="Delivery note or waybill" onChange={(event) => setVendorReference(event.target.value)} />
          </FormField>
        </fieldset>

        {currentOrder ? (
          <div className="grid gap-3 rounded-md border border-brand-100 bg-brand-50/60 p-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Order</p>
              <Link className="font-medium text-brand-800 hover:underline" to={`/purchasing/orders/${currentOrder.id}`}>
                {numberLabel(currentOrder)}
              </Link>
            </div>
            <div>
              <p className="text-xs text-slate-500">Vendor</p>
              <p className="font-medium text-slate-900">{currentOrder.vendor?.displayName ?? currentOrder.vendor?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Order date</p>
              <p className="font-medium text-slate-900">{formatDate(currentOrder.orderDate ?? currentOrder.issueDate)}</p>
            </div>
          </div>
        ) : null}

        {!purchaseOrderId ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
            Choose an approved, sent or partially received order to load its lines.
          </p>
        ) : selectedOrder.isPending ? (
          <p className="text-sm text-slate-500">Loading order lines…</p>
        ) : lines.length === 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            No lines are available to receive on this order.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Item</th>
                  <th className="w-24 px-2 py-2 text-right">Ordered</th>
                  <th className="w-28 px-2 py-2 text-right">Already received</th>
                  <th className="w-28 px-2 py-2 text-right">Receive now</th>
                  <th className="w-36 px-2 py-2">Location</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.purchaseOrderLineId || index} className="border-b border-slate-100 align-top">
                    <td className="px-2 py-2">
                      <p className="font-medium text-slate-800">{line.productName}</p>
                      <p className="font-mono text-[11px] text-slate-400">{line.productCode || "—"}</p>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-700">{formatQuantity(line.orderedQuantity)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-700">{formatQuantity(line.alreadyReceived)}</td>
                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Received quantity for ${line.productName}`}
                        className="h-9 text-right"
                        inputMode="decimal"
                        value={line.receivedQuantity}
                        onChange={(event) => {
                          updateLine(index, { receivedQuantity: event.target.value });
                          setFieldErrors((current) => ({ ...current, lines: undefined }));
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Location for ${line.productName}`}
                        value={line.location}
                        placeholder="Warehouse / bin"
                        onChange={(event) => updateLine(index, { location: event.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {fieldErrors.lines ? (
          <p role="alert" className="text-sm text-red-700">
            {fieldErrors.lines}
          </p>
        ) : null}

        <FormField label="Notes" htmlFor="notes">
          <textarea
            id="notes"
            className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Link className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm text-slate-700" to="/purchasing/receipts">
            Cancel
          </Link>
          <Button className="h-9 bg-brand-800 hover:bg-brand-900" disabled={busy || selectedOrder.isLoading} onClick={submit}>
            {busy ? "Saving…" : "Create receipt"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  createSalesOrder,
  getSalesOrder,
  getSalesOrderFormOptions,
  updateSalesOrder,
  type SalesOrderCreateWrite,
} from "./api.ts";
import {
  LinesEditor,
  computeDocumentTotals,
  emptyLine,
  formatMoney,
  type DocumentLineInput,
} from "../sales/shared.tsx";

export default function SalesOrderFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const existing = useQuery({ queryKey: ["sales-orders", id], queryFn: () => getSalesOrder(id as string), enabled: isEdit });
  const formOptions = useQuery({ queryKey: ["sales-orders", "form-options"], queryFn: getSalesOrderFormOptions });

  const [customerId, setCustomerId] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [orderDate, setOrderDate] = useState(today());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [currencyCode, setCurrencyCode] = useState("PKR");
  const [paymentTermId, setPaymentTermId] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [lines, setLines] = useState<DocumentLineInput[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    const order = existing.data;
    setCustomerId(order.customerId);
    setOwnerUserId(order.ownerUserId);
    setOrderDate(order.orderDate.slice(0, 10));
    setExpectedDeliveryDate(order.expectedDeliveryDate ? order.expectedDeliveryDate.slice(0, 10) : "");
    setCustomerReference(order.customerReference ?? "");
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
        discountPercent: Number(line.discountPercent).toFixed(4),
        taxCodeId: line.taxCodeId ?? undefined,
        taxRate: Number(line.taxRate).toFixed(4),
      })),
    );
  }, [existing.data]);

  const totals = computeDocumentTotals(lines);

  function selectCustomer(value: string) {
    setCustomerId(value);
    const customer = formOptions.data?.customers.find((item) => item.id === value);
    if (customer) {
      setCurrencyCode(customer.currencyCode);
      setPaymentTermId(customer.paymentTermId ?? "");
    }
  }

  async function submit() {
    setError(null);
    if (!customerId) {
      setError("Choose a customer.");
      return;
    }
    const invalid = lines.findIndex((line) => !line.productId && !line.productName);
    if (invalid >= 0) {
      setError(`Line ${invalid + 1}: choose a product.`);
      return;
    }
    const body: SalesOrderCreateWrite = {
      customerId,
      ownerUserId: ownerUserId || undefined,
      orderDate: orderDate || undefined,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      customerReference: customerReference || undefined,
      currencyCode: currencyCode || undefined,
      paymentTermId: paymentTermId || undefined,
      notes: notes || undefined,
      terms: terms || undefined,
      lines: lines.map((line) => ({
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
      })),
    };
    setBusy(true);
    try {
      if (id) {
        await updateSalesOrder(id, body);
        navigate(`/sales-orders/${id}`);
        return;
      }
      const created = await createSalesOrder(body);
      navigate(`/sales-orders/${created.id}`);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="border-b border-slate-200 pb-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
          <span className="h-2 w-2 rounded-full bg-teal-600" />
          Sales / Order management
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">{isEdit ? "Edit sales order" : "New sales order"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Orders are created in draft. Confirm them from the detail page to allow invoicing.
        </p>
      </div>

      {existing.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(existing.error)}</p> : null}
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <fieldset className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <legend className="mb-1 text-sm font-semibold text-slate-900">Order details</legend>
          <FormField label="Customer" htmlFor="customerId">
            <select
              id="customerId"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={customerId}
              disabled={isEdit}
              onChange={(event) => selectCustomer(event.target.value)}
            >
              <option value="">Choose a customer</option>
              {(formOptions.data?.customers ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customerNumber} · {customer.displayName}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Owner" htmlFor="ownerUserId">
            <select
              id="ownerUserId"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={ownerUserId}
              onChange={(event) => setOwnerUserId(event.target.value)}
            >
              <option value="">Me (default)</option>
              {(formOptions.data?.owners ?? []).map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.firstName} {owner.lastName}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Currency" htmlFor="currencyCode">
            <select
              id="currencyCode"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={currencyCode}
              onChange={(event) => setCurrencyCode(event.target.value)}
            >
              {(formOptions.data?.currencies ?? []).map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code}
                  {currency.name ? ` · ${currency.name}` : ""}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Order date" htmlFor="orderDate">
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
          <FormField label="Customer reference" htmlFor="customerReference">
            <Input
              id="customerReference"
              value={customerReference}
              onChange={(event) => setCustomerReference(event.target.value)}
            />
          </FormField>
        </fieldset>

        <div className="border-t border-slate-100 pt-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Lines</h2>
          <LinesEditor
            lines={lines}
            onChange={setLines}
            products={formOptions.data?.products ?? []}
            taxCodes={formOptions.data?.taxCodes ?? []}
            currency={currencyCode}
            disabled={busy}
          />
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
          <Link
            className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm text-slate-700"
            to={id ? `/sales-orders/${id}` : "/sales-orders"}
          >
            Cancel
          </Link>
          <Button type="button" className="h-9 bg-teal-800 hover:bg-teal-900" disabled={busy} onClick={submit}>
            {busy ? "Saving…" : id ? "Save changes" : "Create order"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

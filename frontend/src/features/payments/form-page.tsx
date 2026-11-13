import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  PAYMENT_METHODS,
  createPayment,
  getPayment,
  getPaymentFormOptions,
  updatePayment,
  type PaymentMethod,
} from "./api.ts";
import { formatDate, formatMoney } from "../sales/shared.tsx";

export default function PaymentFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const requestedInvoiceId = searchParams.get("invoiceId") ?? "";

  const existing = useQuery({ queryKey: ["payments", id], queryFn: () => getPayment(id as string), enabled: isEdit });
  const formOptions = useQuery({ queryKey: ["payments", "form-options"], queryFn: getPaymentFormOptions });

  const [invoiceId, setInvoiceId] = useState(requestedInvoiceId);
  const [receivedDate, setReceivedDate] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    const payment = existing.data;
    setInvoiceId(payment.invoiceId);
    setReceivedDate(payment.receivedDate.slice(0, 10));
    setMethod(payment.method);
    setAmount(Number(payment.amount).toFixed(4));
    setReference(payment.reference ?? "");
    setNotes(payment.notes ?? "");
  }, [existing.data]);

  useEffect(() => {
    if (isEdit) {
      return;
    }
    const invoice = formOptions.data?.invoices.find((item) => item.id === invoiceId);
    if (invoice) {
      setAmount((current) => current || invoice.balance);
    }
  }, [formOptions.data, invoiceId, isEdit]);

  const selectedInvoice =
    formOptions.data?.invoices.find((invoice) => invoice.id === invoiceId) ??
    (existing.data?.invoice
      ? {
          ...existing.data.invoice,
          customerId: existing.data.customerId,
          balance: (Number(existing.data.invoice.total) - Number(existing.data.invoice.amountPaid)).toFixed(4),
          customer: existing.data.customer ?? { id: "", customerNumber: "", displayName: "Customer" },
        }
      : null);

  function selectInvoice(value: string) {
    setInvoiceId(value);
    const invoice = formOptions.data?.invoices.find((item) => item.id === value);
    if (invoice) {
      setAmount(invoice.balance);
      setError(null);
    }
  }

  async function submit() {
    setError(null);
    if (!invoiceId) {
      setError("Choose an invoice.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setBusy(true);
    try {
      if (id) {
        await updatePayment(id, {
          receivedDate: receivedDate || undefined,
          method,
          amount,
          reference: reference || null,
          notes: notes || null,
        });
        navigate(`/payments/${id}`);
        return;
      }
      const created = await createPayment({
        invoiceId,
        receivedDate: receivedDate || undefined,
        method,
        amount,
        reference: reference || undefined,
        notes: notes || undefined,
      });
      navigate(`/payments/${created.id}`);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="border-b border-slate-200 pb-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          Sales / Payments
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">{isEdit ? "Edit payment" : "Record payment"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Receipts are applied to one invoice and update its paid amount and status automatically.
        </p>
      </div>

      {existing.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(existing.error)}</p> : null}
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-semibold text-slate-900">Payment details</legend>
          <FormField label="Invoice" htmlFor="invoiceId">
            <select
              id="invoiceId"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-50"
              value={invoiceId}
              disabled={isEdit}
              onChange={(event) => selectInvoice(event.target.value)}
            >
              <option value="">Choose an invoice</option>
              {(formOptions.data?.invoices ?? []).map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber} · {invoice.customer.displayName} · {formatMoney(invoice.balance, invoice.currencyCode)} due
                </option>
              ))}
              {isEdit && selectedInvoice && !(formOptions.data?.invoices ?? []).some((invoice) => invoice.id === selectedInvoice.id) ? (
                <option value={selectedInvoice.id}>{selectedInvoice.invoiceNumber}</option>
              ) : null}
            </select>
          </FormField>
          <FormField label="Method" htmlFor="method">
            <select
              id="method"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {value
                    .split("_")
                    .map((part) => part[0] + part.slice(1).toLowerCase())
                    .join(" ")}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Received date" htmlFor="receivedDate">
            <Input
              id="receivedDate"
              type="date"
              value={receivedDate}
              onChange={(event) => setReceivedDate(event.target.value)}
            />
          </FormField>
          <FormField label="Amount" htmlFor="amount">
            <Input
              id="amount"
              inputMode="decimal"
              value={amount}
              placeholder="0.0000"
              onChange={(event) => setAmount(event.target.value)}
            />
          </FormField>
          <FormField label="Reference" htmlFor="reference">
            <Input
              id="reference"
              value={reference}
              placeholder="Cheque, transaction or receipt reference"
              onChange={(event) => setReference(event.target.value)}
            />
          </FormField>
        </fieldset>

        {selectedInvoice ? (
          <div className="grid gap-3 rounded-md border border-brand-100 bg-brand-50/60 p-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Customer</p>
              <p className="mt-0.5 font-medium text-slate-900">{selectedInvoice.customer.displayName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Invoice total</p>
              <p className="mt-0.5 tabular-nums text-slate-900">
                {formatMoney(selectedInvoice.total, selectedInvoice.currencyCode)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Already paid</p>
              <p className="mt-0.5 tabular-nums text-slate-900">
                {formatMoney(selectedInvoice.amountPaid, selectedInvoice.currencyCode)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Outstanding</p>
              <p className="mt-0.5 font-semibold tabular-nums text-brand-900">
                {formatMoney(selectedInvoice.balance, selectedInvoice.currencyCode)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Due {formatDate(selectedInvoice.dueDate)}</p>
            </div>
          </div>
        ) : null}

        {!isEdit && formOptions.data && formOptions.data.invoices.length === 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No invoices are currently open for payment. Send an invoice first.
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
          <Link
            className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm text-slate-700"
            to={id ? `/payments/${id}` : "/payments"}
          >
            Cancel
          </Link>
          <Button type="button" className="h-9 bg-brand-800 hover:bg-brand-900" disabled={busy} onClick={submit}>
            {busy ? "Saving…" : id ? "Save changes" : "Record payment"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

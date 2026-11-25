import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  createInvoice,
  getInvoice,
  getInvoiceFormOptions,
  updateInvoice,
  type InvoiceCreateWrite,
} from "./api.ts";
import {
  LinesEditor,
  computeDocumentTotals,
  emptyLine,
  formatMoney,
  type DocumentLineInput,
} from "../sales/shared.tsx";
import { getProject, getProjectActivity, updateProject } from "../projects/api.ts";

export default function InvoiceFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const requestedCustomerId = searchParams.get("customerId") ?? "";
  const projectId = searchParams.get("projectId") ?? "";
  const existing = useQuery({ queryKey: ["invoices", id], queryFn: () => getInvoice(id as string), enabled: isEdit });
  const formOptions = useQuery({ queryKey: ["invoices", "form-options"], queryFn: getInvoiceFormOptions });
  const project = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId) && !isEdit,
  });
  const projectActivity = useQuery({
    queryKey: ["projects", projectId, "activity"],
    queryFn: () => getProjectActivity(projectId),
    enabled: Boolean(projectId) && !isEdit,
  });

  const [customerId, setCustomerId] = useState(requestedCustomerId);
  const [ownerUserId, setOwnerUserId] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [currencyCode, setCurrencyCode] = useState("PKR");
  const [paymentTermId, setPaymentTermId] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [lines, setLines] = useState<DocumentLineInput[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ customerId?: string; lines?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    const invoice = existing.data;
    setCustomerId(invoice.customerId);
    setOwnerUserId(invoice.ownerUserId);
    setIssueDate(invoice.issueDate.slice(0, 10));
    setDueDate(invoice.dueDate ? invoice.dueDate.slice(0, 10) : "");
    setCustomerReference(invoice.customerReference ?? "");
    setCurrencyCode(invoice.currencyCode);
    setPaymentTermId(invoice.paymentTermId ?? "");
    setNotes(invoice.notes ?? "");
    setTerms(invoice.terms ?? "");
    setLines(
      (invoice.lines ?? []).map((line) => ({
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

  useEffect(() => {
    if (isEdit || !requestedCustomerId || projectId) {
      return;
    }
    setCustomerId(requestedCustomerId);
  }, [isEdit, projectId, requestedCustomerId]);

  useEffect(() => {
    if (isEdit || projectId) {
      return;
    }
    const customer = formOptions.data?.customers.find((item) => item.id === customerId);
    if (!customer) {
      return;
    }
    setCurrencyCode(customer.currencyCode);
    setPaymentTermId(customer.paymentTermId ?? "");
  }, [customerId, formOptions.data, isEdit, projectId]);

  useEffect(() => {
    const linkedProject = project.data;
    if (isEdit || !linkedProject) {
      return;
    }
    const nextCustomerId = linkedProject.customerId ?? requestedCustomerId;
    const customer = formOptions.data?.customers.find((item) => item.id === nextCustomerId);
    setCustomerId(nextCustomerId);
    setCurrencyCode(linkedProject.currencyCode);
    setOwnerUserId(linkedProject.ownerUserId ?? "");
    setPaymentTermId(customer?.paymentTermId ?? "");
    setDueDate(linkedProject.dueDate ? linkedProject.dueDate.slice(0, 10) : "");
    setCustomerReference(`${linkedProject.projectNumber} · ${linkedProject.name}`.slice(0, 120));
    setNotes([linkedProject.description, linkedProject.notes].filter(Boolean).join("\n\n").slice(0, 4000));
    const sourceItem =
      [...(projectActivity.data?.groups.salesOrder.items ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0] ??
      [...(projectActivity.data?.groups.quote.items ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];
    const sourceAmount = Number(sourceItem?.amount ?? 0);
    if (sourceAmount > 0) {
      setLines([
        {
          productName: linkedProject.name,
          description: `${linkedProject.projectNumber} · ${linkedProject.name} · ${sourceItem?.number ?? "source document"}`.slice(0, 120),
          quantity: "1",
          unitPrice: sourceAmount.toFixed(4),
          discountPercent: "0",
          taxRate: "0",
        },
      ]);
    }
  }, [formOptions.data, isEdit, project.data, projectActivity.data, requestedCustomerId]);

  const selectedCustomer = formOptions.data?.customers.find((item) => item.id === customerId);
  const pricesIncludeTax = Boolean(selectedCustomer?.pricesIncludeTax);
  const totals = computeDocumentTotals(lines, pricesIncludeTax);

  function selectCustomer(value: string) {
    setCustomerId(value);
    setFieldErrors((current) => ({ ...current, customerId: undefined }));
    const customer = formOptions.data?.customers.find((item) => item.id === value);
    if (customer) {
      setCurrencyCode(customer.currencyCode);
      setPaymentTermId(customer.paymentTermId ?? "");
    }
  }

  async function submit() {
    setError(null);
    setFieldErrors({});
    if (!customerId) {
      setFieldErrors({ customerId: "Choose a customer." });
      return;
    }
    const invalid = lines.findIndex((line) => !line.productId && !line.productName);
    if (invalid >= 0) {
      setFieldErrors({ lines: `Line ${invalid + 1}: choose a product.` });
      return;
    }
    const body: InvoiceCreateWrite = {
      customerId,
      ownerUserId: ownerUserId || undefined,
      issueDate: issueDate || undefined,
      dueDate: dueDate || undefined,
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
        await updateInvoice(id, body);
        navigate(`/invoices/${id}`);
        return;
      }
      const created = await createInvoice(body);
      if (projectId) {
        await updateProject(projectId, { invoiceId: created.id }).catch(() => undefined);
      }
      navigate(`/invoices/${created.id}`);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="border-b border-slate-200 pb-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          Sales / Receivables
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">{isEdit ? "Edit invoice" : "New invoice"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Invoices are created in draft. Send them from the detail page when they are ready.
        </p>
      </div>

      {projectId && !isEdit ? (
        <p className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Project context:{" "}
          {project.data ? `${project.data.projectNumber} · ${project.data.name}` : "Loading linked project…"}
        </p>
      ) : null}

      {formOptions.isLoading || project.isLoading ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Loading customers, products, taxes, and project details…
        </p>
      ) : null}

      {formOptions.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span>Could not load form data: {getApiErrorMessage(formOptions.error)}</span>
          <button
            type="button"
            className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold hover:bg-red-100"
            onClick={() => void formOptions.refetch()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {project.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span>Could not load project details: {getApiErrorMessage(project.error)}</span>
          <button
            type="button"
            className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold hover:bg-red-100"
            onClick={() => void project.refetch()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {existing.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(existing.error)}</p> : null}
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <fieldset className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <legend className="mb-1 text-sm font-semibold text-slate-900">Invoice details</legend>
          <FormField label="Customer" htmlFor="customerId" error={fieldErrors.customerId} required>
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
          <FormField label="Issue date" htmlFor="issueDate">
            <Input id="issueDate" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
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
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            Lines
            {pricesIncludeTax ? <span className="ml-2 text-xs font-medium text-amber-700">Tax-inclusive prices — VAT is extracted, not added</span> : null}
          </h2>
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
            invalidLines={lines.flatMap((line, index) => (!line.productId && !line.productName ? [index] : []))}
            pricesIncludeTax={pricesIncludeTax}
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
          <Link
            className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm text-slate-700"
            to={id ? `/invoices/${id}` : "/invoices"}
          >
            Cancel
          </Link>
          <Button
            type="button"
            className="h-9 bg-brand-800 hover:bg-brand-900"
            disabled={busy || formOptions.isLoading || project.isLoading || formOptions.isError || project.isError}
            onClick={submit}
          >
            {busy ? "Saving…" : id ? "Save changes" : "Create invoice"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

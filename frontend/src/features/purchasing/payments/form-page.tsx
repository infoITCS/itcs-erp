import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  PURCHASING_PERMISSIONS,
  VENDOR_PAYMENT_METHODS,
  createVendorPayment,
  getVendorPayment,
  getVendorPaymentFormOptions,
  updateVendorPayment,
  type VendorPaymentMethod,
  type VendorPaymentWrite,
} from "../api.ts";
import { PageHeader, formatMoney, numberValue, statusLabel } from "../shared.tsx";

interface AllocationDraft {
  billId: string;
  amount: string;
  label: string;
  balance: string;
  currencyCode: string;
}

export default function VendorPaymentFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const canCreate = useHasPermission(PURCHASING_PERMISSIONS.create);
  const canUpdate = useHasPermission(PURCHASING_PERMISSIONS.update);
  const isEdit = Boolean(id);
  const allowed = isEdit ? canUpdate : canCreate;
  const requestedVendorId = searchParams.get("vendorId") ?? "";
  const requestedBillId = searchParams.get("billId") ?? "";

  const existing = useQuery({ queryKey: ["purchasing", "payments", id], queryFn: () => getVendorPayment(id as string), enabled: isEdit });
  const formOptions = useQuery({ queryKey: ["purchasing", "payments", "form-options"], queryFn: getVendorPaymentFormOptions });

  const [vendorId, setVendorId] = useState(requestedVendorId);
  const [paidDate, setPaidDate] = useState(today());
  const [method, setMethod] = useState<VendorPaymentMethod>("BANK_TRANSFER");
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("PKR");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [allocations, setAllocations] = useState<AllocationDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ vendorId?: string; amount?: string; allocations?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    const payment = existing.data;
    setVendorId(payment.vendorId);
    setPaidDate(payment.paidDate.slice(0, 10));
    setMethod(payment.method);
    setAmount(Number(payment.amount).toFixed(4));
    setCurrencyCode(payment.currencyCode);
    setReference(payment.reference ?? "");
    setNotes(payment.notes ?? "");
    setBankAccount(payment.bankAccount ?? "");
    setAllocations(
      (payment.allocations ?? []).map((line) => {
        const bill = formOptions.data?.bills.find((item) => item.id === line.billId) ?? line.bill;
        return {
          billId: line.billId,
          amount: Number(line.amount).toFixed(4),
          label: bill?.billNumber ?? bill?.id ?? line.billId,
          balance: bill?.balance ?? "0",
          currencyCode: bill?.currencyCode ?? payment.currencyCode,
        };
      }),
    );
  }, [existing.data, formOptions.data]);

  useEffect(() => {
    if (isEdit || requestedVendorId || !requestedBillId) {
      return;
    }
    const bill = formOptions.data?.bills.find((item) => item.id === requestedBillId);
    if (bill) {
      setVendorId(bill.vendorId);
      setCurrencyCode(bill.currencyCode);
      setAmount(bill.balance ?? "0");
      setAllocations([
        {
          billId: bill.id,
          amount: bill.balance ?? "0",
          label: bill.billNumber ?? bill.id,
          balance: bill.balance ?? "0",
          currencyCode: bill.currencyCode,
        },
      ]);
    }
  }, [formOptions.data, isEdit, requestedBillId, requestedVendorId]);

  useEffect(() => {
    if (isEdit || requestedBillId || !requestedVendorId) {
      return;
    }
    const vendor = formOptions.data?.vendors.find((item) => item.id === requestedVendorId);
    if (vendor) {
      setVendorId(vendor.id);
      setCurrencyCode(vendor.currencyCode || "PKR");
    }
  }, [formOptions.data, isEdit, requestedVendorId, requestedBillId]);

  const availableBills = (formOptions.data?.bills ?? []).filter(
    (bill) => !vendorId || bill.vendorId === vendorId,
  );
  const allocatedTotal = allocations.reduce((sum, line) => sum + numberValue(line.amount), 0);

  function selectVendor(value: string) {
    setVendorId(value);
    setFieldErrors((current) => ({ ...current, vendorId: undefined, allocations: undefined }));
    const vendor = formOptions.data?.vendors.find((item) => item.id === value);
    if (vendor) {
      setCurrencyCode(vendor.currencyCode || "PKR");
    }
    setAllocations([]);
  }

  function addAllocation() {
    const bill = availableBills.find((item) => numberValue(item.balance) > 0 && !allocations.some((line) => line.billId === item.id));
    const fallback = availableBills.find((item) => !allocations.some((line) => line.billId === item.id));
    const selected = bill ?? fallback;
    if (!selected) {
      setFieldErrors((current) => ({ ...current, allocations: "No further bills are available for this vendor." }));
      return;
    }
    setAllocations((current) => [
      ...current,
      {
        billId: selected.id,
        amount: String(Math.max(numberValue(selected.balance), 0)),
        label: selected.billNumber ?? selected.id,
        balance: selected.balance ?? "0",
        currencyCode: selected.currencyCode,
      },
    ]);
    setFieldErrors((current) => ({ ...current, allocations: undefined }));
  }

  function updateAllocation(index: number, patch: Partial<AllocationDraft>) {
    setAllocations((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
    setFieldErrors((current) => ({ ...current, allocations: undefined }));
  }

  function selectAllocationBill(index: number, billId: string) {
    const bill = availableBills.find((item) => item.id === billId);
    if (!bill) {
      updateAllocation(index, { billId, amount: "0", label: billId, balance: "0" });
      return;
    }
    updateAllocation(index, {
      billId,
      amount: String(Math.max(numberValue(bill.balance), 0)),
      label: bill.billNumber ?? bill.id,
      balance: bill.balance ?? "0",
      currencyCode: bill.currencyCode,
    });
  }

  async function submit() {
    setError(null);
    setFieldErrors({});
    if (!vendorId) {
      setFieldErrors({ vendorId: "Choose a vendor." });
      return;
    }
    if (numberValue(amount) <= 0) {
      setFieldErrors({ amount: "Enter a payment amount greater than zero." });
      return;
    }
    if (allocations.length === 0) {
      setFieldErrors({ allocations: "Allocate this payment to at least one bill." });
      return;
    }
    const overLimit = allocations.find((line) => numberValue(line.amount) > numberValue(line.balance) + 0.0001);
    if (overLimit) {
      setFieldErrors({ allocations: `${overLimit.label}: allocation exceeds the bill's remaining balance.` });
      return;
    }
    if (Math.abs(allocatedTotal - numberValue(amount)) > 0.0001) {
      setFieldErrors({ allocations: `Allocations total ${allocatedTotal.toFixed(4)} but the payment is ${numberValue(amount).toFixed(4)}. They must match.` });
      return;
    }
    const body: VendorPaymentWrite = {
      vendorId,
      paidDate,
      method,
      amount,
      currencyCode,
      reference: reference || undefined,
      notes: notes || undefined,
      bankAccount: bankAccount || undefined,
      allocations: allocations.map((line) => ({ billId: line.billId, amount: line.amount })),
    };
    setBusy(true);
    try {
      if (id) {
        await updateVendorPayment(id, body);
        navigate(`/purchasing/payments/${id}`);
        return;
      }
      const created = await createVendorPayment(body);
      navigate(`/purchasing/payments/${created.id}`);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return <p className="text-sm text-red-700">You do not have permission to {isEdit ? "edit" : "create"} vendor payments.</p>;
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader
        section="Supply / Purchasing / Payments"
        title={isEdit ? "Edit vendor payment" : "Record vendor payment"}
        description="Choose a vendor, enter the amount paid and allocate it to the bills being settled."
      />

      {existing.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(existing.error)}</p> : null}
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <fieldset className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <legend className="mb-1 text-sm font-semibold text-slate-900">Payment details</legend>
          <FormField label="Vendor" htmlFor="vendorId" error={fieldErrors.vendorId} required>
            <select
              id="vendorId"
              required
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={vendorId}
              onChange={(event) => selectVendor(event.target.value)}
            >
              <option value="">Choose a vendor</option>
              {(formOptions.data?.vendors ?? []).map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.displayName ?? vendor.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Paid date" htmlFor="paidDate">
            <Input id="paidDate" type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} />
          </FormField>
          <FormField label="Method" htmlFor="method">
            <select
              id="method"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={method}
              onChange={(event) => setMethod(event.target.value as VendorPaymentMethod)}
            >
              {(formOptions.data?.methods?.length
                ? formOptions.data.methods.map((option) => option.value)
                : VENDOR_PAYMENT_METHODS
              ).map((value) => (
                <option key={value} value={value}>{statusLabel(value)}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Amount" htmlFor="amount" error={fieldErrors.amount} required>
            <Input
              id="amount"
              required
              inputMode="decimal"
              value={amount}
              placeholder="0.0000"
              onChange={(event) => {
                setAmount(event.target.value);
                setFieldErrors((current) => ({ ...current, amount: undefined, allocations: undefined }));
              }}
            />
          </FormField>
          <FormField label="Currency" htmlFor="currencyCode" required>
            <Input
              id="currencyCode"
              required
              value={currencyCode}
              onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())}
            />
          </FormField>
          <FormField label="Reference" htmlFor="reference">
            <Input id="reference" value={reference} placeholder="Cheque, transaction or transfer reference" onChange={(event) => setReference(event.target.value)} />
          </FormField>
          <FormField label="Bank account" htmlFor="bankAccount">
            <Input id="bankAccount" value={bankAccount} onChange={(event) => setBankAccount(event.target.value)} />
          </FormField>
        </fieldset>

        <div className="border-t border-slate-100 pt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Bill allocations</h2>
            {vendorId ? (
              <Button variant="secondary" className="h-8" onClick={addAllocation}>Add bill</Button>
            ) : null}
          </div>
          {!vendorId ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
              Choose a vendor to see their open bills.
            </p>
          ) : availableBills.length === 0 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-4 text-sm text-amber-900">
              No open bills are available for this vendor. Allocate after a bill has been approved.
            </p>
          ) : allocations.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
              No bills allocated yet. Add a bill and split the payment across outstanding balances.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Bill</th>
                    <th className="w-40 px-2 py-2 text-right">Outstanding</th>
                    <th className="w-40 px-2 py-2 text-right">Allocate</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((line, index) => (
                    <tr key={`${line.billId}-${index}`} className="border-b border-slate-100 align-top">
                      <td className="px-2 py-2">
                        <select
                          aria-label={`Bill for allocation ${index + 1}`}
                          className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                          value={line.billId}
                          onChange={(event) => selectAllocationBill(index, event.target.value)}
                        >
                          {availableBills.map((bill) => (
                            <option key={bill.id} value={bill.id}>
                              {bill.billNumber ?? bill.id} · {formatMoney(bill.balance ?? "0", bill.currencyCode)} due
                            </option>
                          ))}
                          {!availableBills.some((bill) => bill.id === line.billId) ? (
                            <option value={line.billId}>{line.label}</option>
                          ) : null}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                        {formatMoney(line.balance, line.currencyCode)}
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          aria-label={`Allocation amount for ${line.label}`}
                          className="h-9 text-right"
                          inputMode="decimal"
                          value={line.amount}
                          onChange={(event) => updateAllocation(index, { amount: event.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          aria-label={`Remove allocation ${index + 1}`}
                          className="rounded px-2 py-1 text-red-700 hover:bg-red-50"
                          onClick={() => setAllocations((current) => current.filter((_, i) => i !== index))}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {fieldErrors.allocations ? (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {fieldErrors.allocations}
            </p>
          ) : null}
          <dl className="ml-auto mt-3 grid max-w-xs grid-cols-2 gap-y-1 text-sm">
            <dt className="text-slate-500">Payment amount</dt>
            <dd className="text-right tabular-nums text-slate-800">{formatMoney(amount || "0", currencyCode)}</dd>
            <dt className="text-slate-500">Allocated</dt>
            <dd className={`text-right tabular-nums ${Math.abs(allocatedTotal - numberValue(amount)) > 0.0001 ? "text-red-700" : "text-slate-800"}`}>
              {formatMoney(allocatedTotal, currencyCode)}
            </dd>
            <dt className="text-slate-500">Unallocated</dt>
            <dd className="text-right tabular-nums text-slate-800">
              {formatMoney(numberValue(amount) - allocatedTotal, currencyCode)}
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
          <Link className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm text-slate-700" to={id ? `/purchasing/payments/${id}` : "/purchasing/payments"}>
            Cancel
          </Link>
          <Button className="h-9 bg-brand-800 hover:bg-brand-900" disabled={busy || existing.isPending} onClick={submit}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Record payment"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

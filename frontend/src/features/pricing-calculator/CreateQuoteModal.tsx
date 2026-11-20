import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { createQuote, getQuoteFormOptions } from "@/features/quotes/api.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import type { CalculatedLineItem, CalculatorSettings } from "./types.ts";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  calculatedItems: CalculatedLineItem[];
  settings: CalculatorSettings;
  totalInclGst: number;
  totalExclGst: number;
  totalGst: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CreateQuoteModal({
  isOpen,
  onClose,
  calculatedItems,
  settings,
  totalInclGst,
  totalExclGst,
  totalGst,
}: Props) {
  const navigate = useNavigate();
  const formOptions = useQuery({
    queryKey: ["quotes", "form-options"],
    queryFn: getQuoteFormOptions,
    enabled: isOpen,
  });

  const [customerId, setCustomerId] = useState("");
  const [paymentTermId, setPaymentTermId] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [validUntil, setValidUntil] = useState(addDays(30));
  const [notes, setNotes] = useState("- Prices are inclusive of all applicable taxes (WHT & GST).\n- Quote generated from Enterprise Sales Pricing Calculator.");
  const [priceMode, setPriceMode] = useState<"incl_gst" | "excl_gst">("incl_gst");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => {
      if (!customerId) throw new Error("Please select a customer.");
      if (calculatedItems.length === 0) throw new Error("No items to quote.");

      const lines = calculatedItems
        .filter((item) => item.qty > 0)
        .map((item) => {
          const unitPrice =
            priceMode === "incl_gst"
              ? item.unitSellingPriceInclTaxes
              : item.unitSellingPriceExclGst;
          const gstRateForLine = priceMode === "incl_gst" ? item.gstRate : 0;
          return {
            productName: item.name,
            description: `Type: ${item.type} | GST: ${item.gst} | Cost basis: ${item.costBasis}`,
            unitOfMeasure: "unit",
            quantity: String(item.qty),
            unitPrice: unitPrice.toFixed(4),
            discountPercent: "0",
            taxRate: (gstRateForLine * 100).toFixed(4),
          };
        });

      return createQuote({
        customerId,
        issueDate: issueDate || undefined,
        validUntil: validUntil || undefined,
        paymentTermId: paymentTermId || undefined,
        currencyCode: "PKR",
        notes: notes || undefined,
        lines,
      });
    },
    onSuccess: (quote) => {
      navigate(`/quotes/${quote.id}`);
      onClose();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function handleCustomerChange(id: string) {
    setCustomerId(id);
    const c = formOptions.data?.customers.find((x) => x.id === id);
    if (c?.paymentTermId) setPaymentTermId(c.paymentTermId);
  }

  function handleClose() {
    setError(null);
    onClose();
  }

  if (!isOpen) return null;

  const activeItems = calculatedItems.filter((i) => i.qty > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={createMutation.isPending ? undefined : handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-brand-50 to-slate-50 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Create Quote from Calculator</h2>
            <p className="text-xs text-slate-500">
              {activeItems.length} item{activeItems.length !== 1 ? "s" : ""} · PKR{" "}
              {totalInclGst.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total (incl. GST)
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={createMutation.isPending}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Price Mode Toggle */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">Quote Price Mode</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPriceMode("incl_gst")}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                  priceMode === "incl_gst"
                    ? "border-brand-600 bg-brand-800 text-white shadow-sm"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div>GST Inclusive</div>
                <div className={`text-xs font-normal mt-0.5 ${priceMode === "incl_gst" ? "text-brand-200" : "text-slate-500"}`}>
                  PKR {totalInclGst.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPriceMode("excl_gst")}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                  priceMode === "excl_gst"
                    ? "border-brand-600 bg-brand-800 text-white shadow-sm"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div>GST Exclusive</div>
                <div className={`text-xs font-normal mt-0.5 ${priceMode === "excl_gst" ? "text-brand-200" : "text-slate-500"}`}>
                  PKR {totalExclGst.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </button>
            </div>
            {priceMode === "incl_gst" && (
              <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                ⚠️ GST Inclusive: unit selling price (incl. all taxes) will be used. GST tax rate will be shown on quote lines.
              </p>
            )}
            {priceMode === "excl_gst" && (
              <p className="mt-2 text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                ℹ️ GST Exclusive: pre-GST selling price will be used. Customer's tax code will apply GST on top.
              </p>
            )}
          </div>

          {/* Items Preview */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">Line Items Preview</p>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">GST</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeItems.map((item) => {
                    const unitPrice =
                      priceMode === "incl_gst"
                        ? item.unitSellingPriceInclTaxes
                        : item.unitSellingPriceExclGst;
                    const lineTotal = unitPrice * item.qty;
                    const gstPct = (item.gstRate * 100).toFixed(0);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-slate-800">{item.name}</p>
                          <p className="text-[10px] text-slate-400">{item.type} · {item.gst}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{item.qty}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-mono text-slate-800">
                          {unitPrice.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-purple-700">
                          {priceMode === "incl_gst" ? `${gstPct}%` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-700">
                          {lineTotal.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr className="text-xs font-bold">
                    <td colSpan={3} className="px-3 py-2 text-right text-slate-600">
                      {priceMode === "incl_gst" ? "GST Incl. Total:" : "Excl. GST Total:"}
                    </td>
                    <td colSpan={2} className="px-3 py-2 text-right font-mono text-emerald-800">
                      PKR{" "}
                      {(priceMode === "incl_gst" ? totalInclGst : totalExclGst).toLocaleString("en-PK", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                  {priceMode === "incl_gst" && (
                    <tr className="text-[11px] text-slate-500">
                      <td colSpan={3} className="px-3 py-1 text-right">Total GST Component:</td>
                      <td colSpan={2} className="px-3 py-1 text-right font-mono text-purple-600">
                        PKR {totalGst.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </div>

          {/* Customer & Quote Details */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Customer */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="qcm-customer">
                Customer <span className="text-red-500">*</span>
              </label>
              {formOptions.isLoading ? (
                <div className="h-9 animate-pulse rounded-lg bg-slate-100" />
              ) : (
                <select
                  id="qcm-customer"
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  value={customerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                >
                  <option value="">— Select customer —</option>
                  {(formOptions.data?.customers ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Issue Date */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="qcm-issue">
                Issue Date
              </label>
              <Input
                id="qcm-issue"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>

            {/* Valid Until */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="qcm-valid">
                Valid Until
              </label>
              <Input
                id="qcm-valid"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>

            {/* Payment Term */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="qcm-term">
                Payment Term
              </label>
              {formOptions.isLoading ? (
                <div className="h-9 animate-pulse rounded-lg bg-slate-100" />
              ) : (
                <select
                  id="qcm-term"
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  value={paymentTermId}
                  onChange={(e) => setPaymentTermId(e.target.value)}
                >
                  <option value="">— Select payment term —</option>
                  {(formOptions.data?.paymentTerms ?? []).map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="qcm-notes">
                Quote Notes
              </label>
              <textarea
                id="qcm-notes"
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Calculator settings summary */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-blue-700">Calculator Parameters (for reference)</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-blue-800">
              <div className="flex justify-between">
                <span>Profit Margin:</span>
                <span className="font-semibold">{(settings.profitMargin * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>KIBOR / Risk-free rate:</span>
                <span className="font-semibold">{(settings.riskFreeRate * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Bank USD Rate:</span>
                <span className="font-semibold">PKR {settings.bankUsdRate}</span>
              </div>
              <div className="flex justify-between">
                <span>Forex USD Rate:</span>
                <span className="font-semibold">PKR {settings.forexUsdRate}</span>
              </div>
            </div>
          </div>

          {error ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <p className="text-xs text-slate-500">
            Quote will be created as <strong>DRAFT</strong> and can be edited before sending.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleClose}
              disabled={createMutation.isPending}
              className="h-9"
            >
              Cancel
            </Button>
            <Button
              className="h-9 gap-2 bg-brand-800 hover:bg-brand-900"
              onClick={() => {
                setError(null);
                createMutation.mutate();
              }}
              disabled={createMutation.isPending || !customerId || activeItems.length === 0}
            >
              {createMutation.isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Creating Quote…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  Create Quote
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

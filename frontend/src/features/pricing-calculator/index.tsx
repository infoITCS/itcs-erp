import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button.tsx";
import { CalculatorSettingsDrawer } from "./CalculatorSettingsDrawer.tsx";
import { CreateQuoteModal } from "./CreateQuoteModal.tsx";
import { KiborRatesModal } from "./KiborRatesModal.tsx";
import {
  DEFAULT_SETTINGS,
  GST_PRESETS,
  SAMPLE_LINE_ITEMS,
  WHT_PRESETS,
  calculatePricing,
} from "./calculator-logic.ts";
import type {
  CalculatedLineItem,
  CalculatorSettings,
  CostBasis,
  LineItem,
} from "./types.ts";

export default function PricingCalculatorPage() {
  const [settings, setSettings] = useState<CalculatorSettings>(DEFAULT_SETTINGS);
  const [items, setItems] = useState<LineItem[]>(SAMPLE_LINE_ITEMS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isKiborOpen, setIsKiborOpen] = useState(false);
  const [isCreateQuoteOpen, setIsCreateQuoteOpen] = useState(false);
  const [copiedQuote, setCopiedQuote] = useState(false);

  // Core calculation pipeline
  const { calculatedItems, summary } = useMemo(() => {
    return calculatePricing(items, settings);
  }, [items, settings]);

  const activeItemsCount = calculatedItems.filter((i) => i.qty > 0).length;

  // Line item manipulation helpers
  const handleAddItem = () => {
    const newItem: LineItem = {
      id: `item-${Date.now()}`,
      name: "New Quotation Item",
      enteredUnitCost: 100,
      costBasis: "PKR",
      gstBill: "No",
      type: "Service (5%)",
      whtRate: 0.05,
      gst: "Sindh Services Tax (SST-15%)",
      gstRate: 0.15,
      qty: 1,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleDuplicateItem = (item: LineItem) => {
    const duplicate: LineItem = {
      ...item,
      id: `item-${Date.now()}`,
      name: `${item.name} (Copy)`,
    };
    setItems((prev) => [...prev, duplicate]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = (id: string, updates: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        return { ...it, ...updates };
      }),
    );
  };

  const handleLoadSampleData = () => {
    setItems(SAMPLE_LINE_ITEMS);
    setSettings(DEFAULT_SETTINGS);
  };

  const handleClearItems = () => {
    setItems([]);
  };

  const handleExportCsv = () => {
    const headers = [
      "Entered unit cost",
      "Item Name",
      "Cost basis",
      "Unit cost (PKR)",
      "GST Bill",
      "Type",
      "GST",
      "Qty",
      "Unit Price without GST",
      "Unit Price with Profit",
      "Unit Price Including WHT",
      "Unit Price Including GST",
      "Unit Cost of Capital",
      "Unit Cost of Perf. Guarantee",
      "Unit Cost of Earnest Money",
      "Unit Selling Price Including Taxes",
      "Unit Selling Price Excluding GST",
      "Unit GST",
      "Total Including GST",
    ];

    const rows = calculatedItems.map((c: CalculatedLineItem) => [
      c.enteredUnitCost,
      `"${c.name.replace(/"/g, '""')}"`,
      c.costBasis,
      c.unitCostPkr.toFixed(2),
      c.gstBill,
      `"${c.type}"`,
      `"${c.gst}"`,
      c.qty,
      c.unitPriceWithoutGst.toFixed(2),
      c.unitPriceWithProfit.toFixed(2),
      c.unitPriceInclWht.toFixed(2),
      c.unitPriceInclGst.toFixed(4),
      c.unitCostOfCapital.toFixed(2),
      c.unitCostOfPG.toFixed(2),
      c.unitCostOfEM.toFixed(2),
      c.unitSellingPriceInclTaxes.toFixed(4),
      c.unitSellingPriceExclGst.toFixed(2),
      c.unitGst.toFixed(4),
      c.totalInclGst.toFixed(4),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `itcs-pricing-quote-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyQuoteSummary = () => {
    const text = `--- ITCS SALES PRICING QUOTE SUMMARY ---
Overall Total (Incl. GST): PKR ${summary.overallTotalInclGstPkr.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ($${summary.overallTotalInclGstUsd.toFixed(2)} USD)
Overall Total (Excl. GST): PKR ${summary.overallTotalExclGstPkr.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ($${summary.overallTotalExclGstUsd.toFixed(2)} USD)
Total Sales Tax (GST): PKR ${summary.totalGstPkr.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Total Withholding Tax (WHT): PKR ${summary.totalWhtPkr.toFixed(2)}
Net Projected Profit: PKR ${summary.netProfitPkr.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${summary.profitMarginPercent.toFixed(1)}% ROI)
Target Margin: ${(settings.profitMargin * 100).toFixed(1)}% | Risk-Free Benchmark: ${(settings.riskFreeRate * 100).toFixed(2)}%
Bank USD Rate: PKR ${settings.bankUsdRate} | Forex Open Market: PKR ${settings.forexUsdRate} | Credit Card USD: PKR ${summary.creditCardUsdRate.toFixed(2)}
Financing Period: ${Math.max(0, settings.customerPaymentTerm - settings.vendorPaymentTerm)} Month(s)`;

    navigator.clipboard.writeText(text);
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 2000);
  };

  return (
    <section className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      {/* ── TOP LIVE FINANCIAL TICKER ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs text-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-bold tracking-wide uppercase text-[11px] text-slate-600">Engine Status:</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-800 border border-slate-200">
              Joint Solver Active
            </span>
          </div>
          <div className="hidden h-3 w-px bg-slate-200 sm:block" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Forex Open Market:</span>
            <span className="font-mono font-bold text-slate-900">PKR {settings.forexUsdRate.toFixed(2)}</span>
          </div>
          <div className="hidden h-3 w-px bg-slate-200 sm:block" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Bank TT/DD:</span>
            <span className="font-mono font-bold text-slate-900">PKR {settings.bankUsdRate.toFixed(2)}</span>
          </div>
          <div className="hidden h-3 w-px bg-slate-200 sm:block" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Credit Card (+6.5%):</span>
            <span className="font-mono font-bold text-slate-900">PKR {summary.creditCardUsdRate.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsKiborOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition border border-slate-200"
          >
            <svg className="h-3 w-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
            KIBOR: <span className="font-mono text-slate-900 font-bold">{(settings.riskFreeRate * 100).toFixed(2)}%</span>
          </button>
          <span className="text-[11px] text-slate-500">
            Terms: <strong className="text-slate-700">{settings.vendorPaymentTerm}v / {settings.customerPaymentTerm}c Mo.</strong>
          </span>
        </div>
      </div>

      {/* ── HEADER ── */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-800">
            <span className="h-2 w-2 rounded-full bg-brand-600" />
            <Link to="/sales" className="hover:underline">
              Sales Module
            </Link>{" "}
            / Pricing Calculator & CPQ
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Enterprise Sales Pricing Calculator
          </h1>
          <p className="mt-1 text-xs text-slate-600 max-w-3xl">
            High-precision commercial CPQ engine: working capital cost, tender guarantees (PG/EM joint linear solver), 
            provincial sales taxes (SST, PST, ICT, KPPRA, BRA), and multi-currency exchange rates.
          </p>
        </div>

        {/* Header Action Center */}
        <div className="flex flex-wrap items-center gap-2.5">
          {summary.hodApprovalRequired ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-sm animate-pulse">
              <svg className="h-4 w-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              HoD Approval Mandatory (&lt;8%)
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              Margin Verified: {(settings.profitMargin * 100).toFixed(1)}%
            </div>
          )}

          <Button
            variant="secondary"
            onClick={() => setIsSettingsOpen(true)}
            className="h-10 gap-2 text-xs font-bold shadow-sm"
          >
            <svg className="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Calculator Settings
          </Button>

          {/* PRIMARY CALL TO ACTION: CREATE QUOTATION */}
          <Button
            onClick={() => setIsCreateQuoteOpen(true)}
            disabled={activeItemsCount === 0}
            className="h-10 gap-2 bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-40 shadow-md ring-2 ring-emerald-600/20"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            Create Quotation ({activeItemsCount})
          </Button>
        </div>
      </header>

      {/* ── EXECUTIVE KPI DASHBOARD ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Net Profit Card - Hero */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(0,0,0,0.07)]">
          {/* Top Accent Line */}
          <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />

          <div>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Projected Net Profit
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                {summary.profitMarginPercent.toFixed(1)}% ROI
              </span>
            </div>

            {/* Primary Metric */}
            <div className="mt-4">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Net Return</span>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-xs font-bold text-slate-400">PKR</span>
                <span className="text-[28px] font-black tracking-tight text-slate-900 sm:text-[30px]">
                  {summary.netProfitPkr.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Mini Health Bar */}
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                <span>Benchmark: 8.0%</span>
                <span className={summary.profitMarginPercent >= 8 ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
                  {summary.profitMarginPercent >= 8 ? "Compliant" : "HoD Sign-off Req."}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(10, (summary.profitMarginPercent / 20) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Footer Details */}
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
            <span>Target: <strong className="font-semibold text-slate-800">{(settings.profitMargin * 100).toFixed(1)}%</strong></span>
            <span>Total Cost: <strong className="font-mono font-semibold text-slate-800">PKR {summary.totalCostPkr.toFixed(2)}</strong></span>
          </div>
        </div>

        {/* Total Deal Value Including GST */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(0,0,0,0.07)]">
          {/* Top Accent Line */}
          <div className="absolute inset-x-0 top-0 h-1 bg-slate-900" />

          <div>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-800 ring-1 ring-slate-900/10">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Total Bid (Incl. GST)
                </span>
              </div>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-800">
                ${summary.overallTotalInclGstUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>

            {/* Primary Metric */}
            <div className="mt-4">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Final Commercial Offer</span>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-xs font-bold text-slate-400">PKR</span>
                <span className="text-[28px] font-black tracking-tight text-slate-950 sm:text-[30px]">
                  {summary.overallTotalInclGstPkr.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Tax Split Micro-Bar */}
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                <span>Pre-Tax: PKR {summary.overallTotalExclGstPkr.toFixed(0)}</span>
                <span className="font-mono text-slate-700">GST: PKR {summary.totalGstPkr.toFixed(0)}</span>
              </div>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-slate-800"
                  style={{
                    width: `${summary.overallTotalInclGstPkr > 0 ? (summary.overallTotalExclGstPkr / summary.overallTotalInclGstPkr) * 100 : 85}%`,
                  }}
                />
                <div
                  className="h-full bg-slate-400"
                  style={{
                    width: `${summary.overallTotalInclGstPkr > 0 ? (summary.totalGstPkr / summary.overallTotalInclGstPkr) * 100 : 15}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Footer Details */}
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
            <span>Sales Tax (GST): <strong className="font-mono font-semibold text-slate-800">PKR {summary.totalGstPkr.toFixed(2)}</strong></span>
            <span className="font-bold text-slate-700">Active Proposal</span>
          </div>
        </div>

        {/* Net Revenue Excluding GST */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(0,0,0,0.07)]">
          {/* Top Accent Line */}
          <div className="absolute inset-x-0 top-0 h-1 bg-slate-500" />

          <div>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 ring-1 ring-slate-900/10">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Gross Base (Excl. GST)
                </span>
              </div>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-800">
                ${summary.overallTotalExclGstUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>

            {/* Primary Metric */}
            <div className="mt-4">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">ITCS Invoiced Value</span>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-xs font-bold text-slate-400">PKR</span>
                <span className="text-[28px] font-black tracking-tight text-slate-900 sm:text-[30px]">
                  {summary.overallTotalExclGstPkr.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Cost vs Revenue Micro-Bar */}
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                <span>Cost: PKR {summary.totalCostPkr.toFixed(0)}</span>
                <span className="font-mono text-slate-700">Gross Margin: PKR {summary.netProfitPkr.toFixed(0)}</span>
              </div>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-slate-600"
                  style={{
                    width: `${summary.overallTotalExclGstPkr > 0 ? (summary.totalCostPkr / summary.overallTotalExclGstPkr) * 100 : 80}%`,
                  }}
                />
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${summary.overallTotalExclGstPkr > 0 ? (summary.netProfitPkr / summary.overallTotalExclGstPkr) * 100 : 20}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Footer Details */}
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
            <span>Pre-Tax Base: <strong className="font-mono font-semibold text-slate-800">PKR {summary.overallTotalExclGstPkr.toFixed(2)}</strong></span>
            <span className="font-semibold text-slate-600">Company Revenue</span>
          </div>
        </div>

        {/* Financing, PG & EM Charges */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(0,0,0,0.07)]">
          {/* Top Accent Line */}
          <div className="absolute inset-x-0 top-0 h-1 bg-indigo-600" />

          <div>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500/20">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Financing & Guarantees
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50/70 px-2.5 py-0.5 font-mono text-[10px] font-bold text-indigo-800">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                Joint Linear
              </span>
            </div>

            {/* Primary Metric */}
            <div className="mt-4">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Total Financial Overhead</span>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-xs font-bold text-slate-400">PKR</span>
                <span className="text-[28px] font-black tracking-tight text-slate-900 sm:text-[30px]">
                  {(summary.totalCostOfCapitalPkr + summary.totalPgCostPkr + summary.totalEmCostPkr).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Financing Gap Micro-Bar */}
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                <span>Gap: {Math.max(0, settings.customerPaymentTerm - settings.vendorPaymentTerm)} Mo.</span>
                <span className="font-mono text-slate-700">KIBOR: {(settings.riskFreeRate * 100).toFixed(2)}%</span>
              </div>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-indigo-500"
                  style={{
                    width: `${summary.totalCostOfCapitalPkr + summary.totalPgCostPkr + summary.totalEmCostPkr > 0 ? (summary.totalCostOfCapitalPkr / (summary.totalCostOfCapitalPkr + summary.totalPgCostPkr + summary.totalEmCostPkr)) * 100 : 50}%`,
                  }}
                />
                <div
                  className="h-full bg-indigo-300"
                  style={{
                    width: `${summary.totalCostOfCapitalPkr + summary.totalPgCostPkr + summary.totalEmCostPkr > 0 ? ((summary.totalPgCostPkr + summary.totalEmCostPkr) / (summary.totalCostOfCapitalPkr + summary.totalPgCostPkr + summary.totalEmCostPkr)) * 100 : 50}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Footer Details */}
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
            <span>Capital: <strong className="font-mono font-semibold text-slate-800">PKR {summary.totalCostOfCapitalPkr.toFixed(2)}</strong></span>
            <span>PG/EM: <strong className="font-mono font-semibold text-slate-800">PKR {(summary.totalPgCostPkr + summary.totalEmCostPkr).toFixed(2)}</strong></span>
          </div>
        </div>
      </div>

      {/* ── ACTIONS TOOLBAR ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleAddItem} className="h-9 gap-1.5 text-xs font-bold shadow-sm">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Line Item
          </Button>

          <Button
            variant="secondary"
            onClick={handleLoadSampleData}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Reset to Sample Template
          </Button>

          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearItems}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
            >
              Clear All Rows
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleCopyQuoteSummary}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            {copiedQuote ? (
              <>
                <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-emerald-700 font-bold">Summary Copied!</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy Quote Summary
              </>
            )}
          </Button>

          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={calculatedItems.length === 0}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export to CSV
          </Button>
        </div>
      </div>

      {/* ── HIGH-DENSITY COMMERCIAL PRICING TABLE ── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Commercial Line Items & Comprehensive Tax Stack</h2>
            <p className="text-[11px] text-slate-500">
              Enter unit costs, cost basis, withholding tax types, and provincial GST regimes. Real-time joint solver recalculation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-800">
              {calculatedItems.length} Total / {activeItemsCount} Active
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            {/* Grouped Header */}
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                <th colSpan={5} className="px-3 py-2 border-r border-slate-200">
                  1. Line Item & Procurement Cost
                </th>
                <th colSpan={3} className="px-3 py-2 border-r border-slate-200">
                  2. Tax Architecture & Withholding
                </th>
                <th colSpan={5} className="px-3 py-2 border-r border-slate-200">
                  3. Pricing & Financing Stack (Per Unit)
                </th>
                <th colSpan={3} className="px-3 py-2 border-r border-slate-200 text-slate-700">
                  4. Commercial Customer Price
                </th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
              <tr className="border-b border-slate-200 bg-white text-slate-700 select-none text-[11px] font-bold">
                <th className="px-3 py-2.5 w-10 text-center">#</th>
                <th className="px-3 py-2.5 min-w-[200px]">Item Description</th>
                <th className="px-3 py-2.5 min-w-[140px]">Cost Basis</th>
                <th className="px-3 py-2.5 min-w-[100px] text-right">Entered Cost</th>
                <th className="px-3 py-2.5 min-w-[105px] text-right border-r border-slate-200 font-mono">Cost (PKR)</th>
                <th className="px-3 py-2.5 w-20 text-center">GST Bill</th>
                <th className="px-3 py-2.5 min-w-[140px]">Type (WHT)</th>
                <th className="px-3 py-2.5 min-w-[180px] border-r border-slate-200">GST Region</th>
                <th className="px-3 py-2.5 w-16 text-center">Qty</th>
                <th className="px-3 py-2.5 text-right min-w-[105px] font-mono">w/ Profit</th>
                <th className="px-3 py-2.5 text-right min-w-[105px] font-mono">Incl WHT</th>
                <th className="px-3 py-2.5 text-right min-w-[105px] font-mono">Incl GST</th>
                <th className="px-3 py-2.5 text-right min-w-[95px] font-mono border-r border-slate-200">Capital</th>
                <th className="px-3 py-2.5 text-right min-w-[130px] font-extrabold text-slate-950 font-mono">
                  Unit Price (Incl Tax)
                </th>
                <th className="px-3 py-2.5 text-right min-w-[105px] font-mono">Excl GST</th>
                <th className="px-3 py-2.5 text-right min-w-[135px] font-bold text-slate-950 font-mono border-r border-slate-200">
                  Total (Incl GST)
                </th>
                <th className="px-3 py-2.5 text-center w-20">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calculatedItems.length === 0 ? (
                <tr>
                  <td colSpan={17} className="py-12 text-center text-slate-500">
                    <p className="text-sm font-semibold">No items entered in this quotation.</p>
                    <p className="mt-1 text-xs">Click "+ Add Line Item" or "Reset to Sample Template" to start.</p>
                  </td>
                </tr>
              ) : null}

              {calculatedItems.map((item: CalculatedLineItem, idx: number) => {
                const isActive = item.qty > 0;
                return (
                  <tr
                    key={item.id}
                    className={`transition hover:bg-slate-50/80 ${!isActive ? "bg-slate-50/40 opacity-55" : ""}`}
                  >
                    {/* Index */}
                    <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-400">
                      {idx + 1}
                    </td>

                    {/* Item Name */}
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                        className="h-8 w-full rounded-lg border border-transparent px-2 text-xs font-semibold text-slate-900 hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:outline-none transition"
                      />
                    </td>

                    {/* Cost Basis */}
                    <td className="px-3 py-2.5">
                      <select
                        value={item.costBasis}
                        onChange={(e) =>
                          handleUpdateItem(item.id, { costBasis: e.target.value as CostBasis })
                        }
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 focus:border-brand-500 focus:outline-none transition"
                      >
                        <option value="PKR">PKR (Local)</option>
                        <option value="USD - Bank">USD - Bank Wire</option>
                        <option value="USD - Credit card">USD - Credit Card (+6.5%)</option>
                      </select>
                    </td>

                    {/* Entered Cost */}
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.enteredUnitCost}
                        onChange={(e) =>
                          handleUpdateItem(item.id, {
                            enteredUnitCost: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className="h-8 w-24 rounded-lg border border-slate-200 bg-white px-2 text-right font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                      />
                    </td>

                    {/* Unit Cost PKR */}
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200">
                      {item.unitCostPkr.toFixed(2)}
                    </td>

                    {/* GST Bill */}
                    <td className="px-3 py-2.5 text-center">
                      <select
                        value={item.gstBill}
                        onChange={(e) =>
                          handleUpdateItem(item.id, { gstBill: e.target.value as "Yes" | "No" })
                        }
                        className="h-8 rounded-lg border border-slate-200 bg-white px-1.5 text-center text-xs font-semibold text-slate-700 focus:border-brand-500 focus:outline-none"
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </td>

                    {/* Type (WHT) */}
                    <td className="px-3 py-2.5">
                      <select
                        value={item.type}
                        onChange={(e) => {
                          const selected = WHT_PRESETS.find((w) => w.label === e.target.value);
                          handleUpdateItem(item.id, {
                            type: e.target.value,
                            whtRate: selected ? selected.rate : item.whtRate,
                          });
                        }}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 focus:border-brand-500 focus:outline-none"
                      >
                        {WHT_PRESETS.map((p) => (
                          <option key={p.label} value={p.label}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* GST Region */}
                    <td className="px-3 py-2.5 border-r border-slate-200">
                      <select
                        value={item.gst}
                        onChange={(e) => {
                          const selected = GST_PRESETS.find((g) => g.label === e.target.value);
                          handleUpdateItem(item.id, {
                            gst: e.target.value,
                            gstRate: selected ? selected.rate : item.gstRate,
                          });
                        }}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 focus:border-brand-500 focus:outline-none"
                      >
                        {GST_PRESETS.map((g) => (
                          <option key={g.label} value={g.label}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Qty */}
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.qty}
                        onChange={(e) =>
                          handleUpdateItem(item.id, {
                            qty: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className="h-8 w-14 rounded-lg border border-slate-300 bg-white px-1.5 text-center font-mono text-xs font-bold text-slate-900 focus:border-brand-500 focus:outline-none"
                      />
                    </td>

                    {/* Unit Price with Profit */}
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                      {item.unitPriceWithProfit.toFixed(2)}
                    </td>

                    {/* Unit Price Incl WHT */}
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                      {item.unitPriceInclWht.toFixed(2)}
                    </td>

                    {/* Unit Price Incl GST */}
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                      {item.unitPriceInclGst.toFixed(2)}
                    </td>

                    {/* Capital Cost */}
                    <td className="px-3 py-2.5 text-right font-mono text-slate-500 border-r border-slate-200">
                      {item.unitCostOfCapital.toFixed(2)}
                    </td>

                    {/* Unit Selling Price Incl Taxes (Final Price) */}
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-950">
                      {item.unitSellingPriceInclTaxes.toFixed(2)}
                    </td>

                    {/* Unit Selling Price Excl GST */}
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                      {item.unitSellingPriceExclGst.toFixed(2)}
                    </td>

                    {/* Total Incl GST (Final Deal Line) */}
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-950 border-r border-slate-200">
                      {item.totalInclGst.toFixed(2)}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicateItem(item)}
                          title="Duplicate item"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          title="Delete item"
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Table Footer Reconciled Summary */}
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-xs text-slate-900">
              <tr>
                <td colSpan={4} className="px-3 py-3 text-right">
                  Summary Totals:
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-800 border-r border-slate-200">
                  PKR {summary.totalCostPkr.toFixed(2)}
                </td>
                <td colSpan={3} className="border-r border-slate-200" />
                <td className="px-3 py-3 text-center font-mono">
                  {calculatedItems.reduce((acc, it) => acc + it.qty, 0)}
                </td>
                <td colSpan={3} />
                <td className="px-3 py-3 text-right font-mono text-slate-600 border-r border-slate-200">
                  PKR {summary.totalCostOfCapitalPkr.toFixed(2)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-700">
                  Total Excl GST:
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-950 font-bold">
                  {summary.overallTotalExclGstPkr.toFixed(2)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-950 font-bold text-sm border-r border-slate-200">
                  PKR {summary.overallTotalInclGstPkr.toFixed(2)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ── MODALS & DRAWERS ── */}
      <CalculatorSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        onResetDefaults={() => setSettings(DEFAULT_SETTINGS)}
        onOpenKibor={() => {
          setIsSettingsOpen(false);
          setIsKiborOpen(true);
        }}
        summary={summary}
      />

      <KiborRatesModal
        isOpen={isKiborOpen}
        onClose={() => setIsKiborOpen(false)}
        currentRate={settings.riskFreeRate}
        onSelectRate={(rate) => {
          setSettings((prev) => ({ ...prev, riskFreeRate: rate }));
        }}
      />

      <CreateQuoteModal
        isOpen={isCreateQuoteOpen}
        onClose={() => setIsCreateQuoteOpen(false)}
        calculatedItems={calculatedItems}
        settings={settings}
        totalInclGst={summary.overallTotalInclGstPkr}
        totalExclGst={summary.overallTotalExclGstPkr}
        totalGst={summary.totalGstPkr}
      />
    </section>
  );
}

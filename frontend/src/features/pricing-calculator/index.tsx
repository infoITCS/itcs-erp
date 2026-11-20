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
    link.setAttribute("download", `sales-pricing-quote-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyQuoteSummary = () => {
    const text = `--- SALES PRICING QUOTE SUMMARY ---
Overall Total (Incl. GST): PKR ${summary.overallTotalInclGstPkr.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ($${summary.overallTotalInclGstUsd.toFixed(2)} USD)
Overall Total (Excl. GST): PKR ${summary.overallTotalExclGstPkr.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ($${summary.overallTotalExclGstUsd.toFixed(2)} USD)
Total GST: PKR ${summary.totalGstPkr.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Net Projected Profit: PKR ${summary.netProfitPkr.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${summary.profitMarginPercent.toFixed(1)}%)
Target Margin: ${(settings.profitMargin * 100).toFixed(1)}% | Risk-Free Rate: ${(settings.riskFreeRate * 100).toFixed(2)}%
Bank USD Rate: PKR ${settings.bankUsdRate} | Forex Rate: PKR ${settings.forexUsdRate}`;

    navigator.clipboard.writeText(text);
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 2000);
  };

  return (
    <section className="mx-auto flex w-full max-w-[1550px] flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-600" />
            <Link to="/sales" className="hover:underline">
              Sales
            </Link>{" "}
            / Pricing Calculator
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Enterprise Sales Pricing Calculator
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Calculate cost of goods, working capital financing, performance guarantees, WHT, and GST with joint solver.
          </p>
        </div>

        {/* Header Badges & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {summary.hodApprovalRequired ? (
            <span className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
              <svg className="h-3.5 w-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              HoD Approval Mandatory (&lt;8%)
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              Margin Verified: {(settings.profitMargin * 100).toFixed(1)}%
            </span>
          )}

          <Button
            variant="secondary"
            onClick={() => setIsKiborOpen(true)}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <svg className="h-3.5 w-3.5 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
            KIBOR: {(settings.riskFreeRate * 100).toFixed(2)}%
          </Button>

          <Button
            variant="secondary"
            onClick={() => setIsSettingsOpen(true)}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <svg className="h-3.5 w-3.5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Calculator Settings
          </Button>

          {/* CREATE QUOTATION — primary CTA */}
          <Button
            onClick={() => setIsCreateQuoteOpen(true)}
            disabled={calculatedItems.filter((i) => i.qty > 0).length === 0}
            className="h-9 gap-1.5 bg-emerald-700 text-xs font-bold hover:bg-emerald-800 disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            Create Quotation
          </Button>
        </div>
      </header>

      {/* EXECUTIVE KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Net Profit Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Net Profit (PKR)</span>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              {summary.profitMarginPercent.toFixed(1)}% ROI
            </span>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-emerald-700 sm:text-3xl">
            PKR {summary.netProfitPkr.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <span>Target Margin: {(settings.profitMargin * 100).toFixed(1)}%</span>
            <span>Total Cost: PKR {summary.totalCostPkr.toFixed(2)}</span>
          </div>
        </div>

        {/* Overall Total Including GST */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overall Total (Incl. GST)</span>
            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
              ${summary.overallTotalInclGstUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </span>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            PKR {summary.overallTotalInclGstPkr.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <span>Forex Rate: PKR {settings.forexUsdRate}</span>
            <span>Final Customer Quote</span>
          </div>
        </div>

        {/* Overall Total Excluding GST */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overall Total (Excl. GST)</span>
            <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
              ${summary.overallTotalExclGstUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </span>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            PKR {summary.overallTotalExclGstPkr.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <span>Base Revenue (Gross)</span>
            <span>Tax-Free Base</span>
          </div>
        </div>

        {/* Tax & Guarantees Breakdown */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Taxes & Guarantees</span>
            <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700">Compliance</span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Total GST:</span>
              <span className="font-mono text-purple-700">
                PKR {summary.totalGstPkr.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span>PG & Capital Cost:</span>
              <span className="font-mono">
                PKR {(summary.totalPgCostPkr + summary.totalCostOfCapitalPkr + summary.totalEmCostPkr).toFixed(2)}
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <span>Withholding Tax: PKR {summary.totalWhtPkr.toFixed(2)}</span>
            <span>Net Tax Burden</span>
          </div>
        </div>
      </div>

      {/* ACTIONS TOOLBAR */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleAddItem} className="h-9 gap-1.5 text-xs font-semibold shadow">
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

          {items.length > 0 ? (
            <button
              type="button"
              onClick={handleClearItems}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
            >
              Clear All Rows
            </button>
          ) : null}
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
                <span className="text-emerald-700 font-bold">Quote Copied!</span>
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

      {/* LINE ITEMS TABLE */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Quotation Line Items & Tax Architecture</h2>
            <p className="text-[11px] text-slate-500">
              Enter unit costs, cost basis, withholding taxes, and provincial GST rates. All values recalculate in real-time.
            </p>
          </div>
          <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-bold text-slate-700">
            {calculatedItems.length} Items ({calculatedItems.filter((i) => i.qty > 0).length} Active)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/90 text-slate-600 select-none">
              <tr>
                <th className="px-3 py-3 font-semibold w-12 text-center">#</th>
                <th className="px-3 py-3 font-semibold min-w-[200px]">Item Description</th>
                <th className="px-3 py-3 font-semibold min-w-[140px]">Cost Basis</th>
                <th className="px-3 py-3 font-semibold min-w-[110px] text-right">Entered Cost</th>
                <th className="px-3 py-3 font-semibold min-w-[110px] text-right">Unit Cost (PKR)</th>
                <th className="px-3 py-3 font-semibold w-20 text-center">GST Bill</th>
                <th className="px-3 py-3 font-semibold min-w-[140px]">Type (WHT)</th>
                <th className="px-3 py-3 font-semibold min-w-[180px]">GST Region</th>
                <th className="px-3 py-3 font-semibold w-20 text-center">Qty</th>
                <th className="px-3 py-3 font-semibold text-right min-w-[110px]">Price w/ Profit</th>
                <th className="px-3 py-3 font-semibold text-right min-w-[110px]">Price Incl WHT</th>
                <th className="px-3 py-3 font-semibold text-right min-w-[110px]">Price Incl GST</th>
                <th className="px-3 py-3 font-semibold text-right min-w-[120px] bg-slate-100/60 font-bold text-slate-900">
                  Unit Selling Price
                </th>
                <th className="px-3 py-3 font-semibold text-right min-w-[110px]">Selling Excl GST</th>
                <th className="px-3 py-3 font-semibold text-right min-w-[90px]">Unit GST</th>
                <th className="px-3 py-3 font-semibold text-right min-w-[130px] bg-emerald-50/70 font-bold text-emerald-950">
                  Total Incl GST
                </th>
                <th className="px-3 py-3 font-semibold text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {calculatedItems.length === 0 ? (
                <tr>
                  <td colSpan={17} className="py-12 text-center text-slate-500">
                    <p className="text-sm font-semibold">No items entered in this quotation.</p>
                    <p className="mt-1 text-xs">Click "+ Add Line Item" or "Reset to Sample Template" to get started.</p>
                  </td>
                </tr>
              ) : null}

              {calculatedItems.map((item: CalculatedLineItem, idx: number) => {
                const isActive = item.qty > 0;
                return (
                  <tr
                    key={item.id}
                    className={`transition hover:bg-slate-50/80 ${!isActive ? "bg-slate-50/40 opacity-60" : ""}`}
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
                        className="h-8 w-full rounded border border-transparent px-2 text-xs font-semibold text-slate-900 hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:outline-none"
                      />
                    </td>

                    {/* Cost Basis */}
                    <td className="px-3 py-2.5">
                      <select
                        value={item.costBasis}
                        onChange={(e) =>
                          handleUpdateItem(item.id, { costBasis: e.target.value as CostBasis })
                        }
                        className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 focus:border-brand-500 focus:outline-none"
                      >
                        <option value="PKR">PKR</option>
                        <option value="USD - Bank">USD - Bank (TT/DD)</option>
                        <option value="USD - Credit card">USD - Credit card (+6.5%)</option>
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
                        className="h-8 w-24 rounded border border-slate-200 bg-white px-2 text-right font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                      />
                    </td>

                    {/* Unit Cost PKR */}
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">
                      {item.unitCostPkr.toFixed(2)}
                    </td>

                    {/* GST Bill */}
                    <td className="px-3 py-2.5 text-center">
                      <select
                        value={item.gstBill}
                        onChange={(e) =>
                          handleUpdateItem(item.id, { gstBill: e.target.value as "Yes" | "No" })
                        }
                        className="h-8 rounded border border-slate-200 bg-white px-1.5 text-center text-xs font-semibold text-slate-700 focus:border-brand-500 focus:outline-none"
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
                        className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 focus:border-brand-500 focus:outline-none"
                      >
                        {WHT_PRESETS.map((p) => (
                          <option key={p.label} value={p.label}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* GST Region */}
                    <td className="px-3 py-2.5">
                      <select
                        value={item.gst}
                        onChange={(e) => {
                          const selected = GST_PRESETS.find((g) => g.label === e.target.value);
                          handleUpdateItem(item.id, {
                            gst: e.target.value,
                            gstRate: selected ? selected.rate : item.gstRate,
                          });
                        }}
                        className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 focus:border-brand-500 focus:outline-none"
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
                        className="h-8 w-16 rounded border border-slate-200 bg-white px-2 text-center font-mono text-xs font-bold text-slate-900 focus:border-brand-500 focus:outline-none"
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

                    {/* Unit Selling Price Incl Taxes */}
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-950 bg-slate-100/50">
                      {item.unitSellingPriceInclTaxes.toFixed(2)}
                    </td>

                    {/* Unit Selling Price Excl GST */}
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                      {item.unitSellingPriceExclGst.toFixed(2)}
                    </td>

                    {/* Unit GST */}
                    <td className="px-3 py-2.5 text-right font-mono text-purple-700 font-semibold">
                      {item.unitGst.toFixed(2)}
                    </td>

                    {/* Total Incl GST */}
                    <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-800 bg-emerald-50/50">
                      {item.totalInclGst.toFixed(2)}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicateItem(item)}
                          title="Duplicate item"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
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
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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
            {/* Table Footer Totals */}
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-xs text-slate-900">
              <tr>
                <td colSpan={4} className="px-3 py-3 text-right">
                  Summary Totals:
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-800">
                  PKR {summary.totalCostPkr.toFixed(2)}
                </td>
                <td colSpan={4} />
                <td colSpan={3} className="px-3 py-3 text-right text-slate-500">
                  Total Excl GST: PKR {summary.overallTotalExclGstPkr.toFixed(2)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-900 bg-slate-200/50">
                  —
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-900">
                  {summary.overallTotalExclGstPkr.toFixed(2)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-purple-700">
                  {summary.totalGstPkr.toFixed(2)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-emerald-800 text-sm bg-emerald-100/60">
                  PKR {summary.overallTotalInclGstPkr.toFixed(2)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* CALCULATION CHECKS & FORMULA EXPLANATION */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Tax & Markup Stack</h3>
          </div>
          <ul className="mt-3 space-y-2 text-xs text-slate-600">
            <li className="flex justify-between">
              <span>Unit Price with Profit:</span>
              <code className="font-mono font-medium text-slate-800">Cost × (1 + Margin)</code>
            </li>
            <li className="flex justify-between">
              <span>Unit Price Incl. WHT:</span>
              <code className="font-mono font-medium text-slate-800">Price × (1 + WHT%)</code>
            </li>
            <li className="flex justify-between">
              <span>Unit Price Incl. GST:</span>
              <code className="font-mono font-medium text-slate-800">WHT Price × (1 + GST%)</code>
            </li>
            <li className="flex justify-between">
              <span>Credit Card Forex:</span>
              <code className="font-mono font-medium text-slate-800">Bank Rate × 1.065</code>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Guarantee Joint Solver</h3>
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Total before PG/EM:</span>
              <span className="font-mono font-bold text-slate-800">PKR {summary.totalBeforePgEm.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Eligible Allocation Weight:</span>
              <span className="font-mono font-bold text-slate-800">PKR {summary.eligibleAllocationWeight.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Effective PG Amount:</span>
              <span className="font-mono text-purple-700">PKR {summary.effectivePG.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Effective EM Amount:</span>
              <span className="font-mono text-amber-700">PKR {summary.effectiveEM.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Financing & Profitability</h3>
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Total Working Capital Cost:</span>
              <span className="font-mono font-bold text-slate-800">PKR {summary.totalCostOfCapitalPkr.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total PG Financing Cost:</span>
              <span className="font-mono font-bold text-slate-800">PKR {summary.totalPgCostPkr.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total EM Financing Cost:</span>
              <span className="font-mono font-bold text-slate-800">PKR {summary.totalEmCostPkr.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-emerald-800">
              <span>Net Projected Profit:</span>
              <span className="font-mono">PKR {summary.netProfitPkr.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* MODALS & DRAWERS */}
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

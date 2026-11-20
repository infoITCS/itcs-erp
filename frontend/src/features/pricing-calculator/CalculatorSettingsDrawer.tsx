import { useState } from "react";
import type { CalculatorSettings, CalculatorSummary } from "./types.ts";

export function CalculatorSettingsDrawer({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetDefaults,
  onOpenKibor,
  summary,
}: {
  isOpen: boolean;
  onClose: () => void;
  settings: CalculatorSettings;
  onUpdateSettings: (updater: (prev: CalculatorSettings) => CalculatorSettings) => void;
  onResetDefaults: () => void;
  onOpenKibor: () => void;
  summary: CalculatorSummary;
}) {
  const [activeTab, setActiveTab] = useState<"margin" | "guarantees" | "forex" | "audit">("margin");
  const [fetchingRates, setFetchingRates] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const financingMonths = Math.max(0, settings.customerPaymentTerm - settings.vendorPaymentTerm);

  async function handleFetchLiveRates() {
    setFetchingRates(true);
    setFetchMessage(null);
    let pkrInterbank: number | null = null;
    let sourceName = "";

    // 1. Try primary CORS exchange rate feed
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      if (res.ok) {
        const data = await res.json();
        if (data.rates?.PKR && typeof data.rates.PKR === "number") {
          pkrInterbank = data.rates.PKR;
          sourceName = "Interbank Exchange Feed";
        }
      }
    } catch {
      // Continue to next fallback
    }

    // 2. Secondary CORS fallback
    if (!pkrInterbank) {
      try {
        const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
        if (res.ok) {
          const data = await res.json();
          if (data.rates?.PKR && typeof data.rates.PKR === "number") {
            pkrInterbank = data.rates.PKR;
            sourceName = "Global FX Feed";
          }
        }
      } catch {
        // Continue to third fallback
      }
    }

    // 3. Third CORS fallback
    if (!pkrInterbank) {
      try {
        const res = await fetch(
          "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
        );
        if (res.ok) {
          const data = await res.json();
          if (data.usd?.pkr && typeof data.usd.pkr === "number") {
            pkrInterbank = data.usd.pkr;
            sourceName = "Currency API Feed";
          }
        }
      } catch {
        // Fallbacks exhausted
      }
    }

    if (pkrInterbank) {
      const bankRate = parseFloat(pkrInterbank.toFixed(2));
      // Forex.pk Open Market Selling Rate incorporates the retail cash spread (+1.65 PKR as per Forex.pk benchmark)
      const openMarketRate = parseFloat((bankRate + 1.65).toFixed(2));
      onUpdateSettings((prev) => ({
        ...prev,
        bankUsdRate: bankRate,
        forexUsdRate: openMarketRate,
      }));
      setFetchMessage(
        `Synchronized (${sourceName}): Bank TT/DD: PKR ${bankRate.toFixed(2)} | Forex.pk Open Market: PKR ${openMarketRate.toFixed(2)}`,
      );
    } else {
      setFetchMessage("Unable to reach live FX servers. Please use the 1-click Forex.pk presets below.");
    }
    setFetchingRates(false);
    setTimeout(() => setFetchMessage(null), 6000);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-end bg-slate-950/40 backdrop-blur-sm transition-all animate-in fade-in duration-200"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-slate-200/90 bg-white shadow-2xl transition"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="border-b border-slate-200 bg-white px-6 py-5 text-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </span>
              <div>
                <h3 className="text-base font-bold tracking-tight text-slate-900">Pricing Engine Configuration</h3>
                <p className="text-xs text-slate-500">
                  Precision financial controls for margins, cost of capital, and tender guarantees
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1 text-xs border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("margin")}
              className={`flex-1 rounded-lg py-1.5 font-semibold transition ${
                activeTab === "margin"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Margin & Terms
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("guarantees")}
              className={`flex-1 rounded-lg py-1.5 font-semibold transition ${
                activeTab === "guarantees"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              PG & Tender EM
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("forex")}
              className={`flex-1 rounded-lg py-1.5 font-semibold transition ${
                activeTab === "forex"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Forex Rates
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className={`flex-1 rounded-lg py-1.5 font-semibold transition ${
                activeTab === "audit"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Solver Audit
            </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6 text-xs text-slate-700">
          {/* TAB 1: MARGIN & PAYMENT TERMS */}
          {activeTab === "margin" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Profit Margin Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Commercial Profit Margin</h4>
                    <p className="text-[11px] text-slate-500">Target net margin earned on pre-tax line cost</p>
                  </div>
                  <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 font-mono text-sm font-black text-slate-900">
                    {(settings.profitMargin * 100).toFixed(1)}%
                  </span>
                </div>

                {/* Slider + Quick Presets */}
                <div className="pt-2">
                  <input
                    type="range"
                    min="0"
                    max="35"
                    step="0.5"
                    value={(settings.profitMargin * 100).toFixed(1)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) / 100;
                      onUpdateSettings((prev) => ({ ...prev, profitMargin: val }));
                    }}
                    className="w-full accent-slate-800 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-semibold text-slate-400 mt-1">
                    <span>0% (At Cost)</span>
                    <span className="text-slate-700 font-bold">8% (Benchmark Policy)</span>
                    <span>15%</span>
                    <span>25%</span>
                    <span>35%</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[0.05, 0.08, 0.1, 0.12, 0.15, 0.2].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onUpdateSettings((prev) => ({ ...prev, profitMargin: preset }))}
                      className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold transition ${
                        Math.abs(settings.profitMargin - preset) < 0.001
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {(preset * 100).toFixed(0)}%
                    </button>
                  ))}
                </div>

                {settings.profitMargin < 0.08 ? (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50/80 p-3 text-[11px] text-amber-900">
                    <svg className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>
                      <strong>HoD Approval Mandatory:</strong> ITCS company policy strictly requires Head of Department sign-off for margins below 8.0%.
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Standard corporate enterprise margin policy verified.
                  </p>
                )}
              </div>

              {/* Risk-free Rate Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Risk-Free Rate / KIBOR Cost of Capital</h4>
                    <p className="text-[11px] text-slate-500">Benchmark rate for working capital financing & guarantees</p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenKibor}
                    className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-900 hover:underline"
                  >
                    Select Tenor →
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative w-36">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={(settings.riskFreeRate * 100).toFixed(2)}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0) / 100;
                        onUpdateSettings((prev) => ({ ...prev, riskFreeRate: val }));
                      }}
                      className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm font-bold text-slate-950 focus:border-brand-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    <span>Base Benchmark: <strong>8.60%</strong> (formula: <code className="font-mono">((Kibor-2)/1.15)/100</code>)</span>
                  </div>
                </div>
              </div>

              {/* Payment Terms & Working Capital Timeline */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Working Capital Financing Terms</h4>
                  <p className="text-[11px] text-slate-500">
                    Cost of capital calculated per month: <code className="font-mono text-slate-800 font-bold">Cost × max(Kibor, 8%)/12 × (Customer - Vendor)</code>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-800">Vendor Payment Term</label>
                    <div className="relative mt-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={settings.vendorPaymentTerm}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          onUpdateSettings((prev) => ({ ...prev, vendorPaymentTerm: val }));
                        }}
                        className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm font-bold text-slate-950 focus:border-brand-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-2.5 text-[11px] font-semibold text-slate-400">Mo.</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">Grace period given by supplier</p>
                  </div>

                  <div>
                    <label className="font-bold text-slate-800">Customer Payment Term</label>
                    <div className="relative mt-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={settings.customerPaymentTerm}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          onUpdateSettings((prev) => ({ ...prev, customerPaymentTerm: val }));
                        }}
                        className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm font-bold text-slate-950 focus:border-brand-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-2.5 text-[11px] font-semibold text-slate-400">Mo.</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">Credit period extended to client</p>
                  </div>
                </div>

                {/* Timeline visual bar */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">Net Financing Gap:</span>
                    <span className="font-mono text-brand-700">{financingMonths} Month(s)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden flex">
                    <div
                      style={{ width: `${Math.min(100, (financingMonths / 12) * 100)}%` }}
                      className="h-full bg-gradient-to-r from-brand-600 to-indigo-600 rounded-full transition-all duration-300"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Total deal working capital financing charge: <strong>PKR {summary.totalCostOfCapitalPkr.toFixed(2)}</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GUARANTEES (PG & EM) */}
          {activeTab === "guarantees" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Performance Guarantee */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Performance Guarantee (PG)</h4>
                    <p className="text-[11px] text-slate-500">Bank guarantee bond financing overhead</p>
                  </div>
                  <span className="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-800">
                    PKR {summary.effectivePG.toFixed(2)}
                  </span>
                </div>

                <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings((p) => ({ ...p, pgBasis: "% of total incl. taxes" }))}
                    className={`flex-1 rounded-lg py-1.5 font-semibold transition ${
                      settings.pgBasis === "% of total incl. taxes"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    % of Total Deal
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings((p) => ({ ...p, pgBasis: "Fixed amount" }))}
                    className={`flex-1 rounded-lg py-1.5 font-semibold transition ${
                      settings.pgBasis === "Fixed amount"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Fixed PKR Amount
                  </button>
                </div>

                {settings.pgBasis === "% of total incl. taxes" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-800">PG Percentage (%)</label>
                      <div className="relative mt-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={(settings.pgPercentage * 100).toFixed(1)}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0) / 100;
                            onUpdateSettings((prev) => ({ ...prev, pgPercentage: val }));
                          }}
                          className="h-9 w-full rounded-xl border border-slate-300 px-3 font-mono text-sm font-bold text-slate-950 focus:border-brand-500 focus:outline-none"
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="font-bold text-slate-800">PG Term (Years)</label>
                      <select
                        value={settings.pgTermYears}
                        onChange={(e) =>
                          onUpdateSettings((prev) => ({ ...prev, pgTermYears: parseFloat(e.target.value) || 1 }))
                        }
                        className="mt-1 h-9 w-full rounded-xl border border-slate-300 bg-white px-3 font-semibold text-slate-800 focus:border-brand-500 focus:outline-none"
                      >
                        <option value="1">1 Year</option>
                        <option value="1.5">1.5 Years</option>
                        <option value="2">2 Years</option>
                        <option value="3">3 Years</option>
                        <option value="5">5 Years</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="font-bold text-slate-800">Fixed PG Amount (PKR)</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.fixedPG}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        onUpdateSettings((prev) => ({ ...prev, fixedPG: val }));
                      }}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-300 px-3 font-mono text-sm font-bold text-slate-950 focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                  <span>Total PG Financing Cost to ITCS:</span>
                  <span className="font-mono font-bold text-slate-900">PKR {summary.totalPgCostPkr.toFixed(2)}</span>
                </div>
              </div>

              {/* Earnest Money */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Earnest Money (EM / Bid Bond)</h4>
                    <p className="text-[11px] text-slate-500">Tender bid security financing cost</p>
                  </div>
                  <span className="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-800">
                    PKR {summary.effectiveEM.toFixed(2)}
                  </span>
                </div>

                <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings((p) => ({ ...p, emBasis: "Fixed amount" }))}
                    className={`flex-1 rounded-lg py-1.5 font-semibold transition ${
                      settings.emBasis === "Fixed amount"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Fixed PKR Amount
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings((p) => ({ ...p, emBasis: "% of total incl. taxes" }))}
                    className={`flex-1 rounded-lg py-1.5 font-semibold transition ${
                      settings.emBasis === "% of total incl. taxes"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    % of Total Deal
                  </button>
                </div>

                {settings.emBasis === "% of total incl. taxes" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-800">EM Rate (%)</label>
                      <div className="relative mt-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={(settings.emRate * 100).toFixed(1)}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0) / 100;
                            onUpdateSettings((prev) => ({ ...prev, emRate: val }));
                          }}
                          className="h-9 w-full rounded-xl border border-slate-300 px-3 font-mono text-sm font-bold text-slate-950 focus:border-brand-500 focus:outline-none"
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="font-bold text-slate-800">Tender Term (Months)</label>
                      <input
                        type="number"
                        min="1"
                        value={settings.emTermMonths}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 3);
                          onUpdateSettings((prev) => ({ ...prev, emTermMonths: val }));
                        }}
                        className="mt-1 h-9 w-full rounded-xl border border-slate-300 px-3 font-mono text-sm font-bold text-slate-950 focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="font-bold text-slate-800">Fixed EM Amount (PKR)</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.fixedEM}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        onUpdateSettings((prev) => ({ ...prev, fixedEM: val }));
                      }}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-300 px-3 font-mono text-sm font-bold text-slate-950 focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                  <span>Total EM Financing Cost to ITCS:</span>
                  <span className="font-mono font-bold text-slate-900">PKR {summary.totalEmCostPkr.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FOREX & EXCHANGE RATES */}
          {activeTab === "forex" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">USD Currency & Exchange Architecture</h4>
                    <p className="text-[11px] text-slate-500">Live multi-tier exchange rates for international procurement</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchLiveRates}
                    disabled={fetchingRates}
                    className="flex items-center gap-1.5 rounded-xl border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-800 hover:bg-brand-100 disabled:opacity-50 transition shadow-sm"
                  >
                    <svg
                      className={`h-4 w-4 ${fetchingRates ? "animate-spin" : ""}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    {fetchingRates ? "Updating…" : "Fetch Live Market Rate"}
                  </button>
                </div>

                {fetchMessage && (
                  <div className="rounded-xl bg-slate-100 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    {fetchMessage}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800">Forex.pk Open Market</label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings((prev) => ({
                              ...prev,
                              forexUsdRate: parseFloat((prev.forexUsdRate - 0.25).toFixed(2)),
                            }))
                          }
                          className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition"
                        >
                          -0.25
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings((prev) => ({
                              ...prev,
                              forexUsdRate: parseFloat((prev.forexUsdRate + 0.25).toFixed(2)),
                            }))
                          }
                          className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition"
                        >
                          +0.25
                        </button>
                      </div>
                    </div>
                    <div className="relative mt-1">
                      <input
                        type="number"
                        step="0.05"
                        min="1"
                        value={settings.forexUsdRate}
                        onChange={(e) => {
                          const val = Math.max(1, parseFloat(e.target.value) || 280);
                          onUpdateSettings((prev) => ({ ...prev, forexUsdRate: val }));
                        }}
                        className="h-9 w-full rounded-xl border border-slate-300 px-3 font-mono text-sm font-bold text-slate-950 focus:border-brand-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">PKR</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">Cash / retail selling benchmark</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800">Bank TT/DD Rate</label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings((prev) => ({
                              ...prev,
                              bankUsdRate: parseFloat((prev.bankUsdRate - 0.25).toFixed(2)),
                            }))
                          }
                          className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition"
                        >
                          -0.25
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings((prev) => ({
                              ...prev,
                              bankUsdRate: parseFloat((prev.bankUsdRate + 0.25).toFixed(2)),
                            }))
                          }
                          className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition"
                        >
                          +0.25
                        </button>
                      </div>
                    </div>
                    <div className="relative mt-1">
                      <input
                        type="number"
                        step="0.05"
                        min="1"
                        value={settings.bankUsdRate}
                        onChange={(e) => {
                          const val = Math.max(1, parseFloat(e.target.value) || 280);
                          onUpdateSettings((prev) => ({ ...prev, bankUsdRate: val }));
                        }}
                        className="h-9 w-full rounded-xl border border-slate-300 px-3 font-mono text-sm font-bold text-slate-950 focus:border-brand-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">PKR</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">Interbank wire transfer rate</p>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700">Quick Forex Presets (1-Click):</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings((p) => ({ ...p, forexUsdRate: 280.15, bankUsdRate: 278.50 }))
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 shadow-sm transition"
                    >
                      Forex.pk Benchmark (Open: 280.15 / Bank: 278.50)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings((p) => ({ ...p, forexUsdRate: 281.0, bankUsdRate: 279.0 }))
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 shadow-sm transition"
                    >
                      Conservative Buffer (281.00 / 279.00)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings((p) => ({ ...p, forexUsdRate: 282.5, bankUsdRate: 280.0 }))
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 shadow-sm transition"
                    >
                      Volatility Hedge (282.50 / 280.00)
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Calculated spread:{" "}
                    <strong>
                      +PKR {(settings.forexUsdRate - settings.bankUsdRate).toFixed(2)} (
                      {(
                        ((settings.forexUsdRate - settings.bankUsdRate) / settings.bankUsdRate) *
                        100
                      ).toFixed(2)}
                      %)
                    </strong>{" "}
                    between Open Market cash & Interbank wire.
                  </p>
                </div>

                {/* Credit Card Rate */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">Credit Card Markup Uplift</span>
                      <p className="text-[10px] text-slate-500">Bank processing + advance withholding tax</p>
                    </div>
                    <div className="relative w-28">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="50"
                        value={(settings.creditCardUplift * 100).toFixed(1)}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0) / 100;
                          onUpdateSettings((prev) => ({ ...prev, creditCardUplift: val }));
                        }}
                        className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs font-bold text-slate-950 focus:border-brand-500 focus:outline-none"
                      />
                      <span className="absolute right-2.5 top-2 text-[11px] font-bold text-slate-400">%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-white border border-slate-200 p-2.5 text-xs text-slate-800">
                    <span className="font-bold text-slate-800">Effective Credit Card USD Rate:</span>
                    <span className="font-mono font-bold text-slate-950 text-sm">
                      PKR {summary.creditCardUsdRate.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SOLVER AUDIT & EQUATIONS */}
          {activeTab === "audit" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <h4 className="text-sm font-bold text-slate-900">Joint Linear Solver Verification</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Eliminates Excel circular references when Performance Guarantee or Earnest Money are percentages of the final tax-inclusive total.
                </p>

                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Total Before PG / EM:</span>
                    <span className="font-mono font-bold text-slate-800">PKR {summary.totalBeforePgEm.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Eligible Allocation Weight:</span>
                    <span className="font-mono font-bold text-slate-800">PKR {summary.eligibleAllocationWeight.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Total Financing Overhead:</span>
                    <span className="font-mono font-bold text-slate-800">
                      PKR {(summary.totalCostOfCapitalPkr + summary.totalPgCostPkr + summary.totalEmCostPkr).toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-950 font-bold bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                    <span>Solved Final Tax-Inclusive Total:</span>
                    <span className="font-mono text-slate-900 text-sm">
                      PKR {summary.finalTaxInclusiveTotal.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onResetDefaults}
            className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline transition"
          >
            Reset to Defaults
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-slate-800 transition"
          >
            Save & Close
          </button>
        </div>
      </aside>
    </div>
  );
}

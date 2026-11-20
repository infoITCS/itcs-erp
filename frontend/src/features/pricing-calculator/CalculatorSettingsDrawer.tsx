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
  if (!isOpen) return null;

  const financingDays = Math.max(0, settings.customerPaymentTerm - settings.vendorPaymentTerm);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-end bg-slate-950/30 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl transition"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-200">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Pricing & Calculator Parameters</h3>
              <p className="text-[11px] text-slate-500">Live configuration for margins, terms, guarantees & forex</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable Settings Form */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6 text-xs">
          {/* PRICING & PAYMENT TERMS */}
          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
              <h4 className="font-bold uppercase tracking-wider text-slate-600">Pricing & Payment Terms</h4>
              <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">Financial Terms</span>
            </div>

            {/* Profit Margin */}
            <div>
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700">Profit Margin (%)</label>
                <span className="font-mono font-bold text-brand-700">{(settings.profitMargin * 100).toFixed(1)}%</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={(settings.profitMargin * 100).toFixed(1)}
                  onChange={(e) => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0) / 100;
                    onUpdateSettings((prev) => ({ ...prev, profitMargin: val }));
                  }}
                  className="h-8 w-28 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <input
                  type="range"
                  min="1"
                  max="40"
                  step="0.5"
                  value={settings.profitMargin * 100}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) / 100;
                    onUpdateSettings((prev) => ({ ...prev, profitMargin: val }));
                  }}
                  className="flex-1 accent-brand-600"
                />
              </div>
              {settings.profitMargin < 0.08 ? (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] font-medium text-amber-800">
                  <svg className="h-4 w-4 shrink-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>HoD approval for margin below 8% is mandatory.</span>
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-slate-500">Standard enterprise target: 8.0%+</p>
              )}
            </div>

            {/* Risk-free Rate */}
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700">Risk-free Rate / Cost of Capital (%)</label>
                <button
                  type="button"
                  onClick={onOpenKibor}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 hover:underline"
                >
                  Browse KIBOR tenors →
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
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
                  className="h-8 w-28 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500">Benchmark: 8.60% (KIBOR rate basis)</span>
              </div>
            </div>

            {/* Payment Terms */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="font-semibold text-slate-700">Vendor Payment Term (Days)</label>
                <input
                  type="number"
                  min="0"
                  value={settings.vendorPaymentTerm}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    onUpdateSettings((prev) => ({ ...prev, vendorPaymentTerm: val }));
                  }}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Customer Payment Term (Days)</label>
                <input
                  type="number"
                  min="0"
                  value={settings.customerPaymentTerm}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    onUpdateSettings((prev) => ({ ...prev, customerPaymentTerm: val }));
                  }}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white p-2 border border-slate-200/80 text-[11px]">
              <span className="text-slate-500">Net Working Capital Financing Days:</span>
              <span className="font-mono font-bold text-slate-800">{financingDays} Days</span>
            </div>
          </section>

          {/* PERFORMANCE GUARANTEE */}
          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
              <h4 className="font-bold uppercase tracking-wider text-slate-600">Performance Guarantee (PG)</h4>
              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">Bank Guarantee</span>
            </div>

            <div>
              <label className="font-semibold text-slate-700">Calculation Basis</label>
              <select
                value={settings.pgBasis}
                onChange={(e) =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    pgBasis: e.target.value as "% of total incl. taxes" | "Fixed amount",
                  }))
                }
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-semibold text-slate-800 focus:border-brand-500 focus:outline-none"
              >
                <option value="% of total incl. taxes">% of Total Incl. Taxes (Solved Jointly)</option>
                <option value="Fixed amount">Fixed PKR Amount</option>
              </select>
            </div>

            {settings.pgBasis === "% of total incl. taxes" ? (
              <div>
                <label className="font-semibold text-slate-700">PG Percentage (%)</label>
                <div className="mt-1 flex items-center gap-2">
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
                    className="h-8 w-28 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500">e.g. 5% or 10% of contract value</span>
                </div>
              </div>
            ) : (
              <div>
                <label className="font-semibold text-slate-700">Fixed PG Amount (PKR)</label>
                <input
                  type="number"
                  min="0"
                  value={settings.fixedPG}
                  onChange={(e) => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                    onUpdateSettings((prev) => ({ ...prev, fixedPG: val }));
                  }}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="font-semibold text-slate-700">PG Term (Years)</label>
              <input
                type="number"
                step="0.5"
                min="0.1"
                value={settings.pgTermYears}
                onChange={(e) => {
                  const val = Math.max(0.1, parseFloat(e.target.value) || 1);
                  onUpdateSettings((prev) => ({ ...prev, pgTermYears: val }));
                }}
                className="mt-1 h-8 w-32 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">e.g. 1 Year, 1.5 Years, 3 Years</p>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-purple-50/60 p-2 border border-purple-200/60 text-[11px]">
              <span className="text-purple-800">Effective Performance Guarantee:</span>
              <span className="font-mono font-bold text-purple-950">
                PKR {summary.effectivePG.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </section>

          {/* EARNEST MONEY */}
          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
              <h4 className="font-bold uppercase tracking-wider text-slate-600">Earnest Money (EM / Bid Bond)</h4>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Tender Security</span>
            </div>

            <div>
              <label className="font-semibold text-slate-700">Calculation Basis</label>
              <select
                value={settings.emBasis}
                onChange={(e) =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    emBasis: e.target.value as "Fixed amount" | "% of total incl. taxes",
                  }))
                }
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-semibold text-slate-800 focus:border-brand-500 focus:outline-none"
              >
                <option value="Fixed amount">Fixed PKR Amount</option>
                <option value="% of total incl. taxes">% of Total Incl. Taxes</option>
              </select>
            </div>

            {settings.emBasis === "% of total incl. taxes" ? (
              <div>
                <label className="font-semibold text-slate-700">Earnest Money Rate (%)</label>
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
                  className="mt-1 h-8 w-28 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="font-semibold text-slate-700">Fixed Earnest Money Amount (PKR)</label>
                <input
                  type="number"
                  min="0"
                  value={settings.fixedEM}
                  onChange={(e) => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                    onUpdateSettings((prev) => ({ ...prev, fixedEM: val }));
                  }}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg bg-amber-50/60 p-2 border border-amber-200/60 text-[11px]">
              <span className="text-amber-800">Effective Earnest Money:</span>
              <span className="font-mono font-bold text-amber-950">
                PKR {summary.effectiveEM.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </section>

          {/* EXCHANGE RATES */}
          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
              <h4 className="font-bold uppercase tracking-wider text-slate-600">Exchange Rates (USD / PKR)</h4>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Forex Conversion</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700">Forex.pk Open Market (PKR)</label>
                <input
                  type="number"
                  step="0.05"
                  min="1"
                  value={settings.forexUsdRate}
                  onChange={(e) => {
                    const val = Math.max(1, parseFloat(e.target.value) || 280);
                    onUpdateSettings((prev) => ({ ...prev, forexUsdRate: val }));
                  }}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-slate-400">Open market selling rate</p>
              </div>
              <div>
                <label className="font-semibold text-slate-700">Bank USD Rate (PKR)</label>
                <input
                  type="number"
                  step="0.05"
                  min="1"
                  value={settings.bankUsdRate}
                  onChange={(e) => {
                    const val = Math.max(1, parseFloat(e.target.value) || 280);
                    onUpdateSettings((prev) => ({ ...prev, bankUsdRate: val }));
                  }}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-slate-400">Bank TT/DD rate</p>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700">Credit Card Uplift (%)</label>
              <div className="mt-1 flex items-center gap-2">
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
                  className="h-8 w-28 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500">6.5% standard bank & tax surcharge</span>
              </div>
            </div>

            <div className="rounded-lg bg-emerald-50/80 p-2.5 border border-emerald-200/80">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-emerald-800">Effective Credit Card USD Rate:</span>
                <span className="font-mono font-bold text-emerald-950">
                  PKR {summary.creditCardUsdRate.toFixed(4)}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-emerald-700">
                Formula: Bank Rate ({settings.bankUsdRate}) × (1 + {(settings.creditCardUplift * 100).toFixed(1)}%)
              </p>
            </div>
          </section>

          {/* CALCULATION CHECKS */}
          <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px]">
            <p className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">Verification & Checks</p>
            <div className="flex justify-between text-slate-600">
              <span>Total before PG / EM:</span>
              <span className="font-mono font-medium">PKR {summary.totalBeforePgEm.toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Eligible Allocation Weight:</span>
              <span className="font-mono font-medium">PKR {summary.eligibleAllocationWeight.toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1">
              <span>Final Solved Total:</span>
              <span className="font-mono">PKR {summary.finalTaxInclusiveTotal.toFixed(4)}</span>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onResetDefaults}
            className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline"
          >
            Reset to Standard Defaults
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-slate-800"
          >
            Apply & Return to Calculator
          </button>
        </div>
      </aside>
    </div>
  );
}

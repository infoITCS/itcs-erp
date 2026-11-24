import { KIBOR_RATES } from "./calculator-logic.ts";
import type { KiborRate } from "./types.ts";

export function KiborRatesModal({
  isOpen,
  onClose,
  onSelectRate,
  currentRate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectRate: (rate: number, tenor: string) => void;
  currentRate: number;
}) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
              </span>
              <h3 className="text-base font-semibold text-slate-900">KIBOR Benchmark Rates</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              State Bank of Pakistan / Karachi Interbank Offered Rate benchmarks. Click any tenor offer to set as Risk-Free Rate.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3.5 py-2.5 text-left font-semibold">Tenor</th>
                <th className="px-3.5 py-2.5 text-right font-semibold">Bid Rate (%)</th>
                <th className="px-3.5 py-2.5 text-right font-semibold">Offer Rate (%)</th>
                <th className="px-3.5 py-2.5 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {KIBOR_RATES.map((k: KiborRate) => {
                const isSelected = Math.abs(currentRate - k.offer / 100) < 0.0001;
                return (
                  <tr key={k.tenor} className="hover:bg-slate-50/70 transition">
                    <td className="px-3.5 py-2.5 font-medium text-slate-900">{k.tenor}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-slate-600">
                      {k.bid.toFixed(2)}%
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-brand-700">
                      {k.offer.toFixed(2)}%
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectRate(k.offer / 100, k.tenor);
                          onClose();
                        }}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                          isSelected
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                        }`}
                      >
                        {isSelected ? "Active" : "Use Offer"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live financial benchmark reference
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

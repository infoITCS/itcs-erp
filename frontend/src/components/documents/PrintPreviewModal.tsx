import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button.tsx";
import {
  PrintableDocument,
  type PrintableDocumentProps,
} from "./PrintableDocument.tsx";

export function PrintPreviewModal({
  isOpen,
  onClose,
  docProps,
}: {
  isOpen: boolean;
  onClose: () => void;
  docProps: PrintableDocumentProps;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/70 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      {/* Top Action Bar (Hidden when printing) */}
      <div
        className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-6 py-3.5 text-white shadow-md print:hidden shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
          </span>
          <div>
            <h2 className="text-sm font-bold text-white">
              Official Document Print &amp; PDF Export
            </h2>
            <p className="text-[11px] text-slate-400">
              {docProps.type} #{docProps.documentNumber} · Verified Format
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/settings"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            ⚙️ Edit Template &amp; Logo
          </Link>

          <Button
            onClick={handlePrint}
            className="h-9 gap-1.5 bg-brand-600 hover:bg-brand-500 font-bold text-xs shadow-lg shadow-brand-900/30 text-white"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print / Save as PDF
          </Button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close Preview"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Document Scrollable Container */}
      <div
        className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center print:p-0 print:m-0 print:overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        <div ref={contentRef} className="w-full max-w-[850px] print:max-w-none">
          <PrintableDocument {...docProps} />
        </div>
      </div>

      {/* Print-specific style overrides */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-document-container,
          .print-document-container * {
            visibility: visible;
          }
          .print-document-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: A4;
            margin: 15mm 15mm 15mm 15mm;
          }
        }
      `}</style>
    </div>
  );
}

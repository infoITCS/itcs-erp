import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-3 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="grid w-full max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        style={{ maxHeight: "calc(100dvh - 1.5rem)" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 id="modal-title" className="truncate text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button type="button" className="shrink-0 text-sm text-slate-500 hover:text-slate-800" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

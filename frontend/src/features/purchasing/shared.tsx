import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/Input.tsx";
import {
  Detail,
  Metric,
  Panel,
  StatusPill,
  computeDocumentTotals,
  computeLineTotals,
  emptyLine,
  formatDate,
  formatMoney,
  LinesEditor,
  statusLabel,
  type DocumentLineInput,
  type Page,
} from "../sales/shared.tsx";
import type { PurchaseOrder, PurchaseOrderLine, VendorBill, VendorPayment } from "./api.ts";

export {
  Detail,
  Metric,
  Panel,
  StatusPill,
  computeDocumentTotals,
  computeLineTotals,
  emptyLine,
  formatDate,
  formatMoney,
  LinesEditor,
  statusLabel,
};
export type { DocumentLineInput, Page };

export function MetricCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-slate-950" title={value}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </>
  );
  const className = "block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow";

  return href ? (
    <Link to={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function PageHeader({
  section,
  title,
  description,
  actions,
}: {
  section: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col items-start justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          {section}
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>
      </div>
      {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div> : null}
    </header>
  );
}

export function ListFilters({
  q,
  onSearch,
  status,
  onStatus,
  statuses,
  includeDeleted,
  onIncludeDeleted,
  extra,
  statusFilterLabel = "Status",
}: {
  q: string;
  onSearch: (value: string) => void;
  status: string;
  onStatus: (value: string) => void;
  statuses: string[];
  includeDeleted?: boolean;
  onIncludeDeleted?: (value: boolean) => void;
  extra?: ReactNode;
  statusFilterLabel?: string;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_200px_220px]">
        <Input
          className="h-10"
          type="search"
          aria-label="Search records"
          value={q}
          placeholder="Search by number, reference or vendor"
          onChange={(event) => onSearch(event.target.value)}
        />
        <select
          aria-label={`Filter by ${statusFilterLabel.toLowerCase()}`}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
          value={status}
          onChange={(event) => onStatus(event.target.value)}
        >
          <option value="">All {statusFilterLabel.toLowerCase()}s</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {statusFilterLabel === "Status" ? statusLabel(value) : value}
            </option>
          ))}
        </select>
        {extra ?? <span />}
      </div>
      {onIncludeDeleted ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <label className="inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-sm text-slate-700">
            <input
              className="accent-brand-800"
              type="checkbox"
              checked={Boolean(includeDeleted)}
              onChange={(event) => onIncludeDeleted(event.target.checked)}
            />
            Include deleted records
          </label>
        </div>
      ) : null}
    </section>
  );
}

export function WorkflowSteps({ steps }: { steps: Array<{ label: string; description: string; href?: string }> }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Procure-to-pay workflow</h2>
        <span className="text-xs text-slate-500">Five steps, one source of truth</span>
      </div>
      <ol className="grid gap-3 md:grid-cols-5">
        {steps.map((step, index) => {
          const body = (
            <>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-800 ring-1 ring-brand-100">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{step.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{step.description}</span>
              </span>
            </>
          );
          return (
            <li key={step.label}>
              {step.href ? (
                <Link to={step.href} className="flex h-full items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-brand-300 hover:bg-brand-50/40">
                  {body}
                </Link>
              ) : (
                <div className="flex h-full items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function DocumentNumber({ order }: { order: PurchaseOrder }) {
  return <>{order.purchaseOrderNumber ?? order.orderNumber ?? order.id.slice(0, 8)}</>;
}

export function docNumber(value: { purchaseOrderNumber?: string | null; orderNumber?: string | null; receiptNumber?: string | null; billNumber?: string | null; paymentNumber?: string | null; id: string }): string {
  return value.purchaseOrderNumber ?? value.orderNumber ?? value.receiptNumber ?? value.billNumber ?? value.paymentNumber ?? value.id.slice(0, 8);
}

export function numberValue(value: string | null | undefined): number {
  return Number(value ?? 0) || 0;
}

export function billBalance(bill: VendorBill): number {
  if (bill.balance != null) {
    return numberValue(bill.balance);
  }
  return Math.max(numberValue(bill.total) - numberValue(bill.amountPaid), 0);
}

export function paymentAllocated(payment: VendorPayment): number {
  return (payment.allocations ?? []).reduce((sum, line) => sum + numberValue(line.amount), 0);
}

export function remainingQuantity(line: PurchaseOrderLine): number {
  return Math.max(numberValue(line.quantity) - numberValue(line.receivedQuantity), 0);
}

export function formatQuantity(value: string | number | null | undefined): string {
  return (Number(value ?? 0) || 0).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function statusOptions(values: readonly string[]): Array<{ value: string; label: string }> {
  return values.map((value) => ({ value, label: statusLabel(value) }));
}

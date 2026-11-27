import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { PrintableDocumentProps } from "@/components/documents/PrintableDocument.tsx";
import { Button } from "@/components/ui/Button.tsx";
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

export const PURCHASE_ORDER_MANUAL_STATUSES = ["APPROVED", "SENT", "CLOSED", "CANCELLED"] as const;
export const PURCHASING_APPROVE_PERMISSION = "purchasing:approve";
export const PURCHASING_UPDATE_PERMISSION = "purchasing:update";
export const PURCHASING_RESTORE_PERMISSION = "purchasing:restore";
export const INVENTORY_READ_PERMISSION = "inventory:read";
export const INVENTORY_MANAGE_PERMISSION = "inventory:manage";
export const VENDOR_UPDATE_PERMISSION = "vendors:update";
export const VENDOR_RESTORE_PERMISSION = "vendors:restore";

export function LoadingState({ label = "Loading records…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-700" />
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="text-xs text-slate-500">Preparing the latest information.</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  backTo = "/",
  backLabel = "Back to overview",
}: {
  message: string;
  onRetry?: () => void;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-sm font-semibold text-red-700 ring-1 ring-red-200">!</span>
      <div>
        <p className="text-sm font-semibold text-slate-900">Unable to load this view</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-600">{message}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry}>Retry</Button>
        ) : null}
        <Link className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-brand-800 hover:bg-brand-50" to={backTo}>
          {backLabel}
        </Link>
      </div>
    </div>
  );
}

export function EmptyState({
  title = "Nothing to show yet",
  description,
  onClear,
  action,
  backTo,
  backLabel = "Back to overview",
}: {
  title?: string;
  description: string;
  onClear?: () => void;
  action?: ReactNode;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">0</span>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-600">{description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onClear ? (
          <Button variant="secondary" onClick={onClear}>Clear filters</Button>
        ) : null}
        {action}
        {backTo ? (
          <Link className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-brand-800 hover:bg-brand-50" to={backTo}>
            {backLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function UnauthorizedState({
  message = "You do not have permission to view this area. Ask an administrator for access if you need it.",
  backTo = "/",
  backLabel = "Back to overview",
}: {
  message?: string;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">!</span>
      <h1 className="text-xl font-semibold text-slate-950">Access restricted</h1>
      <p className="text-sm text-slate-600">{message}</p>
      <Link to={backTo}>
        <Button className="mt-2" variant="secondary">{backLabel}</Button>
      </Link>
    </div>
  );
}

export function RowLink({
  to,
  children,
  muted = false,
}: {
  to: string;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`rounded px-2 py-1.5 font-medium hover:underline ${muted ? "text-slate-700 hover:bg-slate-100" : "text-brand-800 hover:bg-brand-50"}`}
    >
      {children}
    </Link>
  );
}

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
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600 ring-2 ring-brand-100" />
      </div>
      <p className="mt-2 truncate text-2xl font-semibold leading-tight tabular-nums text-slate-950" title={value}>
        {value}
      </p>
      <p className="mt-1.5 text-xs text-slate-500">{hint ?? "Current view"}</p>
    </>
  );
  const className =
    "block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-200";

  return href ? (
    <Link to={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

export function useFilterParams(keys: readonly string[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters: Record<string, string> = {};
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value) {
      filters[key] = value;
    }
  }

  function apply(mutator: (next: URLSearchParams) => void) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        mutator(next);
        return next;
      },
      { replace: true },
    );
  }

  function setFilter(key: string, value: string) {
    apply((next) => {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    });
  }

  function clearFilters(except: string[] = []) {
    apply((next) => {
      for (const key of keys) {
        if (!except.includes(key)) {
          next.delete(key);
        }
      }
    });
  }

  return { filters, setFilter, clearFilters, searchParams };
}

export function optionLabel(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const option = value as { label?: string; name?: string; value?: string };
    return option.label ?? option.name ?? option.value ?? "";
  }
  return "";
}

export function optionValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const option = value as { value?: string; id?: string; code?: string };
    return option.value ?? option.id ?? option.code ?? "";
  }
  return "";
}

export interface PrintableInputLine {
  id?: string;
  name: string;
  description?: string | null;
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  lineTotal?: string | number | null;
  taxAmount?: string | number | null;
}

export function buildPrintableProps({
  type,
  documentNumber,
  date,
  dueDate,
  paymentTerms,
  partyName,
  partyAddress,
  taxId,
  lines,
  subtotal,
  taxAmount,
  total,
  notes,
  currencyCode,
}: {
  type: string;
  documentNumber: string;
  date: string;
  dueDate?: string;
  paymentTerms?: string;
  partyName: string;
  partyAddress?: string;
  taxId?: string;
  lines: PrintableInputLine[];
  subtotal?: string | number | null;
  taxAmount?: string | number | null;
  total: string | number | null;
  notes?: string | null;
  currencyCode?: string;
}): PrintableDocumentProps {
  return {
    type: type as PrintableDocumentProps["type"],
    documentNumber,
    date,
    validUntilOrDueDate: dueDate,
    paymentTerms: paymentTerms ?? "Due on receipt",
    customer: {
      name: partyName,
      billingAddress: partyAddress ? { street: partyAddress } : undefined,
      taxpayerId: taxId,
    },
    lines: lines.map((line) => ({
      id: line.id,
      name: line.name,
      description: line.description ?? undefined,
      qty: numberValue(line.quantity),
      unitPrice: numberValue(line.unitPrice),
      taxAmount: numberValue(line.taxAmount),
      amount: numberValue(line.lineTotal ?? numberValue(line.quantity) * numberValue(line.unitPrice)),
    })),
    subtotal: numberValue(subtotal ?? numberValue(total) - numberValue(taxAmount)),
    taxAmount: numberValue(taxAmount),
    total: numberValue(total),
    notes: notes ?? undefined,
    currencyCode,
  };
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
  statuses: Array<string | { value: string; label: string }>;
  includeDeleted?: boolean;
  onIncludeDeleted?: (value: boolean) => void;
  extra?: ReactNode;
  statusFilterLabel?: string;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px_220px]">
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
          {statuses.map((item) => {
            const value = optionValue(item) || optionLabel(item);
            return (
              <option key={value} value={value}>
                {statusFilterLabel === "Status" ? statusLabel(value) : optionLabel(item) || value}
              </option>
            );
          })}
        </select>
        <span className="hidden xl:block" />
      </div>
      {extra ? <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 xl:grid-cols-3">{extra}</div> : null}
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

export function numberValue(value: string | number | null | undefined): number {
  return Number(value ?? 0) || 0;
}

export function billBalance(bill: Pick<VendorBill, "balance" | "total" | "amountPaid">): number {
  if (bill.balance != null) {
    return numberValue(bill.balance);
  }
  return Math.max(numberValue(bill.total) - numberValue(bill.amountPaid), 0);
}

export function billAvailableBalance(
  bill: { availableBalance?: string | null; pendingAmount?: string | null; balance?: string | null; total?: string | number | null; amountPaid?: string | number | null },
): number {
  if (bill.availableBalance != null) {
    return Math.max(numberValue(bill.availableBalance), 0);
  }
  const balance = bill.balance != null ? numberValue(bill.balance) : Math.max(numberValue(bill.total) - numberValue(bill.amountPaid), 0);
  if (bill.pendingAmount != null) {
    return Math.max(balance - numberValue(bill.pendingAmount), 0);
  }
  return Math.max(balance, 0);
}

export function paymentAllocated(payment: VendorPayment): number {
  return (payment.allocations ?? []).reduce((sum, line) => sum + numberValue(line.amount), 0);
}

export function remainingQuantity(
  line: Pick<PurchaseOrderLine, "quantity" | "receivedQuantity"> & { pendingQuantity?: string | null; availableQuantity?: string | null },
): number {
  if (line.availableQuantity != null) {
    return Math.max(numberValue(line.availableQuantity), 0);
  }
  const pending = line.pendingQuantity != null ? numberValue(line.pendingQuantity) : 0;
  return Math.max(numberValue(line.quantity) - numberValue(line.receivedQuantity) - pending, 0);
}

export function formatQuantity(value: string | number | null | undefined): string {
  return (Number(value ?? 0) || 0).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function statusOptions(values: readonly string[]): Array<{ value: string; label: string }> {
  return values.map((value) => ({ value, label: statusLabel(value) }));
}

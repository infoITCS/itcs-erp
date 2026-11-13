import type { ReactNode } from "react";

export interface Page<T> {
  items: T[];
  pageInfo: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}

export interface AuditEvent {
  id: string;
  action: string;
  module: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

export interface OwnerRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface CurrencyRef {
  code: string;
  name?: string;
  symbol?: string | null;
}

export interface PaymentTermRef {
  id: string;
  code: string;
  name: string;
  dueDays: number;
}

export interface TaxCodeOption {
  id: string;
  code: string;
  name?: string;
  rate: string;
}

export interface ProductOption {
  id: string;
  code: string;
  name: string;
  taxCodeId: string | null;
  unitOfMeasure: string;
  taxCode: string | null;
  taxRate: string;
}

export interface CustomerOption {
  id: string;
  customerNumber: string;
  displayName: string;
  currencyCode: string;
  paymentTermId: string | null;
}

export interface DocumentLine {
  id?: string;
  productId: string | null;
  productCode: string | null;
  productName: string;
  description: string | null;
  unitOfMeasure: string | null;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxCodeId: string | null;
  taxCode: string | null;
  taxRate: string;
  lineSubtotal: string;
  lineDiscount: string;
  lineTax: string;
  lineTotal: string;
  sortOrder: number;
}

export interface DocumentLineInput {
  productId?: string;
  productCode?: string;
  productName?: string;
  description?: string;
  unitOfMeasure?: string;
  quantity: string;
  unitPrice: string;
  discountPercent?: string;
  taxCodeId?: string;
  taxRate?: string;
}

export function emptyLine(): DocumentLineInput {
  return { quantity: "1", unitPrice: "0", discountPercent: "0" };
}

export function round(value: number): string {
  return value.toFixed(4);
}

export function computeLineTotals(line: DocumentLineInput) {
  const quantity = Number(line.quantity) || 0;
  const unitPrice = Number(line.unitPrice) || 0;
  const discountPercent = Number(line.discountPercent ?? 0) || 0;
  const taxRate = Number(line.taxRate ?? 0) || 0;

  const lineSubtotal = quantity * unitPrice;
  const lineDiscount = lineSubtotal * (discountPercent / 100);
  const taxable = lineSubtotal - lineDiscount;
  const lineTax = taxable * (taxRate / 100);

  return {
    lineSubtotal: round(lineSubtotal),
    lineDiscount: round(lineDiscount),
    lineTax: round(lineTax),
    lineTotal: round(taxable + lineTax),
  };
}

export function computeDocumentTotals(lines: DocumentLineInput[]) {
  const result = lines.reduce(
    (acc, line) => {
      const money = computeLineTotals(line);
      return {
        subtotal: acc.subtotal + Number(money.lineSubtotal),
        discountTotal: acc.discountTotal + Number(money.lineDiscount),
        taxTotal: acc.taxTotal + Number(money.lineTax),
        total: acc.total + Number(money.lineTotal),
      };
    },
    { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 },
  );

  return {
    subtotal: round(result.subtotal),
    discountTotal: round(result.discountTotal),
    taxTotal: round(result.taxTotal),
    total: round(result.total),
  };
}

export function formatMoney(amount: string | number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "—";
}

export function statusLabel(status: string): string {
  return status
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

export function statusTone(status: string): string {
  switch (status) {
    case "ACCEPTED":
    case "CONFIRMED":
    case "PAID":
    case "FULFILLED":
    case "RECEIVED":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "SENT":
    case "PROCESSING":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "REJECTED":
    case "EXPIRED":
    case "OVERDUE":
    case "CANCELLED":
    case "VOID":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "PARTIALLY_PAID":
      return "bg-indigo-50 text-indigo-800 ring-indigo-200";
    case "CLOSED":
      return "bg-slate-200 text-slate-800 ring-slate-300";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export function StatusPill({ status, deleted }: { status: string; deleted?: boolean }) {
  if (deleted) {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
        Deleted
      </span>
    );
  }
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-slate-950" title={value}>
        {value}
      </p>
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-slate-800">{value ?? "—"}</dd>
    </div>
  );
}

export function LinesEditor({
  lines,
  onChange,
  products,
  taxCodes,
  currency,
  disabled,
}: {
  lines: DocumentLineInput[];
  onChange: (lines: DocumentLineInput[]) => void;
  products: ProductOption[];
  taxCodes: TaxCodeOption[];
  currency: string;
  disabled?: boolean;
}) {
  function update(index: number, patch: Partial<DocumentLineInput>) {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      update(index, { productId: undefined, productCode: undefined, productName: undefined });
      return;
    }
    update(index, {
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      unitOfMeasure: product.unitOfMeasure,
      taxCodeId: product.taxCodeId ?? undefined,
      taxRate: product.taxRate,
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-2 py-2">Product / description</th>
            <th className="w-24 px-2 py-2 text-right">Qty</th>
            <th className="w-32 px-2 py-2 text-right">Unit price</th>
            <th className="w-24 px-2 py-2 text-right">Disc %</th>
            <th className="w-36 px-2 py-2">Tax</th>
            <th className="w-32 px-2 py-2 text-right">Total</th>
            <th className="w-10 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const totals = computeLineTotals(line);
            return (
              <tr key={index} className="border-b border-slate-100 align-top">
                <td className="px-2 py-2">
                  <select
                    aria-label={`Product for line ${index + 1}`}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-50"
                    value={line.productId ?? ""}
                    disabled={disabled}
                    onChange={(event) => selectProduct(index, event.target.value)}
                  >
                    <option value="">Custom line</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.code} · {product.name}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`Description for line ${index + 1}`}
                    className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs disabled:bg-slate-50"
                    placeholder={line.productName ?? "Line description"}
                    value={line.description ?? ""}
                    disabled={disabled}
                    onChange={(event) => update(index, { description: event.target.value || undefined })}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    aria-label={`Quantity for line ${index + 1}`}
                    className="h-9 w-full rounded-md border border-slate-300 px-2 text-right text-sm disabled:bg-slate-50"
                    inputMode="decimal"
                    value={line.quantity}
                    disabled={disabled}
                    onChange={(event) => update(index, { quantity: event.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    aria-label={`Unit price for line ${index + 1}`}
                    className="h-9 w-full rounded-md border border-slate-300 px-2 text-right text-sm disabled:bg-slate-50"
                    inputMode="decimal"
                    value={line.unitPrice}
                    disabled={disabled}
                    onChange={(event) => update(index, { unitPrice: event.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    aria-label={`Discount percent for line ${index + 1}`}
                    className="h-9 w-full rounded-md border border-slate-300 px-2 text-right text-sm disabled:bg-slate-50"
                    inputMode="decimal"
                    value={line.discountPercent ?? "0"}
                    disabled={disabled}
                    onChange={(event) => update(index, { discountPercent: event.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    aria-label={`Tax code for line ${index + 1}`}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-50"
                    value={line.taxCodeId ?? ""}
                    disabled={disabled}
                    onChange={(event) => {
                      const tax = taxCodes.find((item) => item.id === event.target.value);
                      update(index, {
                        taxCodeId: tax?.id,
                        taxRate: tax ? tax.rate : "0",
                      });
                    }}
                  >
                    <option value="">No tax</option>
                    {taxCodes.map((tax) => (
                      <option key={tax.id} value={tax.id}>
                        {tax.code} ({tax.rate}%)
                      </option>
                    ))}
                  </select>
                  {line.taxRate ? (
                    <p className="mt-1 text-right text-[11px] text-slate-500">{Number(line.taxRate).toFixed(2)}%</p>
                  ) : null}
                </td>
                <td className="px-2 py-2 text-right font-medium tabular-nums text-slate-800">
                  {formatMoney(totals.lineTotal, currency)}
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    aria-label={`Remove line ${index + 1}`}
                    className="rounded px-2 py-1 text-red-700 transition hover:bg-red-50 disabled:opacity-40"
                    disabled={disabled || lines.length === 1}
                    onClick={() => onChange(lines.filter((_, i) => i !== index))}
                  >
                    ×
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          disabled={disabled}
          onClick={() => onChange([...lines, emptyLine()])}
        >
          Add line
        </button>
        <p className="text-xs text-slate-500">{lines.length} line{lines.length === 1 ? "" : "s"}</p>
      </div>
    </div>
  );
}

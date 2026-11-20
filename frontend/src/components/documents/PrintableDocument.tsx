import {
  type DocumentTemplateSettings,
  useDocumentTemplate,
} from "@/services/document-template.ts";

export interface PrintableDocLine {
  id?: string;
  name: string;
  description?: string;
  taxable?: boolean;
  qty: number;
  unit?: string; // e.g. "/license", "/piece", "each"
  unitPrice: number;
  taxAmount?: number;
  amount: number;
}

export interface PrintableDocCustomer {
  name: string;
  billingAddress?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  shippingAddress?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  taxpayerId?: string;
  ntn?: string;
}

export interface PrintableDocumentProps {
  type: "QUOTE" | "INVOICE" | "SALES ORDER";
  documentNumber: string;
  date: string;
  validUntilOrDueDate?: string;
  paymentTerms?: string;
  customer: PrintableDocCustomer;
  lines: PrintableDocLine[];
  subtotal: number;
  taxLabel?: string;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  notes?: string;
  currencyCode?: string;
  customTemplate?: DocumentTemplateSettings;
}

export function CompanyLogo({
  logoUrl,
  tagline,
  className = "h-14",
}: {
  logoUrl?: string;
  tagline?: string;
  className?: string;
}) {
  if (logoUrl) {
    return (
      <div className="flex flex-col items-start">
        <img src={logoUrl} alt="Company Logo" className={`object-contain ${className}`} />
        {tagline ? <span className="text-[10px] text-slate-500 font-medium">{tagline}</span> : null}
      </div>
    );
  }

  // Official ITCS vector logo matching the PDF
  return (
    <div className="flex flex-col items-start select-none">
      <div className="flex items-center text-4xl font-extrabold tracking-tight font-sans">
        <span className="text-[#0284c7]">i</span>
        <span className="text-[#7c3aed]">t</span>
        <span className="text-[#059669]">c</span>
        <span className="text-[#f59e0b]">s</span>
      </div>
      <span className="text-[10px] text-slate-500 font-semibold pl-0.5 tracking-wider">
        {tagline || "Since 2010"}
      </span>
    </div>
  );
}

export function PrintableDocument({
  type,
  documentNumber,
  date,
  validUntilOrDueDate,
  paymentTerms = "Due on receipt",
  customer,
  lines,
  subtotal,
  taxLabel,
  taxRate,
  taxAmount,
  total,
  notes,
  currencyCode,
  customTemplate,
}: PrintableDocumentProps) {
  const [storedTemplate] = useDocumentTemplate();
  const t = customTemplate || storedTemplate;

  const symbol = t.currencySymbol || currencyCode || "₨";

  const formatMoney = (val: number) => {
    return `${symbol}${val.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const calculatedTaxAmount = taxAmount !== undefined ? taxAmount : Math.max(0, total - subtotal);
  const effectiveTaxLabel =
    taxLabel ||
    (taxRate
      ? `Sind Sales Tax on Services (${formatMoney(subtotal)} @ ${(taxRate * 100).toFixed(0)}%)`
      : `Sales Tax on Services`);

  return (
    <div className="print-document-container mx-auto w-full max-w-[850px] bg-white p-8 sm:p-12 text-slate-900 font-sans shadow-sm rounded-xl print:shadow-none print:rounded-none print:p-0 print:m-0 print:max-w-none">
      {/* ── TOP HEADER ── */}
      <header className="flex items-start justify-between border-b border-slate-200 pb-6 print:border-slate-300">
        <div>
          <CompanyLogo logoUrl={t.logoUrl} tagline={t.tagline} className="h-16" />
        </div>
        <div className="text-right">
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-950 sm:text-4xl">
            {type}
          </h1>
          <p className="mt-1 font-mono text-sm font-semibold text-slate-800">
            no. {documentNumber}
          </p>
          <p className="mt-1 text-xs text-slate-600 font-medium">{date}</p>
          {validUntilOrDueDate ? (
            <p className="text-xs text-slate-600 font-medium">
              {type === "QUOTE" ? "Expires on" : "Due date:"} {validUntilOrDueDate}
            </p>
          ) : null}
          {paymentTerms ? (
            <p className="text-xs font-semibold text-slate-800">{paymentTerms}</p>
          ) : null}
        </div>
      </header>

      {/* ── COMPANY & CONTACT INFO ── */}
      <div className="mt-6 text-xs leading-relaxed text-slate-700">
        <h2 className="text-sm font-bold text-slate-950">{t.companyName}</h2>
        {t.addressLine1 ? <p>{t.addressLine1}</p> : null}
        {t.addressLine2 ? <p>{t.addressLine2}</p> : null}
        {t.cityPostal ? <p>{t.cityPostal}</p> : null}
        {t.email ? (
          <p className="mt-1">
            <span className="text-slate-500">Email :</span> {t.email}
          </p>
        ) : null}
        {t.phone ? (
          <p>
            <span className="text-slate-500">Phone :</span> {t.phone}
          </p>
        ) : null}
        {t.fax ? (
          <p>
            <span className="text-slate-500">Fax :</span> {t.fax}
          </p>
        ) : null}
        {t.website ? (
          <p>
            <span className="text-slate-500">Website :</span>{" "}
            <a href={t.website} className="hover:underline text-slate-800">
              {t.website}
            </a>
          </p>
        ) : null}
      </div>

      {/* ── BILLING & SHIPPING ADDRESSES ── */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 text-xs leading-relaxed border-t border-slate-100 pt-6">
        {/* Billing Address */}
        <div>
          <h3 className="font-bold text-slate-950 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
            Billing address
          </h3>
          <p className="mt-2 text-sm font-bold text-slate-900">{customer.name}</p>
          {customer.billingAddress?.street ? <p>{customer.billingAddress.street}</p> : null}
          {customer.billingAddress?.city || customer.billingAddress?.postalCode ? (
            <p>
              {[customer.billingAddress.city, customer.billingAddress.postalCode]
                .filter(Boolean)
                .join(" ")}
            </p>
          ) : null}
          {customer.taxpayerId || customer.ntn ? (
            <p className="mt-1.5 font-semibold text-slate-800">
              {t.taxpayerLabel || "Taxpayer ID"} : {customer.taxpayerId || customer.ntn}
            </p>
          ) : null}
        </div>

        {/* Shipping Address */}
        <div>
          <h3 className="font-bold text-slate-950 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
            Shipping address
          </h3>
          <p className="mt-2 text-sm font-bold text-slate-900">{customer.name}</p>
          {customer.shippingAddress?.street ? (
            <p>{customer.shippingAddress.street}</p>
          ) : customer.billingAddress?.street ? (
            <p>{customer.billingAddress.street}</p>
          ) : null}
          {customer.shippingAddress?.city || customer.shippingAddress?.postalCode ? (
            <p>
              {[customer.shippingAddress.city, customer.shippingAddress.postalCode]
                .filter(Boolean)
                .join(" ")}
            </p>
          ) : customer.billingAddress?.city ? (
            <p>
              {[customer.billingAddress.city, customer.billingAddress.postalCode]
                .filter(Boolean)
                .join(" ")}
            </p>
          ) : null}
        </div>
      </div>

      {/* ── LINE ITEMS TABLE ── */}
      <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 print:border-slate-300">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-700 print:bg-slate-100">
            <tr>
              <th className="px-4 py-3 min-w-[280px]">Item name &amp; description</th>
              <th className="px-3 py-3 text-center w-20">Taxable</th>
              <th className="px-3 py-3 text-center w-16">Qty.</th>
              <th className="px-4 py-3 text-right min-w-[130px]">Unit price</th>
              <th className="px-4 py-3 text-right min-w-[130px]">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-normal">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  No line items in this document.
                </td>
              </tr>
            ) : null}
            {lines.map((line, idx) => (
              <tr key={line.id || idx} className="hover:bg-slate-50/50">
                <td className="px-4 py-3.5">
                  <p className="font-bold text-slate-950 text-xs">{line.name}</p>
                  {line.description ? (
                    <p className="mt-1 text-[11px] text-slate-600 leading-snug whitespace-pre-line">
                      {line.description}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3.5 text-center font-bold text-slate-700">
                  {line.taxable !== false ? "✓" : "—"}
                </td>
                <td className="px-3 py-3.5 text-center font-bold text-slate-900">
                  {line.qty}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-slate-800">
                  {formatMoney(line.unitPrice)}
                  {line.unit ? <span className="text-[10px] text-slate-500 font-sans ml-1">{line.unit}</span> : ""}
                </td>
                <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-950">
                  {formatMoney(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── TOTALS SECTION ── */}
      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-sm space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="font-semibold text-slate-700">Subtotal</span>
            <span className="font-mono font-bold text-slate-950">{formatMoney(subtotal)}</span>
          </div>

          {calculatedTaxAmount > 0 ? (
            <div className="flex justify-between py-1 text-slate-700 border-b border-slate-100">
              <span className="font-medium text-slate-600 pr-4 leading-tight">{effectiveTaxLabel}</span>
              <span className="font-mono font-bold text-slate-950 shrink-0">
                {formatMoney(calculatedTaxAmount)}
              </span>
            </div>
          ) : null}

          {/* Grand Total Box */}
          <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-100/80 px-4 py-3 text-base font-black text-slate-950 print:bg-slate-200">
            <span>Total</span>
            <span className="font-mono text-lg">{formatMoney(total)}</span>
          </div>
        </div>
      </div>

      {/* ── NOTES & PAYMENT INFORMATION ── */}
      <div className="mt-8 grid grid-cols-1 gap-6 border-t border-slate-200 pt-6 sm:grid-cols-2 text-xs">
        {/* Payment Info */}
        <div className="space-y-1.5 text-slate-700">
          <h3 className="font-bold text-slate-950 text-sm mb-2">Payment Information</h3>
          {t.bankName ? (
            <p>
              <span className="font-medium text-slate-500">Bank Name:</span>{" "}
              <span className="font-semibold text-slate-900">{t.bankName}</span>
            </p>
          ) : null}
          {t.swiftCode ? (
            <p>
              <span className="font-medium text-slate-500">Swift Code:</span>{" "}
              <span className="font-mono text-slate-900">{t.swiftCode}</span>
            </p>
          ) : null}
          {t.accountNumber ? (
            <p>
              <span className="font-medium text-slate-500">Account Number:</span>{" "}
              <span className="font-mono font-semibold text-slate-900">{t.accountNumber}</span>
            </p>
          ) : null}
          {t.ibanNumber ? (
            <p>
              <span className="font-medium text-slate-500">IBAN Number:</span>{" "}
              <span className="font-mono font-semibold text-slate-900">{t.ibanNumber}</span>
            </p>
          ) : null}
          {t.accountTitle ? (
            <p>
              <span className="font-medium text-slate-500">Title:</span>{" "}
              <span className="font-semibold text-slate-900">{t.accountTitle}</span>
            </p>
          ) : null}
          {t.branch ? (
            <p>
              <span className="font-medium text-slate-500">Branch:</span>{" "}
              <span>{t.branch}</span>
            </p>
          ) : null}
        </div>

        {/* Notes Pill Box */}
        <div className="flex flex-col justify-start">
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200/80 text-xs text-slate-700 print:bg-slate-100">
            <p className="font-medium text-slate-800">{notes || t.defaultNotes}</p>
          </div>
        </div>
      </div>

      {/* ── FOOTER & TAX IDENTIFIERS ── */}
      <footer className="mt-12 border-t border-slate-200 pt-5 text-center text-[11px] text-slate-500 print:mt-16">
        <p className="font-medium text-slate-600">{t.footerDisclaimer}</p>
        <p className="mt-1 font-semibold text-slate-700">
          {t.ntn ? `NTN: ${t.ntn}` : ""}
          {t.ntn && t.strn ? " · " : ""}
          {t.strn ? `Sales Tax Number: ${t.strn}` : ""}
        </p>
      </footer>
    </div>
  );
}

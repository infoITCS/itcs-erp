import { useState } from "react";
import { Button } from "@/components/ui/Button.tsx";
import { PrintableDocument } from "@/components/documents/PrintableDocument.tsx";
import {
  type DocumentTemplateSettings,
  useDocumentTemplate,
} from "@/services/document-template.ts";

export function DocumentTemplateSettingsPanel() {
  const [template, updateTemplate, resetTemplate] = useDocumentTemplate();
  const [formData, setFormData] = useState<DocumentTemplateSettings>(template);
  const [saved, setSaved] = useState(false);
  const [previewMode, setPreviewMode] = useState<"QUOTE" | "INVOICE">("QUOTE");

  const handleChange = (field: keyof DocumentTemplateSettings, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateTemplate(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset template settings to official ITCS defaults?")) {
      resetTemplate();
      setFormData(template);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          handleChange("logoUrl", reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Sample data for live preview
  const sampleLines = [
    {
      id: "line-1",
      name: "PS-6940 SQL Server 2025 Standard edition",
      description: "SQL Server 2025 Standard edition Perpetual 1 Server License",
      taxable: true,
      qty: 1,
      unit: "/license",
      unitPrice: 290860,
      amount: 290860,
    },
    {
      id: "line-2",
      name: "PS-7459 Windows Server Standard Core 2025",
      description: "Windows Server 2025 Standard - 16 Core License Pack",
      taxable: true,
      qty: 1,
      unit: "/piece",
      unitPrice: 346555.44,
      amount: 346555.44,
    },
  ];

  const sampleCustomer = {
    name: "Martin Dow Limited",
    billingAddress: {
      street: "Plot No. 37, Sector 19, Korangi Industrial Area",
      city: "Karachi",
      postalCode: "74900",
    },
    shippingAddress: {
      street: "Plot No. 37, Sector 19, Korangi Industrial Area",
      city: "Karachi",
      postalCode: "74900",
    },
    taxpayerId: "0823577-5",
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Overview Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Quotation &amp; Invoice Document Customization
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Configure company legal details, branding logo, bank wire instructions, and tax IDs. Changes apply automatically to all printed Quotes and Invoices across the ERP.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Reset to Defaults
            </button>
            <Button onClick={handleSave} className="h-9 px-4 text-xs font-bold shadow">
              {saved ? "✓ Changes Saved" : "Save Template Settings"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Form Editor (5 cols) */}
        <form onSubmit={handleSave} className="space-y-6 lg:col-span-5">
          {/* Section 1: Company Branding */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
              1. Company Branding &amp; Logo
            </h4>

            <div>
              <label className="text-xs font-semibold text-slate-700">Company Legal Name</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => handleChange("companyName", e.target.value)}
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Tagline / Subtitle</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => handleChange("tagline", e.target.value)}
                placeholder="Since 2010"
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Company Logo</label>
              <div className="mt-1.5 flex flex-col gap-2">
                <input
                  type="text"
                  value={formData.logoUrl || ""}
                  onChange={(e) => handleChange("logoUrl", e.target.value)}
                  placeholder="Paste Logo Image URL or leave empty for default ITCS logo"
                  className="h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-900 focus:border-brand-500 focus:outline-none"
                />
                <div className="flex items-center gap-2 text-xs">
                  <label className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100">
                    Upload Logo File
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {formData.logoUrl ? (
                    <button
                      type="button"
                      onClick={() => handleChange("logoUrl", "")}
                      className="text-xs font-medium text-rose-600 hover:underline"
                    >
                      Clear custom logo
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-500">Using official vector ITCS logo</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Address */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
              2. Company Address &amp; Contact
            </h4>

            <div>
              <label className="text-xs font-semibold text-slate-700">Address Line 1</label>
              <input
                type="text"
                value={formData.addressLine1}
                onChange={(e) => handleChange("addressLine1", e.target.value)}
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Address Line 2 (Landmark)</label>
              <input
                type="text"
                value={formData.addressLine2}
                onChange={(e) => handleChange("addressLine2", e.target.value)}
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">City &amp; Postal Code</label>
              <input
                type="text"
                value={formData.cityPostal}
                onChange={(e) => handleChange("cityPostal", e.target.value)}
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-700">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Website URL</label>
                <input
                  type="text"
                  value={formData.website}
                  onChange={(e) => handleChange("website", e.target.value)}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-700">Phone Numbers</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Fax Number</label>
                <input
                  type="text"
                  value={formData.fax}
                  onChange={(e) => handleChange("fax", e.target.value)}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Tax Numbers */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
              3. Tax Compliance Identifiers
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-700">Company NTN</label>
                <input
                  type="text"
                  value={formData.ntn}
                  onChange={(e) => handleChange("ntn", e.target.value)}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Sales Tax No. (STRN)</label>
                <input
                  type="text"
                  value={formData.strn}
                  onChange={(e) => handleChange("strn", e.target.value)}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Customer Tax ID Label</label>
              <input
                type="text"
                value={formData.taxpayerLabel}
                onChange={(e) => handleChange("taxpayerLabel", e.target.value)}
                placeholder="Taxpayer ID"
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-900 focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 4: Banking & Wire Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
              4. Banking &amp; Wire Payment Instructions
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-700">Bank Name</label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => handleChange("bankName", e.target.value)}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Swift Code</label>
                <input
                  type="text"
                  value={formData.swiftCode}
                  onChange={(e) => handleChange("swiftCode", e.target.value)}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-700">Account Number</label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) => handleChange("accountNumber", e.target.value)}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">IBAN Number</label>
                <input
                  type="text"
                  value={formData.ibanNumber}
                  onChange={(e) => handleChange("ibanNumber", e.target.value)}
                  className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Account Title</label>
              <input
                type="text"
                value={formData.accountTitle}
                onChange={(e) => handleChange("accountTitle", e.target.value)}
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Branch Address</label>
              <input
                type="text"
                value={formData.branch}
                onChange={(e) => handleChange("branch", e.target.value)}
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-900 focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 5: Terms & Formatting */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
              5. Terms, Notes &amp; Disclaimers
            </h4>

            <div>
              <label className="text-xs font-semibold text-slate-700">Default Notes on Quotes/Invoices</label>
              <input
                type="text"
                value={formData.defaultNotes}
                onChange={(e) => handleChange("defaultNotes", e.target.value)}
                placeholder="- Prices are inclusive of all taxes."
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Footer Legal Disclaimer</label>
              <input
                type="text"
                value={formData.footerDisclaimer}
                onChange={(e) => handleChange("footerDisclaimer", e.target.value)}
                placeholder="Electronic document, no signature required."
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Currency Symbol</label>
              <input
                type="text"
                value={formData.currencySymbol}
                onChange={(e) => handleChange("currencySymbol", e.target.value)}
                className="mt-1 h-8 w-24 rounded-lg border border-slate-200 px-2.5 font-mono text-xs font-bold text-slate-900 focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" className="w-full h-10 text-xs font-bold shadow">
              {saved ? "✓ Saved" : "Save All Settings"}
            </Button>
          </div>
        </form>

        {/* Right Column: Live Document Preview (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-slate-800">Live Document Preview</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewMode("QUOTE")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  previewMode === "QUOTE"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                Quote Format
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("INVOICE")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  previewMode === "INVOICE"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                Invoice Format
              </button>
            </div>
          </div>

          {/* Rendered Scaled Document */}
          <div className="overflow-hidden rounded-2xl border border-slate-300 bg-slate-100 p-4 shadow-inner">
            <PrintableDocument
              type={previewMode}
              documentNumber={previewMode === "QUOTE" ? "QOT-112001" : "INV-1002"}
              date="19/11/26"
              validUntilOrDueDate="19/12/26"
              paymentTerms="Due on receipt"
              customer={sampleCustomer}
              lines={sampleLines}
              subtotal={637415.44}
              taxLabel="Sind Sales Tax on Services (₨637,415.44 @ 15%)"
              taxRate={0.15}
              taxAmount={95612.32}
              total={733027.76}
              notes="- Prices are inclusive of all taxes."
              customTemplate={formData}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { createReseller, getReseller, getResellerFormOptions, updateReseller, type ResellerWrite } from "./api.ts";
import { codeSelectOptions, countrySelectOptions } from "./options.ts";

const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 disabled:bg-slate-50";

const pricingInputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50";

const glyphPaths: Record<"tag" | "percent" | "commission" | "note" | "shield", ReactNode> = {
  tag: <><path d="M20.59 13.41 12 22l-9-9V3h10l7.59 7.59a2 2 0 0 1 0 2.82Z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
  percent: <><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
  commission: <><rect x="3" y="6" width="18" height="12" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  note: <><path d="M4 4h16v12l-4 4H4z" /><path d="M16 20v-4h4" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="13" y2="13" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
};

const percent = z
  .string()
  .trim()
  .refine((value) => !value || (/^\d{1,3}(\.\d{1,4})?$/.test(value) && Number(value) <= 100), "Use 0-100 with up to four decimals");
const email = z.string().trim().max(320).refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email");
const website = z.string().trim().max(200).refine((value) => !value || /^https?:\/\/\S+$/i.test(value), "Enter an http or https URL");

const schema = z.object({
  legalName: z.string().trim().min(1, "Enter the legal name").max(200),
  displayName: z.string().trim().min(1, "Enter the display name").max(200),
  email,
  phone: z.string().trim().max(40),
  website,
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a two-letter country code").transform((value) => value.toUpperCase()),
  currencyCode: z.string().trim().regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code").transform((value) => value.toUpperCase()),
  taxNumber: z.string().trim().max(64),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
  priceListCode: z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()),
  defaultDiscountPercent: percent,
  defaultCommissionPercent: percent,
  notes: z.string().trim().max(4000),
  addressLine1: z.string().trim().max(200),
  addressCity: z.string().trim().max(120),
  addressCountryCode: z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a two-letter country code").transform((value) => value.toUpperCase()),
  addressPrimary: z.boolean(),
  contactFirstName: z.string().trim().max(100),
  contactLastName: z.string().trim().max(100),
  contactEmail: email,
  contactPhone: z.string().trim().max(40),
  contactJobTitle: z.string().trim().max(120),
});

type FormValues = z.input<typeof schema>;
type Tab = "basic" | "pricing" | "launch";

const empty: FormValues = {
  legalName: "",
  displayName: "",
  email: "",
  phone: "",
  website: "",
  countryCode: "PK",
  currencyCode: "PKR",
  taxNumber: "",
  status: "ACTIVE",
  priceListCode: "STANDARD",
  defaultDiscountPercent: "",
  defaultCommissionPercent: "",
  notes: "",
  addressLine1: "",
  addressCity: "",
  addressCountryCode: "PK",
  addressPrimary: true,
  contactFirstName: "",
  contactLastName: "",
  contactEmail: "",
  contactPhone: "",
  contactJobTitle: "",
};

export default function ResellerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [tab, setTab] = useState<Tab>("basic");
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty, mode: "onTouched" });
  const existing = useQuery({ queryKey: ["resellers", id], queryFn: () => getReseller(id as string), enabled: isEdit });
  const options = useQuery({ queryKey: ["resellers", "form-options"], queryFn: getResellerFormOptions, staleTime: 5 * 60_000 });
  const countryOptions = countrySelectOptions(options.data?.countries ?? [], [
    form.watch("countryCode"),
    form.watch("addressCountryCode"),
  ]);
  const currencyOptions = codeSelectOptions(
    (options.data?.currencies ?? []).map((currency) => ({ code: currency.code, name: currency.name })),
    form.watch("currencyCode"),
  );
  const priceListCode = form.watch("priceListCode");
  const discountPercent = form.watch("defaultDiscountPercent");
  const commissionPercent = form.watch("defaultCommissionPercent");
  const currencyCode = form.watch("currencyCode");
  const notesLength = form.watch("notes")?.length ?? 0;

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    form.reset({
      ...empty,
      legalName: existing.data.legalName,
      displayName: existing.data.displayName,
      email: existing.data.email ?? "",
      phone: existing.data.phone ?? "",
      website: existing.data.website ?? "",
      countryCode: existing.data.countryCode,
      currencyCode: existing.data.currencyCode,
      taxNumber: existing.data.taxNumber ?? "",
      status: existing.data.status,
      priceListCode: existing.data.priceListCode,
      defaultDiscountPercent: existing.data.defaultDiscountPercent ?? "",
      defaultCommissionPercent: existing.data.defaultCommissionPercent ?? "",
      notes: existing.data.notes ?? "",
    });
  }, [existing.data, form]);

  const submit = form.handleSubmit(async (values) => {
    const body = toWrite(values, isEdit);
    try {
      if (id) {
        await updateReseller(id, body);
        navigate(`/resellers/${id}`);
        return;
      }
      const created = await createReseller(body);
      navigate(`/resellers/${created.id}`);
    } catch (error) {
      form.setError("root", { message: getApiErrorMessage(error) });
    }
  });

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-sky-400" />
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 sm:flex">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 21v-4h6v4" /><path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01" />
              </svg>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">CRM / Channel partners</p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">{isEdit ? "Edit reseller" : "New reseller"}</h1>
              <p className="mt-1.5 text-sm text-slate-600">The reseller number is assigned by the server. Optional launch data creates the first address and contact.</p>
            </div>
          </div>
          <Link to={isEdit ? `/resellers/${id}` : "/resellers"} className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </Link>
        </div>
      </header>

      {existing.isError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{getApiErrorMessage(existing.error)}</p> : null}
      {options.isError ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Country, currency and price-list options could not be loaded. {getApiErrorMessage(options.error)}</p> : null}

      <form className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm" noValidate onSubmit={submit}>
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/60 px-3 pt-3 sm:px-5">
          <TabButton label="Basic details" active={tab === "basic"} onClick={() => setTab("basic")} />
          <TabButton label="Pricing & notes" active={tab === "pricing"} onClick={() => setTab("pricing")} />
          <TabButton label={isEdit ? "Manage later" : "Launch data"} active={tab === "launch"} onClick={() => setTab("launch")} />
        </div>

        <div className="p-5 sm:p-6">
          {tab === "basic" ? (
            <div className="grid gap-5">
              <Section title="Company identity" description="Legal and display names used across quotes, orders and partner reports.">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Legal name" htmlFor="legalName" error={form.formState.errors.legalName?.message} required>
                    <Input id="legalName" {...form.register("legalName")} />
                  </FormField>
                  <FormField label="Display name" htmlFor="displayName" error={form.formState.errors.displayName?.message} required>
                    <Input id="displayName" {...form.register("displayName")} />
                  </FormField>
                </div>
              </Section>
              <Section title="Contact & location" description="Primary business contact details and operating country.">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
                    <Input id="email" type="email" {...form.register("email")} />
                  </FormField>
                  <FormField label="Phone" htmlFor="phone" error={form.formState.errors.phone?.message}>
                    <Input id="phone" {...form.register("phone")} />
                  </FormField>
                  <FormField label="Website" htmlFor="website" error={form.formState.errors.website?.message}>
                    <Input id="website" placeholder="https://partner.example.com" {...form.register("website")} />
                  </FormField>
                  <FormField label="Tax / VAT number" htmlFor="taxNumber" error={form.formState.errors.taxNumber?.message}>
                    <Input id="taxNumber" {...form.register("taxNumber")} />
                  </FormField>
                  <FormField label="Country" htmlFor="countryCode" error={form.formState.errors.countryCode?.message} required>
                    <select id="countryCode" className={selectClass} disabled={options.isPending} {...form.register("countryCode")}>
                      <option value="">{options.isPending ? "Loading countries…" : "Select country"}</option>
                      {countryOptions.map((country) => <option key={country.code} value={country.code}>{country.name} ({country.code})</option>)}
                    </select>
                  </FormField>
                  <FormField label="Currency" htmlFor="currencyCode" error={form.formState.errors.currencyCode?.message} required>
                    <select id="currencyCode" className={selectClass} disabled={options.isPending} {...form.register("currencyCode")}>
                      <option value="">{options.isPending ? "Loading currencies…" : "Select active currency"}</option>
                      {currencyOptions.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} · {currency.name}</option>)}
                    </select>
                  </FormField>
                </div>
              </Section>
              <Section title="Status" description="Suspended partners cannot receive new customer assignments.">
                <FormField label="Reseller status" htmlFor="status" error={form.formState.errors.status?.message} required>
                  <select id="status" className={selectClass} {...form.register("status")}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                </FormField>
              </Section>
            </div>
          ) : null}

          {tab === "pricing" ? (
            <div className="grid gap-5">
              <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-sky-400" />
                <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="min-w-0">
                    <div className="mb-5 flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100"><Glyph name="tag" className="h-5 w-5" /></span>
                      <div>
                        <h2 className="text-base font-bold tracking-tight text-slate-950">Commercial terms</h2>
                        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                          Defaults copied to new quotes and orders for this partner. Existing documents keep their original terms.
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-4">
                      <FormField label="Price list" htmlFor="priceListCode" error={form.formState.errors.priceListCode?.message} required>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Glyph name="tag" /></span>
                          <Input id="priceListCode" list="reseller-price-lists" className={`${pricingInputClass} pl-9 font-mono font-semibold uppercase tracking-wide`} placeholder="STANDARD" autoComplete="off" {...form.register("priceListCode")} />
                        </div>
                        <datalist id="reseller-price-lists">
                          {(options.data?.priceLists ?? []).map((priceList) => <option key={priceList} value={priceList} />)}
                        </datalist>
                        <p className="text-xs leading-5 text-slate-500">Choose an existing list or enter a custom code. Codes are stored uppercase.</p>
                      </FormField>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Default discount" htmlFor="defaultDiscountPercent" error={form.formState.errors.defaultDiscountPercent?.message}>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Glyph name="percent" /></span>
                            <Input id="defaultDiscountPercent" inputMode="decimal" className={`${pricingInputClass} pl-9 pr-9 tabular-nums`} placeholder="0.0000" {...form.register("defaultDiscountPercent")} />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                          </div>
                          <p className="text-xs leading-5 text-slate-500">Applied to partner purchase pricing unless a quote overrides it.</p>
                        </FormField>
                        <FormField label="Default commission" htmlFor="defaultCommissionPercent" error={form.formState.errors.defaultCommissionPercent?.message}>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Glyph name="commission" /></span>
                            <Input id="defaultCommissionPercent" inputMode="decimal" className={`${pricingInputClass} pl-9 pr-9 tabular-nums`} placeholder="0.0000" {...form.register("defaultCommissionPercent")} />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                          </div>
                          <p className="text-xs leading-5 text-slate-500">Used for partner margin reporting and payout calculations.</p>
                        </FormField>
                      </div>
                    </div>
                  </div>
                  <PricingPreview priceListCode={priceListCode} discountPercent={discountPercent} commissionPercent={commissionPercent} currencyCode={currencyCode} />
                </div>
              </section>
              <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-600 via-sky-400 to-emerald-400" />
                <div className="p-5 sm:p-6">
                  <div className="mb-4 flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200"><Glyph name="note" className="h-5 w-5" /></span>
                    <div>
                      <h2 className="text-base font-bold tracking-tight text-slate-950">Internal notes</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Context for sales and channel managers. Never shown to customers.</p>
                    </div>
                  </div>
                  <div className="relative">
                    <textarea id="notes" maxLength={4000} className={`${pricingInputClass} h-auto min-h-32 resize-y py-3 leading-6`} placeholder="Payment terms, rebate agreements, escalation contacts, pricing approvals…" {...form.register("notes")} />
                    <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">{notesLength}/4000</span>
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {tab === "launch" && !isEdit ? (
            <div className="grid gap-5">
              <Section title="First address (optional)" description="Add a billing address now, or manage all addresses on the detail page later.">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <FormField label="Street" htmlFor="addressLine1" error={form.formState.errors.addressLine1?.message}>
                      <Input id="addressLine1" {...form.register("addressLine1")} />
                    </FormField>
                  </div>
                  <FormField label="City" htmlFor="addressCity" error={form.formState.errors.addressCity?.message}>
                    <Input id="addressCity" {...form.register("addressCity")} />
                  </FormField>
                  <FormField label="Country" htmlFor="addressCountryCode" error={form.formState.errors.addressCountryCode?.message}>
                    <select id="addressCountryCode" className={selectClass} disabled={options.isPending} {...form.register("addressCountryCode")}>
                      <option value="">{options.isPending ? "Loading…" : "Select country"}</option>
                      {countryOptions.map((country) => <option key={country.code} value={country.code}>{country.name} ({country.code})</option>)}
                    </select>
                  </FormField>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" {...form.register("addressPrimary")} /> Primary billing address
                  </label>
                </div>
              </Section>
              <Section title="Primary contact (optional)" description="Create the first contact together with the reseller record.">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="First name" htmlFor="contactFirstName" error={form.formState.errors.contactFirstName?.message}>
                    <Input id="contactFirstName" {...form.register("contactFirstName")} />
                  </FormField>
                  <FormField label="Last name" htmlFor="contactLastName" error={form.formState.errors.contactLastName?.message}>
                    <Input id="contactLastName" {...form.register("contactLastName")} />
                  </FormField>
                  <FormField label="Email" htmlFor="contactEmail" error={form.formState.errors.contactEmail?.message}>
                    <Input id="contactEmail" type="email" {...form.register("contactEmail")} />
                  </FormField>
                  <FormField label="Phone" htmlFor="contactPhone" error={form.formState.errors.contactPhone?.message}>
                    <Input id="contactPhone" {...form.register("contactPhone")} />
                  </FormField>
                  <FormField label="Job title" htmlFor="contactJobTitle" error={form.formState.errors.contactJobTitle?.message}>
                    <Input id="contactJobTitle" {...form.register("contactJobTitle")} />
                  </FormField>
                </div>
              </Section>
            </div>
          ) : null}

          {tab === "launch" && isEdit ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-sm leading-6 text-slate-600">
              Addresses, contacts and customer assignments are managed on the reseller detail page so each change can be audited individually.
              <Link className="ml-1 font-semibold text-brand-700 hover:underline" to={`/resellers/${id}`}>Open detail page</Link>
            </div>
          ) : null}

          {form.formState.errors.root ? (
            <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{form.formState.errors.root.message}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-5 py-4">
          <p className="text-xs text-slate-500">All monetary values use decimal-safe storage.</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setTab(tab === "basic" ? (isEdit ? "launch" : "pricing") : "basic")}>Previous</Button>
            <Button type="button" variant="secondary" onClick={() => setTab(tab === "launch" ? "basic" : tab === "basic" ? "pricing" : "launch")}>Next</Button>
            <Button type="submit" disabled={form.formState.isSubmitting || options.isPending || options.isError} className="bg-brand-800 hover:bg-brand-900">
              {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create reseller"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`relative px-4 py-3 text-sm font-semibold transition ${active ? "text-brand-800" : "text-slate-500 hover:text-slate-800"}`}>
      {label}
      {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-600" /> : null}
    </button>
  );
}

function PricingPreview({ priceListCode, discountPercent, commissionPercent, currencyCode }: { priceListCode: string; discountPercent: string; commissionPercent: string; currencyCode: string }) {
  const list = priceListCode.trim().toUpperCase() || "STANDARD";
  const discount = clampPercent(discountPercent);
  const commission = clampPercent(commissionPercent);
  const partnerPrice = 1000 * (1 - discount / 100);

  return (
    <aside className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 via-white to-sky-50/70 p-4 shadow-inner ring-1 ring-brand-50">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">Deal preview</p>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm ring-1 ring-brand-100"><Glyph name="shield" /></span>
      </div>
      <p className="mt-4 text-xs font-medium text-slate-500">Price list</p>
      <p className="mt-1 font-mono text-lg font-bold tracking-tight text-slate-950">{list}</p>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <PreviewTile label="Discount" value={`${formatPercent(discount)}%`} />
        <PreviewTile label="Commission" value={`${formatPercent(commission)}%`} />
      </dl>
      <div className="mt-4 rounded-xl border border-white bg-white/80 p-3 shadow-sm">
        <p className="text-[11px] font-semibold text-slate-500">Partner price on {formatCurrency(1000, currencyCode)} list</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-brand-800">{formatCurrency(partnerPrice, currencyCode)}</p>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">Illustrative only. Final pricing is calculated on the document with decimal-safe values.</p>
    </aside>
  );
}

function PreviewTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3">
      <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-bold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

function clampPercent(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 100) : 0;
}

function formatPercent(value: number) {
  return value.toFixed(4).replace(/\.?0+$/, "") || "0";
}

function formatCurrency(value: number, currency: string) {
  const code = currency.trim().toUpperCase() || "PKR";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
}

function Glyph({ name, className = "h-4 w-4" }: { name: keyof typeof glyphPaths; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {glyphPaths[name]}
    </svg>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function toWrite(values: z.output<typeof schema>, isEdit: boolean): ResellerWrite {
  const text = (value: string) => value.trim() || null;
  const body: ResellerWrite = {
    legalName: values.legalName,
    displayName: values.displayName,
    email: text(values.email),
    phone: text(values.phone),
    website: text(values.website),
    countryCode: values.countryCode,
    currencyCode: values.currencyCode,
    taxNumber: text(values.taxNumber),
    status: values.status,
    priceListCode: values.priceListCode,
    defaultDiscountPercent: isEdit ? values.defaultDiscountPercent.trim() || null : values.defaultDiscountPercent.trim() || undefined,
    defaultCommissionPercent: isEdit ? values.defaultCommissionPercent.trim() || null : values.defaultCommissionPercent.trim() || undefined,
    notes: text(values.notes),
  };
  if (!isEdit) {
    if (values.addressLine1.trim() && values.addressCity.trim()) {
      body.addresses = [{
        purpose: "BILLING",
        isPrimary: values.addressPrimary,
        line1: values.addressLine1,
        city: values.addressCity,
        countryCode: values.addressCountryCode.toUpperCase() || values.countryCode,
      }];
    }
    if (values.contactFirstName.trim() && values.contactLastName.trim()) {
      body.primaryContact = {
        firstName: values.contactFirstName,
        lastName: values.contactLastName,
        email: values.contactEmail.trim() || undefined,
        phone: values.contactPhone.trim() || undefined,
        jobTitle: values.contactJobTitle.trim() || undefined,
      };
    }
  }
  return body;
}

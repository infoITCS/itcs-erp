import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { purchasingKeys, vendorKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { PageHeader } from "../purchasing/shared.tsx";
import {
  VENDOR_PERMISSIONS,
  VENDOR_STATUSES,
  VENDOR_STATUS_LABELS,
  createVendor,
  getVendor,
  getVendorFormOptions,
  updateVendor,
  type VendorStatus,
  type VendorWrite,
} from "./api.ts";

const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email");

const optionalPhone = z.string().trim().max(60).refine(
  (value) => !value || (/^\+?[0-9(). -]{7,60}$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7),
  "Enter a phone number with 7-60 digits or phone punctuation",
);

const optionalWebsite = z
  .string()
  .trim()
  .max(500)
  .refine((value) => !value || /^https?:\/\/\S+$/i.test(value), "Enter an http or https URL");

const optionalCountryCode = z
  .string()
  .trim()
  .refine((value) => !value || /^[A-Za-z]{2,8}$/.test(value), "Use a two to eight letter country code");

export default function VendorFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(VENDOR_PERMISSIONS.create);
  const canUpdate = useHasPermission(VENDOR_PERMISSIONS.update);
  const isEdit = Boolean(id);
  const allowed = isEdit ? canUpdate : canCreate;

  const existing = useQuery({ queryKey: vendorKeys.detail(id as string), queryFn: () => getVendor(id as string), enabled: isEdit });
  const formOptions = useQuery({ queryKey: vendorKeys.formOptions(), queryFn: getVendorFormOptions });

  const [form, setForm] = useState<VendorWrite>({
    name: "",
    status: "ACTIVE",
    currencyCode: "PKR",
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    currencyCode?: string;
    email?: string;
    phone?: string;
    website?: string;
    countryCode?: string;
  }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    const vendor = existing.data;
    setForm({
      code: vendor.code ?? "",
      name: vendor.name,
      legalName: vendor.legalName ?? "",
      displayName: vendor.displayName ?? "",
      status: vendor.status,
      vendorType: vendor.vendorType ?? "",
      category: vendor.category ?? "",
      currencyCode: vendor.currencyCode,
      paymentTermId: vendor.paymentTermId ?? "",
      taxCodeId: vendor.taxCodeId ?? "",
      taxId: vendor.taxId ?? "",
      registrationNumber: vendor.registrationNumber ?? "",
      website: vendor.website ?? "",
      email: vendor.email ?? "",
      phone: vendor.phone ?? "",
      addressLine1: vendor.addressLine1 ?? "",
      addressLine2: vendor.addressLine2 ?? "",
      city: vendor.city ?? "",
      stateProvince: vendor.stateProvince ?? "",
      postalCode: vendor.postalCode ?? "",
      countryCode: vendor.countryCode ?? "",
      bankAccount: vendor.bankAccount ?? "",
      notes: vendor.notes ?? "",
    });
  }, [existing.data]);

  function patch(next: Partial<VendorWrite>) {
    setForm((current) => ({ ...current, ...next }));
  }

  async function submit() {
    setError(null);
    setFieldErrors({});
    if (!form.name.trim()) {
      setFieldErrors({ name: "Enter a vendor name." });
      return;
    }
    if (!form.currencyCode) {
      setFieldErrors({ currencyCode: "Choose a settlement currency." });
      return;
    }
    const validationErrors: {
      email?: string;
      phone?: string;
      website?: string;
      countryCode?: string;
    } = {};
    const emailResult = optionalEmail.safeParse(form.email ?? "");
    if (!emailResult.success) {
      validationErrors.email = emailResult.error.issues[0]?.message;
    }
    const phoneResult = optionalPhone.safeParse(form.phone ?? "");
    if (!phoneResult.success) {
      validationErrors.phone = phoneResult.error.issues[0]?.message;
    }
    const websiteResult = optionalWebsite.safeParse(form.website ?? "");
    if (!websiteResult.success) {
      validationErrors.website = websiteResult.error.issues[0]?.message;
    }
    const countryCodeResult = optionalCountryCode.safeParse(form.countryCode ?? "");
    if (!countryCodeResult.success) {
      validationErrors.countryCode = countryCodeResult.error.issues[0]?.message;
    }
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }
    const body: VendorWrite = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, typeof value === "string" ? value.trim() || undefined : value]),
    ) as VendorWrite;
    body.name = form.name.trim();
    body.currencyCode = form.currencyCode;
    body.status = form.status;

    const refresh = async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: vendorKeys.all() }),
        queryClient.invalidateQueries({ queryKey: purchasingKeys.formOptions() }),
        queryClient.invalidateQueries({ queryKey: purchasingKeys.orders.formOptions() }),
        queryClient.invalidateQueries({ queryKey: purchasingKeys.bills.formOptions() }),
        queryClient.invalidateQueries({ queryKey: purchasingKeys.payments.formOptions() }),
        queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
      ]);
    };
    setBusy(true);
    try {
      if (id) {
        await updateVendor(id, body);
        await refresh();
        navigate(`/vendors/${id}`);
        return;
      }
      const created = await createVendor(body);
      await refresh();
      navigate(`/vendors/${created.id}`);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return <p className="text-sm text-red-700">You do not have permission to {isEdit ? "edit" : "create"} vendors.</p>;
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <PageHeader
        section="Supply / Vendor master"
        title={isEdit ? "Edit vendor" : "New vendor"}
        description="Capture supplier identity, trading terms, contact points and payment details in one place."
      />

      {existing.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(existing.error)}</p> : null}
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <fieldset className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <legend className="mb-1 text-sm font-semibold text-slate-900">Identity</legend>
          <FormField label="Vendor name" htmlFor="name" error={fieldErrors.name} required>
            <Input
              id="name"
              required
              value={form.name ?? ""}
              onChange={(event) => {
                patch({ name: event.target.value });
                setFieldErrors((current) => ({ ...current, name: undefined }));
              }}
            />
          </FormField>
          <FormField label="Vendor code" htmlFor="code">
            <Input id="code" value={form.code ?? ""} placeholder="Auto-generated if blank" onChange={(event) => patch({ code: event.target.value })} />
          </FormField>
          <FormField label="Display name" htmlFor="displayName">
            <Input id="displayName" value={form.displayName ?? ""} onChange={(event) => patch({ displayName: event.target.value })} />
          </FormField>
          <FormField label="Legal name" htmlFor="legalName">
            <Input id="legalName" value={form.legalName ?? ""} onChange={(event) => patch({ legalName: event.target.value })} />
          </FormField>
          <FormField label="Status" htmlFor="status" required>
            <select
              id="status"
              required
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={form.status}
              onChange={(event) => patch({ status: event.target.value as VendorStatus })}
            >
              {(formOptions.data?.statuses ?? VENDOR_STATUSES.map((value) => ({ value, label: VENDOR_STATUS_LABELS[value] }))).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Vendor type" htmlFor="vendorType">
            <select
              id="vendorType"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={form.vendorType ?? ""}
              onChange={(event) => patch({ vendorType: event.target.value })}
            >
              <option value="">Not specified</option>
              <option value="SUPPLIER">Supplier</option>
              <option value="CONTRACTOR">Contractor</option>
              <option value="SERVICE_PROVIDER">Service provider</option>
              <option value="MANUFACTURER">Manufacturer</option>
              <option value="DISTRIBUTOR">Distributor</option>
            </select>
          </FormField>
          <FormField label="Category" htmlFor="category">
            <Input id="category" value={form.category ?? ""} onChange={(event) => patch({ category: event.target.value })} />
          </FormField>
        </fieldset>

        <fieldset className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-3">
          <legend className="mb-1 text-sm font-semibold text-slate-900">Commercial & accounting</legend>
          <FormField label="Currency" htmlFor="currencyCode" error={fieldErrors.currencyCode} required>
            <select
              id="currencyCode"
              required
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={form.currencyCode}
              onChange={(event) => {
                patch({ currencyCode: event.target.value });
                setFieldErrors((current) => ({ ...current, currencyCode: undefined }));
              }}
            >
              <option value="">Choose a currency</option>
              {(formOptions.data?.currencies ?? []).map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code}
                  {currency.name ? ` · ${currency.name}` : ""}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Payment term" htmlFor="paymentTermId">
            <select
              id="paymentTermId"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={form.paymentTermId ?? ""}
              onChange={(event) => patch({ paymentTermId: event.target.value })}
            >
              <option value="">None</option>
              {(formOptions.data?.paymentTerms ?? []).map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name} ({term.dueDays} days)
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Tax code" htmlFor="taxCodeId">
            <select
              id="taxCodeId"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={form.taxCodeId ?? ""}
              onChange={(event) => patch({ taxCodeId: event.target.value })}
            >
              <option value="">No tax code</option>
              {(formOptions.data?.taxCodes ?? []).map((tax) => (
                <option key={tax.id} value={tax.id}>
                  {tax.code} ({tax.rate}%)
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Tax ID" htmlFor="taxId">
            <Input id="taxId" value={form.taxId ?? ""} onChange={(event) => patch({ taxId: event.target.value })} />
          </FormField>
          <FormField label="Registration number" htmlFor="registrationNumber">
            <Input id="registrationNumber" value={form.registrationNumber ?? ""} onChange={(event) => patch({ registrationNumber: event.target.value })} />
          </FormField>
          <FormField label="Bank account" htmlFor="bankAccount">
            <Input id="bankAccount" value={form.bankAccount ?? ""} onChange={(event) => patch({ bankAccount: event.target.value })} />
          </FormField>
        </fieldset>

        <fieldset className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-3">
          <legend className="mb-1 text-sm font-semibold text-slate-900">Contact</legend>
          <FormField label="Email" htmlFor="email" error={fieldErrors.email}>
            <Input
              id="email"
              type="email"
              error={Boolean(fieldErrors.email)}
              value={form.email ?? ""}
              onChange={(event) => {
                patch({ email: event.target.value });
                setFieldErrors((current) => ({ ...current, email: undefined }));
              }}
            />
          </FormField>
          <FormField label="Phone" htmlFor="phone" error={fieldErrors.phone}>
            <Input
              id="phone"
              error={Boolean(fieldErrors.phone)}
              value={form.phone ?? ""}
              onChange={(event) => {
                patch({ phone: event.target.value });
                setFieldErrors((current) => ({ ...current, phone: undefined }));
              }}
            />
          </FormField>
          <FormField label="Website" htmlFor="website" error={fieldErrors.website}>
            <Input
              id="website"
              error={Boolean(fieldErrors.website)}
              value={form.website ?? ""}
              placeholder="https://"
              onChange={(event) => {
                patch({ website: event.target.value });
                setFieldErrors((current) => ({ ...current, website: undefined }));
              }}
            />
          </FormField>
        </fieldset>

        <fieldset className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-3">
          <legend className="mb-1 text-sm font-semibold text-slate-900">Address</legend>
          <FormField label="Address line 1" htmlFor="addressLine1">
            <Input id="addressLine1" value={form.addressLine1 ?? ""} onChange={(event) => patch({ addressLine1: event.target.value })} />
          </FormField>
          <FormField label="Address line 2" htmlFor="addressLine2">
            <Input id="addressLine2" value={form.addressLine2 ?? ""} onChange={(event) => patch({ addressLine2: event.target.value })} />
          </FormField>
          <FormField label="City" htmlFor="city">
            <Input id="city" value={form.city ?? ""} onChange={(event) => patch({ city: event.target.value })} />
          </FormField>
          <FormField label="State / province" htmlFor="stateProvince">
            <Input id="stateProvince" value={form.stateProvince ?? ""} onChange={(event) => patch({ stateProvince: event.target.value })} />
          </FormField>
          <FormField label="Postal code" htmlFor="postalCode">
            <Input id="postalCode" value={form.postalCode ?? ""} onChange={(event) => patch({ postalCode: event.target.value })} />
          </FormField>
          <FormField label="Country code" htmlFor="countryCode" error={fieldErrors.countryCode}>
            <Input
              id="countryCode"
              maxLength={8}
              error={Boolean(fieldErrors.countryCode)}
              value={form.countryCode ?? ""}
              placeholder="PK"
              onChange={(event) => {
                patch({ countryCode: event.target.value.toUpperCase() });
                setFieldErrors((current) => ({ ...current, countryCode: undefined }));
              }}
            />
          </FormField>
        </fieldset>

        <FormField label="Notes" htmlFor="notes">
          <textarea
            id="notes"
            className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.notes ?? ""}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </FormField>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Link className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm text-slate-700" to={id ? `/vendors/${id}` : "/vendors"}>
            Cancel
          </Link>
          <Button className="h-9 bg-brand-800 hover:bg-brand-900" disabled={busy || existing.isLoading} onClick={submit}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create vendor"}
          </Button>
        </div>
      </div>
    </section>
  );
}

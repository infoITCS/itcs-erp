import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { createReseller, getReseller, updateReseller, type ResellerWrite } from "./api.ts";

const schema = z.object({
  legalName: z.string().trim().min(1, "Enter the legal name").max(200),
  displayName: z.string().trim().min(1, "Enter the display name").max(200),
  email: z.string().trim().max(320),
  phone: z.string().trim().max(40),
  website: z.string().trim().max(200),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a two-letter country code"),
  currencyCode: z.string().trim().regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code"),
  taxNumber: z.string().trim().max(64),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
  priceListCode: z.string().trim().min(1).max(32),
  defaultDiscountPercent: z.string().trim(),
  defaultCommissionPercent: z.string().trim(),
  notes: z.string().trim().max(4000),
});

type FormValues = z.infer<typeof schema>;

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
};

export default function ResellerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useQuery({
    queryKey: ["resellers", id],
    queryFn: () => getReseller(id as string),
    enabled: Boolean(id),
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty });

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    form.reset({
      legalName: existing.data.legalName,
      displayName: existing.data.displayName,
      email: existing.data.email ?? "",
      phone: existing.data.phone ?? "",
      website: existing.data.website ?? "",
      countryCode: existing.data.countryCode.trim(),
      currencyCode: existing.data.currencyCode.trim(),
      taxNumber: existing.data.taxNumber ?? "",
      status: existing.data.status,
      priceListCode: existing.data.priceListCode,
      defaultDiscountPercent: existing.data.defaultDiscountPercent ?? "",
      defaultCommissionPercent: existing.data.defaultCommissionPercent ?? "",
      notes: existing.data.notes ?? "",
    });
  }, [existing.data, form]);

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{id ? "Edit reseller" : "New reseller"}</h1>
        <p className="mt-1 text-sm text-slate-600">The reseller number is assigned by the server.</p>
      </div>
      {existing.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(existing.error)}</p> : null}
      <form
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          const body = toWrite(values);
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
        })}
      >
        <FormField label="Legal name" htmlFor="legalName" error={form.formState.errors.legalName?.message}>
          <Input id="legalName" {...form.register("legalName")} />
        </FormField>
        <FormField label="Display name" htmlFor="displayName" error={form.formState.errors.displayName?.message}>
          <Input id="displayName" {...form.register("displayName")} />
        </FormField>
        <FormField label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" {...form.register("email")} />
        </FormField>
        <FormField label="Phone" htmlFor="phone">
          <Input id="phone" {...form.register("phone")} />
        </FormField>
        <FormField label="Website" htmlFor="website" error={form.formState.errors.website?.message}>
          <Input id="website" placeholder="https://example.com" {...form.register("website")} />
        </FormField>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Country" htmlFor="countryCode" error={form.formState.errors.countryCode?.message}>
            <Input id="countryCode" maxLength={2} {...form.register("countryCode")} />
          </FormField>
          <FormField label="Currency" htmlFor="currencyCode" error={form.formState.errors.currencyCode?.message}>
            <Input id="currencyCode" maxLength={3} {...form.register("currencyCode")} />
          </FormField>
        </div>
        <FormField label="Tax / VAT number" htmlFor="taxNumber">
          <Input id="taxNumber" {...form.register("taxNumber")} />
        </FormField>
        <FormField label="Status" htmlFor="status">
          <select id="status" className="h-9 rounded-md border border-slate-300 px-3 text-sm" {...form.register("status")}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </FormField>
        <FormField label="Price list code" htmlFor="priceListCode" error={form.formState.errors.priceListCode?.message}>
          <Input id="priceListCode" {...form.register("priceListCode")} />
        </FormField>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Default discount %" htmlFor="defaultDiscountPercent">
            <Input id="defaultDiscountPercent" placeholder="0.0000" {...form.register("defaultDiscountPercent")} />
          </FormField>
          <FormField label="Default commission %" htmlFor="defaultCommissionPercent">
            <Input id="defaultCommissionPercent" placeholder="0.0000" {...form.register("defaultCommissionPercent")} />
          </FormField>
        </div>
        <FormField label="Notes" htmlFor="notes">
          <textarea id="notes" className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm" {...form.register("notes")} />
        </FormField>
        {form.formState.errors.root ? <p className="text-sm text-red-700">{form.formState.errors.root.message}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {id ? "Save changes" : "Create reseller"}
          </Button>
          <Link to={id ? `/resellers/${id}` : "/resellers"} className="inline-flex h-9 items-center px-3 text-sm text-slate-700">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

function toWrite(values: FormValues): ResellerWrite {
  return {
    legalName: values.legalName,
    displayName: values.displayName,
    email: values.email || undefined,
    phone: values.phone || undefined,
    website: values.website || undefined,
    countryCode: values.countryCode,
    currencyCode: values.currencyCode,
    taxNumber: values.taxNumber || undefined,
    status: values.status,
    priceListCode: values.priceListCode,
    defaultDiscountPercent: values.defaultDiscountPercent || undefined,
    defaultCommissionPercent: values.defaultCommissionPercent || undefined,
    notes: values.notes || undefined,
  };
}

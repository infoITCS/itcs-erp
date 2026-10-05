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
import { createCustomer, getCustomer, updateCustomer, type CustomerWrite } from "./api.ts";

const schema = z.object({
  customerType: z.enum(["COMPANY", "INDIVIDUAL"]),
  legalName: z.string().trim().min(1, "Enter the legal name").max(200),
  displayName: z.string().trim().min(1, "Enter the display name").max(200),
  email: z.string().trim().max(320),
  phone: z.string().trim().max(40),
  website: z.string().trim().max(200),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a two-letter country code"),
  currencyCode: z.string().trim().regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code"),
  taxNumber: z.string().trim().max(64),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  notes: z.string().trim().max(4000),
});

type FormValues = z.infer<typeof schema>;

const empty: FormValues = {
  customerType: "COMPANY",
  legalName: "",
  displayName: "",
  email: "",
  phone: "",
  website: "",
  countryCode: "PK",
  currencyCode: "PKR",
  taxNumber: "",
  status: "ACTIVE",
  notes: "",
};

export default function CustomerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useQuery({
    queryKey: ["customers", id],
    queryFn: () => getCustomer(id as string),
    enabled: Boolean(id),
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty });

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    form.reset({
      customerType: existing.data.customerType,
      legalName: existing.data.legalName,
      displayName: existing.data.displayName,
      email: existing.data.email ?? "",
      phone: existing.data.phone ?? "",
      website: existing.data.website ?? "",
      countryCode: existing.data.countryCode.trim(),
      currencyCode: existing.data.currencyCode.trim(),
      taxNumber: existing.data.taxNumber ?? "",
      status: existing.data.status,
      notes: existing.data.notes ?? "",
    });
  }, [existing.data, form]);

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{id ? "Edit customer" : "New customer"}</h1>
        <p className="mt-1 text-sm text-slate-600">The customer number is assigned by the server.</p>
      </div>
      {existing.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(existing.error)}</p> : null}
      <form
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          const body = toWrite(values);
          try {
            if (id) {
              await updateCustomer(id, body);
              navigate(`/customers/${id}`);
              return;
            }
            const created = await createCustomer(body);
            navigate(`/customers/${created.customer.id}`);
          } catch (error) {
            form.setError("root", { message: getApiErrorMessage(error) });
          }
        })}
      >
        <FormField label="Type" htmlFor="customerType" error={form.formState.errors.customerType?.message}>
          <select id="customerType" className="h-9 rounded-md border border-slate-300 px-3 text-sm" {...form.register("customerType")}>
            <option value="COMPANY">Company</option>
            <option value="INDIVIDUAL">Individual</option>
          </select>
        </FormField>
        <FormField label="Legal name" htmlFor="legalName" error={form.formState.errors.legalName?.message}>
          <Input id="legalName" {...form.register("legalName")} />
        </FormField>
        <FormField label="Display name" htmlFor="displayName" error={form.formState.errors.displayName?.message}>
          <Input id="displayName" {...form.register("displayName")} />
        </FormField>
        <FormField label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" {...form.register("email")} />
        </FormField>
        <FormField label="Phone" htmlFor="phone" error={form.formState.errors.phone?.message}>
          <Input id="phone" {...form.register("phone")} />
        </FormField>
        <FormField label="Website" htmlFor="website" error={form.formState.errors.website?.message}>
          <Input id="website" placeholder="https://" {...form.register("website")} />
        </FormField>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Country" htmlFor="countryCode" error={form.formState.errors.countryCode?.message}>
            <Input id="countryCode" maxLength={2} {...form.register("countryCode")} />
          </FormField>
          <FormField label="Currency" htmlFor="currencyCode" error={form.formState.errors.currencyCode?.message}>
            <select id="currencyCode" className="h-9 rounded-md border border-slate-300 px-3 text-sm" {...form.register("currencyCode")}>
              <option value="PKR">PKR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="AED">AED</option>
            </select>
          </FormField>
        </div>
        <FormField label="Tax number" htmlFor="taxNumber" error={form.formState.errors.taxNumber?.message}>
          <Input id="taxNumber" {...form.register("taxNumber")} />
        </FormField>
        <FormField label="Status" htmlFor="status" error={form.formState.errors.status?.message}>
          <select id="status" className="h-9 rounded-md border border-slate-300 px-3 text-sm" {...form.register("status")}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </FormField>
        <FormField label="Notes" htmlFor="notes" error={form.formState.errors.notes?.message}>
          <textarea id="notes" className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...form.register("notes")} />
        </FormField>
        {form.formState.errors.root?.message ? <p className="text-sm text-red-700">{form.formState.errors.root.message}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : "Save"}
          </Button>
          <Link to={id ? `/customers/${id}` : "/customers"} className="inline-flex h-9 items-center text-sm text-slate-600">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

function toWrite(values: FormValues): CustomerWrite {
  return {
    customerType: values.customerType,
    legalName: values.legalName,
    displayName: values.displayName,
    countryCode: values.countryCode.toUpperCase(),
    currencyCode: values.currencyCode.toUpperCase(),
    status: values.status,
    ...(values.email ? { email: values.email } : {}),
    ...(values.phone ? { phone: values.phone } : {}),
    ...(values.website ? { website: values.website } : {}),
    ...(values.taxNumber ? { taxNumber: values.taxNumber } : {}),
    ...(values.notes ? { notes: values.notes } : {}),
  };
}

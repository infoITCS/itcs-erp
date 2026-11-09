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
import {
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  createLead,
  getLead,
  getLeadFormOptions,
  leadSourceLabel,
  updateLead,
  type LeadCreateWrite,
  type LeadPriority,
  type LeadSource,
  type LeadUpdateWrite,
} from "./api.ts";

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name").max(100),
  lastName: z.string().trim().min(1, "Enter a last name").max(100),
  displayName: z.string().trim().max(200),
  companyName: z.string().trim().max(200),
  jobTitle: z.string().trim().max(120),
  email: z.string().trim().max(320),
  phone: z.string().trim().max(40),
  website: z.string().trim().max(200),
  countryCode: z.string().trim().min(2, "Use a two-letter country code").max(2),
  currencyCode: z.string().trim().min(3, "Use a three-letter currency code").max(3),
  source: z.string().min(1, "Choose a source"),
  priority: z.string(),
  estimatedValue: z.string().trim(),
  ownerUserId: z.string(),
  nextAction: z.string().trim().max(500),
  nextActionDueAt: z.string(),
  description: z.string().trim().max(4000),
  notes: z.string().trim().max(4000),
});

type FormValues = z.infer<typeof schema>;

const empty: FormValues = {
  firstName: "",
  lastName: "",
  displayName: "",
  companyName: "",
  jobTitle: "",
  email: "",
  phone: "",
  website: "",
  countryCode: "PK",
  currencyCode: "PKR",
  source: "WEBSITE",
  priority: "NORMAL",
  estimatedValue: "",
  ownerUserId: "",
  nextAction: "",
  nextActionDueAt: "",
  description: "",
  notes: "",
};

export default function LeadFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useQuery({
    queryKey: ["leads", id],
    queryFn: () => getLead(id as string),
    enabled: Boolean(id),
  });
  const formOptions = useQuery({ queryKey: ["leads", "form-options"], queryFn: getLeadFormOptions });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty });

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    form.reset({
      firstName: existing.data.firstName,
      lastName: existing.data.lastName,
      displayName: existing.data.displayName,
      companyName: existing.data.companyName ?? "",
      jobTitle: existing.data.jobTitle ?? "",
      email: existing.data.email ?? "",
      phone: existing.data.phone ?? "",
      website: existing.data.website ?? "",
      countryCode: existing.data.countryCode,
      currencyCode: existing.data.currencyCode,
      source: existing.data.source,
      priority: existing.data.priority,
      estimatedValue: existing.data.estimatedValue,
      ownerUserId: existing.data.ownerUserId,
      nextAction: existing.data.nextAction ?? "",
      nextActionDueAt: existing.data.nextActionDueAt ? toLocalInput(existing.data.nextActionDueAt) : "",
      description: existing.data.description ?? "",
      notes: existing.data.notes ?? "",
    });
  }, [existing.data, form]);

  const isEdit = Boolean(id);

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="border-b border-slate-200 pb-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
          <span className="h-2 w-2 rounded-full bg-teal-600" />
          CRM / Lead management
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">{isEdit ? "Edit lead" : "New lead"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          The lead number is assigned by the server. Qualify and convert from the lead detail page.
        </p>
      </div>

      {existing.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(existing.error)}</p> : null}

      <form
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          try {
            if (id) {
              await updateLead(id, toUpdateWrite(values));
              navigate(`/leads/${id}`);
              return;
            }
            const created = await createLead(toCreateWrite(values));
            navigate(`/leads/${created.id}`);
          } catch (error) {
            form.setError("root", { message: getApiErrorMessage(error) });
          }
        })}
      >
        {form.formState.errors.root?.message ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-semibold text-slate-900">Contact details</legend>
          <FormField label="First name" htmlFor="firstName" error={form.formState.errors.firstName?.message}>
            <Input id="firstName" {...form.register("firstName")} />
          </FormField>
          <FormField label="Last name" htmlFor="lastName" error={form.formState.errors.lastName?.message}>
            <Input id="lastName" {...form.register("lastName")} />
          </FormField>
          <FormField label="Display name" htmlFor="displayName" error={form.formState.errors.displayName?.message}>
            <Input id="displayName" placeholder="Defaults to company or full name" {...form.register("displayName")} />
          </FormField>
          <FormField label="Company" htmlFor="companyName">
            <Input id="companyName" {...form.register("companyName")} />
          </FormField>
          <FormField label="Job title" htmlFor="jobTitle">
            <Input id="jobTitle" {...form.register("jobTitle")} />
          </FormField>
          <FormField label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
            <Input id="email" type="email" {...form.register("email")} />
          </FormField>
          <FormField label="Phone" htmlFor="phone">
            <Input id="phone" {...form.register("phone")} />
          </FormField>
          <FormField label="Website" htmlFor="website">
            <Input id="website" placeholder="https://" {...form.register("website")} />
          </FormField>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-semibold text-slate-900">Qualification</legend>
          <FormField label="Source" htmlFor="source" error={form.formState.errors.source?.message}>
            <select
              id="source"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-500"
              {...form.register("source")}
            >
              {LEAD_SOURCES.map((value) => (
                <option key={value} value={value}>
                  {leadSourceLabel(value)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Priority" htmlFor="priority">
            <select
              id="priority"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-500"
              {...form.register("priority")}
            >
              {LEAD_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {value[0] + value.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Estimated value" htmlFor="estimatedValue">
            <Input id="estimatedValue" inputMode="decimal" placeholder="0.00" {...form.register("estimatedValue")} />
          </FormField>
          <FormField label="Owner" htmlFor="ownerUserId">
            <select
              id="ownerUserId"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-500"
              {...form.register("ownerUserId")}
            >
              <option value="">Me (default)</option>
              {(formOptions.data?.owners ?? []).map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.firstName} {owner.lastName}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Country code" htmlFor="countryCode" error={form.formState.errors.countryCode?.message}>
            <Input id="countryCode" maxLength={2} className="uppercase" {...form.register("countryCode")} />
          </FormField>
          <FormField label="Currency" htmlFor="currencyCode" error={form.formState.errors.currencyCode?.message}>
            <Input id="currencyCode" maxLength={3} className="uppercase" {...form.register("currencyCode")} />
          </FormField>
          <FormField label="Next action" htmlFor="nextAction">
            <Input id="nextAction" placeholder="Follow up call, send proposal…" {...form.register("nextAction")} />
          </FormField>
          <FormField label="Next action due" htmlFor="nextActionDueAt">
            <Input id="nextActionDueAt" type="datetime-local" {...form.register("nextActionDueAt")} />
          </FormField>
        </fieldset>

        <FormField label="Description" htmlFor="description">
          <textarea
            id="description"
            className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...form.register("description")}
          />
        </FormField>
        <FormField label="Notes" htmlFor="notes">
          <textarea
            id="notes"
            className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...form.register("notes")}
          />
        </FormField>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Link
            className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm text-slate-700"
            to={id ? `/leads/${id}` : "/leads"}
          >
            Cancel
          </Link>
          <Button type="submit" className="h-9 bg-teal-800 hover:bg-teal-900" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : id ? "Save changes" : "Create lead"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function baseWrite(values: FormValues) {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    displayName: values.displayName || undefined,
    companyName: values.companyName || undefined,
    jobTitle: values.jobTitle || undefined,
    email: values.email || undefined,
    phone: values.phone || undefined,
    website: values.website || undefined,
    countryCode: values.countryCode.toUpperCase(),
    currencyCode: values.currencyCode.toUpperCase(),
    source: values.source as LeadSource,
    priority: (values.priority || undefined) as LeadPriority | undefined,
    estimatedValue: values.estimatedValue || undefined,
    ownerUserId: values.ownerUserId || undefined,
    nextAction: values.nextAction || undefined,
    nextActionDueAt: values.nextActionDueAt ? new Date(values.nextActionDueAt).toISOString() : undefined,
    description: values.description || undefined,
    notes: values.notes || undefined,
  };
}

function toCreateWrite(values: FormValues): LeadCreateWrite {
  return baseWrite(values);
}

function toUpdateWrite(values: FormValues): LeadUpdateWrite {
  return {
    ...baseWrite(values),
    companyName: values.companyName || null,
    jobTitle: values.jobTitle || null,
    email: values.email || null,
    phone: values.phone || null,
    website: values.website || null,
    nextAction: values.nextAction || null,
    nextActionDueAt: values.nextActionDueAt ? new Date(values.nextActionDueAt).toISOString() : null,
    description: values.description || null,
    notes: values.notes || null,
  };
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  leadPriorityLabel,
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
  email: z.string().trim().max(320).refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Enter a valid email address"),
  phone: z.string().trim().max(40).refine((value) => !value || (/^\+?[0-9(). -]{7,40}$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7), "Enter a valid phone number"),
  website: z.string().trim().max(200).refine((value) => !value || /^https?:\/\/\S+$/i.test(value), "Enter an http or https URL"),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a two-letter country code"),
  currencyCode: z.string().trim().regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code"),
  source: z.string().refine((value) => LEAD_SOURCES.includes(value as LeadSource), "Choose a valid source"),
  priority: z.string().refine((value) => LEAD_PRIORITIES.includes(value as LeadPriority), "Choose a valid priority"),
  estimatedValue: z.string().trim().refine((value) => !value || /^\d{1,15}(\.\d{1,4})?$/.test(value), "Enter a non-negative amount with up to 4 decimals"),
  ownerUserId: z.string(),
  nextAction: z.string().trim().max(500),
  nextActionDueAt: z.string().refine((value) => !value || Number.isFinite(new Date(value).getTime()), "Choose a valid due date"),
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

const selectClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100";

export default function LeadFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const existing = useQuery({
    queryKey: ["leads", id],
    queryFn: () => getLead(id as string),
    enabled: Boolean(id),
  });
  const formOptions = useQuery({ queryKey: ["leads", "form-options"], queryFn: getLeadFormOptions });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty, mode: "onTouched" });
  const isEdit = Boolean(id);
  const isLocked = Boolean(existing.data && (["CONVERTED", "WON"].includes(existing.data.status) || existing.data.deletedAt));

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      if (id) {
        await updateLead(id, toUpdateWrite(values));
        return id;
      }
      const created = await createLead(toCreateWrite(values));
      return created.id;
    },
    onSuccess: async (leadId) => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      navigate(`/leads/${leadId}`);
    },
    onError: (error) => form.setError("root", { message: getApiErrorMessage(error) }),
  });

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

  if (isEdit && existing.isPending) {
    return (
      <section className="mx-auto flex max-w-5xl flex-col gap-5">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  if (isEdit && (existing.isError || !existing.data)) {
    return (
      <section className="mx-auto max-w-5xl">
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {existing.isError ? getApiErrorMessage(existing.error) : "Lead not found"}
          <div className="mt-3"><Link className="font-semibold underline" to="/leads">Back to leads</Link></div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-sky-400" />
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> CRM / Lead management
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">{isEdit ? "Edit lead" : "New lead"}</h1>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              {isEdit
                ? `Updating ${existing.data?.displayName} (${existing.data?.leadNumber}). Qualification and conversion are managed on the detail page.`
                : "Capture the enquiry here. The lead number is assigned automatically; qualify and convert from the detail page."}
            </p>
          </div>
          <Link to={isEdit ? `/leads/${id}` : "/leads"} className="inline-flex h-10 w-fit items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Cancel
          </Link>
        </div>
      </header>

      {isLocked ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This lead is {existing.data?.status.toLowerCase()} and can no longer be edited. Reopen the related opportunity if you need to continue work on it.
        </div>
      ) : null}

      <form
        className="flex flex-col gap-5"
        noValidate
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
      >
        {form.formState.errors.root?.message ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {form.formState.errors.root.message}
          </div>
        ) : null}

        <fieldset disabled={isLocked || save.isPending} className="flex flex-col gap-5 disabled:opacity-60">
          <FormSection title="Contact details" subtitle="Who is this lead and how can we reach them?">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="First name" htmlFor="firstName" error={form.formState.errors.firstName?.message} required>
                <Input id="firstName" {...form.register("firstName")} />
              </FormField>
              <FormField label="Last name" htmlFor="lastName" error={form.formState.errors.lastName?.message} required>
                <Input id="lastName" {...form.register("lastName")} />
              </FormField>
              <FormField label="Display name" htmlFor="displayName" error={form.formState.errors.displayName?.message}>
                <Input id="displayName" placeholder="Defaults to company or full name" {...form.register("displayName")} />
              </FormField>
              <FormField label="Company" htmlFor="companyName" error={form.formState.errors.companyName?.message}>
                <Input id="companyName" {...form.register("companyName")} />
              </FormField>
              <FormField label="Job title" htmlFor="jobTitle" error={form.formState.errors.jobTitle?.message}>
                <Input id="jobTitle" {...form.register("jobTitle")} />
              </FormField>
              <FormField label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
                <Input id="email" type="email" {...form.register("email")} />
              </FormField>
              <FormField label="Phone" htmlFor="phone" error={form.formState.errors.phone?.message}>
                <Input id="phone" {...form.register("phone")} />
              </FormField>
              <FormField label="Website" htmlFor="website" error={form.formState.errors.website?.message}>
                <Input id="website" placeholder="https://" {...form.register("website")} />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Qualification" subtitle="Source, ownership and expected deal value.">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Source" htmlFor="source" error={form.formState.errors.source?.message} required>
                <select id="source" className={selectClass} {...form.register("source")}>
                  {LEAD_SOURCES.map((value) => <option key={value} value={value}>{leadSourceLabel(value)}</option>)}
                </select>
              </FormField>
              <FormField label="Priority" htmlFor="priority" error={form.formState.errors.priority?.message}>
                <select id="priority" className={selectClass} {...form.register("priority")}>
                  {LEAD_PRIORITIES.map((value) => <option key={value} value={value}>{leadPriorityLabel(value)}</option>)}
                </select>
              </FormField>
              <FormField label="Estimated value" htmlFor="estimatedValue" error={form.formState.errors.estimatedValue?.message}>
                <Input id="estimatedValue" inputMode="decimal" placeholder="0.00" {...form.register("estimatedValue")} />
              </FormField>
              <FormField label="Owner" htmlFor="ownerUserId">
                <select id="ownerUserId" className={selectClass} {...form.register("ownerUserId")}>
                  <option value="">Me (default)</option>
                  {(formOptions.data?.owners ?? []).map((owner) => (
                    <option key={owner.id} value={owner.id}>{owner.firstName} {owner.lastName}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Country code" htmlFor="countryCode" error={form.formState.errors.countryCode?.message} required>
                <Input id="countryCode" maxLength={2} className="uppercase" {...form.register("countryCode")} />
              </FormField>
              <FormField label="Currency" htmlFor="currencyCode" error={form.formState.errors.currencyCode?.message} required>
                <Input id="currencyCode" maxLength={3} className="uppercase" {...form.register("currencyCode")} />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Follow-up & notes" subtitle="Set the next action so this lead stays in the pipeline.">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Next action" htmlFor="nextAction" error={form.formState.errors.nextAction?.message}>
                <Input id="nextAction" placeholder="Follow-up call, send proposal…" {...form.register("nextAction")} />
              </FormField>
              <FormField label="Next action due" htmlFor="nextActionDueAt" error={form.formState.errors.nextActionDueAt?.message}>
                <Input id="nextActionDueAt" type="datetime-local" {...form.register("nextActionDueAt")} />
              </FormField>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FormField label="Description" htmlFor="description" error={form.formState.errors.description?.message}>
                <textarea id="description" className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm" {...form.register("description")} />
              </FormField>
              <FormField label="Internal notes" htmlFor="notes" error={form.formState.errors.notes?.message}>
                <textarea id="notes" className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm" {...form.register("notes")} />
              </FormField>
            </div>
          </FormSection>
        </fieldset>

        <div className="flex flex-wrap justify-end gap-2 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
          <Link to={isEdit ? `/leads/${id}` : "/leads"} className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Cancel
          </Link>
          <Button type="submit" className="h-10 bg-brand-800 px-5 font-semibold hover:bg-brand-900" disabled={save.isPending || isLocked}>
            {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Create lead"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function FormSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h2 className="text-sm font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
      {children}
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
    priority: values.priority as LeadPriority,
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

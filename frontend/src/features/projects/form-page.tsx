import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  PROJECT_INITIAL_STATUSES,
  PROJECT_STATUSES,
  createProject,
  getProject,
  getProjectFormOptions,
  updateProject,
  type ProjectCreateWrite,
  type ProjectStatus,
  type ProjectUpdateWrite,
} from "./api.ts";
import { statusLabel } from "./shared.tsx";

const controlClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50";
const textareaClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50";

const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Enter a valid email address");

const schema = z.object({
  name: z.string().trim().min(1, "Enter a project name").max(200),
  description: z.string().trim().max(4000),
  status: z.enum(PROJECT_STATUSES),
  customerId: z.string(),
  contactId: z.string(),
  ownerUserId: z.string(),
  customerContactName: z.string().trim().max(120),
  customerContactEmail: optionalEmail,
  customerContactPhone: z.string().trim().max(40),
  supplierCompany: z.string().trim().max(200),
  supplierContactName: z.string().trim().max(120),
  supplierContactEmail: optionalEmail,
  supplierContactPhone: z.string().trim().max(40),
  currencyCode: z.string().trim().regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code"),
  startDate: z.string(),
  dueDate: z.string(),
  notes: z.string().trim().max(4000),
});

type FormValues = z.infer<typeof schema>;
type Tab = "project" | "contacts" | "setup";

const empty: FormValues = {
  name: "",
  description: "",
  status: "PLANNED",
  customerId: "",
  contactId: "",
  ownerUserId: "",
  customerContactName: "",
  customerContactEmail: "",
  customerContactPhone: "",
  supplierCompany: "",
  supplierContactName: "",
  supplierContactEmail: "",
  supplierContactPhone: "",
  currencyCode: "PKR",
  startDate: "",
  dueDate: "",
  notes: "",
};

export default function ProjectFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [tab, setTab] = useState<Tab>("project");
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty, mode: "onTouched" });

  const existing = useQuery({ queryKey: ["projects", id], queryFn: () => getProject(id as string), enabled: isEdit });
  const formOptions = useQuery({
    queryKey: ["projects", "form-options"],
    queryFn: getProjectFormOptions,
    staleTime: 5 * 60_000,
  });

  const customerId = form.watch("customerId");
  const status = form.watch("status");
  const currencyCode = form.watch("currencyCode");
  const descriptionLength = form.watch("description")?.length ?? 0;

  const contacts = useMemo(
    () => (formOptions.data?.contacts ?? []).filter((contact) => !customerId || contact.customerId === customerId),
    [formOptions.data, customerId],
  );

  const statusChoices = useMemo<ProjectStatus[]>(
    () => (isEdit && existing.data ? [...PROJECT_STATUSES] : PROJECT_INITIAL_STATUSES),
    [isEdit, existing.data],
  );

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    form.reset({
      name: existing.data.name,
      description: existing.data.description ?? "",
      status: existing.data.status,
      customerId: existing.data.customerId ?? "",
      contactId: existing.data.contactId ?? "",
      ownerUserId: existing.data.ownerUserId ?? "",
      customerContactName: existing.data.customerContactName ?? "",
      customerContactEmail: existing.data.customerContactEmail ?? "",
      customerContactPhone: existing.data.customerContactPhone ?? "",
      supplierCompany: existing.data.supplierCompany ?? "",
      supplierContactName: existing.data.supplierContactName ?? "",
      supplierContactEmail: existing.data.supplierContactEmail ?? "",
      supplierContactPhone: existing.data.supplierContactPhone ?? "",
      currencyCode: existing.data.currencyCode,
      startDate: existing.data.startDate ? String(existing.data.startDate).slice(0, 10) : "",
      dueDate: existing.data.dueDate ? String(existing.data.dueDate).slice(0, 10) : "",
      notes: existing.data.notes ?? "",
    });
  }, [existing.data, form]);

  useEffect(() => {
    if (!formOptions.isSuccess) {
      return;
    }
    const currentContactId = form.getValues("contactId");
    if (customerId && currentContactId && !contacts.some((contact) => contact.id === currentContactId)) {
      form.setValue("contactId", "");
    }
  }, [customerId, contacts, form, formOptions.isSuccess]);

  const submit = form.handleSubmit(async (values) => {
    try {
      if (id) {
        await updateProject(id, toUpdateWrite(values));
        navigate(`/projects/${id}`);
        return;
      }
      const created = await createProject(toCreateWrite(values));
      navigate(`/projects/${created.id}`);
    } catch (error) {
      form.setError("root", { message: getApiErrorMessage(error) });
    }
  });

  const currency = currencyCode || "PKR";

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-sky-400" />
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 sm:flex">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">Delivery / Project portfolio</p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">{isEdit ? "Edit project" : "New project"}</h1>
              <p className="mt-1.5 text-sm text-slate-600">Add the project brief and contacts. Income, cost, and profit are calculated automatically from customer documents.</p>
            </div>
          </div>
          <Link to={isEdit ? `/projects/${id}` : "/projects"} className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50">
            Cancel
          </Link>
        </div>
      </header>

      {existing.isError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{getApiErrorMessage(existing.error)}</p> : null}
      {formOptions.isError ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Options could not be loaded. {getApiErrorMessage(formOptions.error)}</p> : null}

      <form className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]" noValidate onSubmit={submit}>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/60 px-3 pt-3 sm:px-5">
            <TabButton label="Project details" active={tab === "project"} onClick={() => setTab("project")} />
            <TabButton label="Contacts" active={tab === "contacts"} onClick={() => setTab("contacts")} />
            <TabButton label="Finance setup" active={tab === "setup"} onClick={() => setTab("setup")} />
          </div>

          <div className="p-5 sm:p-6">
            {tab === "project" ? (
              <div className="grid gap-5">
                <FormSection title="Project identity" description="The core record shown across the delivery portfolio." icon="folder">
                  <FormField label="Project name" htmlFor="name" error={form.formState.errors.name?.message} required>
                    <Input id="name" className={controlClass} placeholder="ERP implementation and rollout" {...form.register("name")} />
                  </FormField>
                  <div className="mt-4">
                    <div className="relative">
                      <textarea id="description" maxLength={4000} className={`${textareaClass} min-h-28`} placeholder="Scope, deliverables, success criteria…" {...form.register("description")} />
                      <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">{descriptionLength}/4000</span>
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Delivery status" description="Track where this project stands and who is accountable." icon="flag">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Status" htmlFor="status" error={form.formState.errors.status?.message} required>
                      <select id="status" className={controlClass} {...form.register("status")}>
                        {statusChoices.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Owner" htmlFor="ownerUserId">
                      <select id="ownerUserId" className={controlClass} disabled={formOptions.isPending} {...form.register("ownerUserId")}>
                        <option value="">{isEdit ? "Keep current owner" : "Assign to me"}</option>
                        {(formOptions.data?.owners ?? []).map((owner) => <option key={owner.id} value={owner.id}>{owner.firstName} {owner.lastName} · {owner.email}</option>)}
                      </select>
                    </FormField>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <FormField label="Start date" htmlFor="startDate">
                      <Input id="startDate" type="date" className={controlClass} {...form.register("startDate")} />
                    </FormField>
                    <FormField label="Due date" htmlFor="dueDate">
                      <Input id="dueDate" type="date" className={controlClass} {...form.register("dueDate")} />
                    </FormField>
                  </div>
                </FormSection>
              </div>
            ) : null}

            {tab === "contacts" ? (
              <div className="grid gap-5">
                <FormSection title="Customer contact" description="Optionally link an existing customer contact or keep a local contact snapshot." icon="users">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Customer" htmlFor="customerId">
                      <select id="customerId" className={controlClass} disabled={formOptions.isPending} {...form.register("customerId")}>
                        <option value="">{formOptions.isPending ? "Loading customers…" : "No linked customer"}</option>
                        {(formOptions.data?.customers ?? []).map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName} ({customer.customerNumber})</option>)}
                      </select>
                    </FormField>
                    <FormField label="Existing contact" htmlFor="contactId">
                      <select id="contactId" className={`${controlClass} disabled:bg-slate-50`} disabled={!customerId} {...form.register("contactId")}>
                        <option value="">{!customerId ? "Choose a customer first" : "No specific contact"}</option>
                        {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.displayName}{contact.email ? ` · ${contact.email}` : ""}</option>)}
                      </select>
                    </FormField>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <FormField label="Contact name" htmlFor="customerContactName">
                      <Input id="customerContactName" className={controlClass} placeholder="Optional local contact" {...form.register("customerContactName")} />
                    </FormField>
                    <FormField label="Contact email" htmlFor="customerContactEmail" error={form.formState.errors.customerContactEmail?.message}>
                      <Input id="customerContactEmail" type="email" className={controlClass} placeholder="name@company.com" {...form.register("customerContactEmail")} />
                    </FormField>
                    <FormField label="Contact phone" htmlFor="customerContactPhone">
                      <Input id="customerContactPhone" className={controlClass} placeholder="+92 300 0000000" {...form.register("customerContactPhone")} />
                    </FormField>
                  </div>
                </FormSection>

                <FormSection title="Supplier contact" description="Store supplier details on the project; no vendor record is required." icon="building">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Supplier company" htmlFor="supplierCompany">
                      <Input id="supplierCompany" className={controlClass} placeholder="Systems Ltd" {...form.register("supplierCompany")} />
                    </FormField>
                    <FormField label="Supplier contact name" htmlFor="supplierContactName">
                      <Input id="supplierContactName" className={controlClass} placeholder="Contact person" {...form.register("supplierContactName")} />
                    </FormField>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <FormField label="Supplier email" htmlFor="supplierContactEmail" error={form.formState.errors.supplierContactEmail?.message}>
                      <Input id="supplierContactEmail" type="email" className={controlClass} placeholder="supplier@example.com" {...form.register("supplierContactEmail")} />
                    </FormField>
                    <FormField label="Supplier phone" htmlFor="supplierContactPhone">
                      <Input id="supplierContactPhone" className={controlClass} placeholder="+92 300 0000000" {...form.register("supplierContactPhone")} />
                    </FormField>
                  </div>
                </FormSection>
              </div>
            ) : null}

            {tab === "setup" ? (
              <div className="grid gap-5">
                <FormSection title="Reporting currency" description="Sets the currency used for this project's live financial view." icon="wallet">
                  <FormField label="Currency" htmlFor="currencyCode" error={form.formState.errors.currencyCode?.message} required>
                    <select id="currencyCode" className={controlClass} disabled={formOptions.isPending} {...form.register("currencyCode")}>
                      <option value="">{formOptions.isPending ? "Loading…" : "Select currency"}</option>
                      {(formOptions.data?.currencies ?? []).map((currency) => <option key={currency.code} value={currency.code}>{currency.code} · {currency.name}</option>)}
                    </select>
                  </FormField>
                  <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-xs leading-6 text-slate-600">
                    <p className="font-bold text-brand-800">Financial figures are automatic</p>
                    <p className="mt-1">Income comes from the customer's invoices, payments show what has been received, and expenses/bills will feed cost as soon as those modules are available. There are no manual income or cost fields.</p>
                  </div>
                </FormSection>

                <FormSection title="Internal notes" description="Context for the delivery team. Not shown on customer documents." icon="note">
                  <textarea id="notes" maxLength={4000} className={`${textareaClass} min-h-32`} placeholder="Risks, dependencies, approvals…" {...form.register("notes")} />
                </FormSection>
              </div>
            ) : null}

            {form.formState.errors.root ? (
              <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{form.formState.errors.root.message}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-5 py-4">
            <p className="text-xs text-slate-500">All fields except the project name are optional.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setTab(tab === "project" ? "setup" : tab === "setup" ? "contacts" : "project")}>Previous</Button>
              <Button type="button" variant="secondary" onClick={() => setTab(tab === "project" ? "contacts" : tab === "contacts" ? "setup" : "project")}>Next</Button>
              <Button type="submit" disabled={form.formState.isSubmitting || (isEdit && existing.isPending) || formOptions.isPending} className="bg-brand-800 hover:bg-brand-900">
                {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create project"}
              </Button>
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 via-white to-sky-50/70 p-5 shadow-inner ring-1 ring-brand-50 lg:sticky lg:top-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">Live project view</p>
          <p className="mt-4 text-xs font-medium text-slate-500">Project</p>
          <p className="mt-1 text-lg font-bold tracking-tight text-slate-950">{form.watch("name") || "Untitled project"}</p>
          <p className="mt-1 text-xs text-slate-500">{statusLabel(status)} · {currency}</p>

          <div className="mt-5 space-y-2 rounded-xl border border-white bg-white/80 p-4 shadow-sm text-xs leading-5 text-slate-600">
            <p className="font-bold text-slate-900">What you will see after saving</p>
            <p><span className="font-semibold text-brand-800">Income</span> — total from this customer's invoices.</p>
            <p><span className="font-semibold text-emerald-700">Received</span> — payments already recorded.</p>
            <p><span className="font-semibold text-amber-700">Outstanding</span> — invoice balance still open.</p>
            <p><span className="font-semibold text-slate-800">Cost & profit</span> — cost feeds from expenses/bills when available.</p>
          </div>

          <p className="mt-3 text-[11px] leading-5 text-slate-500">A project number is assigned automatically after creation. Figures refresh whenever customer documents change.</p>
        </aside>
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

function FormSection({ title, description, icon, children }: { title: string; description: string; icon: "folder" | "flag" | "users" | "building" | "wallet" | "note"; children: ReactNode }) {
  const icons: Record<typeof icon, ReactNode> = {
    folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></>,
    flag: <><path d="M4 22V4M4 5h13l-2 4 2 4H4" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 21v-4h6v4M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01" /></>,
    wallet: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>,
    note: <><path d="M4 4h16v12l-4 4H4z" /><path d="M16 20v-4h4" /></>,
  };
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-600 via-sky-400 to-emerald-400" />
      <div className="mb-5 flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[icon]}</svg>
        </span>
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Icon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}

function optional(value: string): string | undefined {
  return value ? value : undefined;
}

function toCreateWrite(values: FormValues): ProjectCreateWrite {
  return {
    name: values.name,
    description: optional(values.description),
    status: values.status,
    customerId: optional(values.customerId),
    contactId: optional(values.contactId),
    ownerUserId: optional(values.ownerUserId),
    customerContactName: optional(values.customerContactName),
    customerContactEmail: optional(values.customerContactEmail),
    customerContactPhone: optional(values.customerContactPhone),
    supplierCompany: optional(values.supplierCompany),
    supplierContactName: optional(values.supplierContactName),
    supplierContactEmail: optional(values.supplierContactEmail),
    supplierContactPhone: optional(values.supplierContactPhone),
    currencyCode: values.currencyCode.trim().toUpperCase(),
    startDate: optional(values.startDate),
    dueDate: optional(values.dueDate),
    notes: optional(values.notes),
  };
}

function toUpdateWrite(values: FormValues): ProjectUpdateWrite {
  return {
    name: values.name,
    description: values.description || null,
    status: values.status,
    customerId: values.customerId || null,
    contactId: values.contactId || null,
    ownerUserId: values.ownerUserId || null,
    customerContactName: values.customerContactName || null,
    customerContactEmail: values.customerContactEmail || null,
    customerContactPhone: values.customerContactPhone || null,
    supplierCompany: values.supplierCompany || null,
    supplierContactName: values.supplierContactName || null,
    supplierContactEmail: values.supplierContactEmail || null,
    supplierContactPhone: values.supplierContactPhone || null,
    currencyCode: values.currencyCode.trim().toUpperCase(),
    startDate: values.startDate || null,
    dueDate: values.dueDate || null,
    notes: values.notes || null,
  };
}

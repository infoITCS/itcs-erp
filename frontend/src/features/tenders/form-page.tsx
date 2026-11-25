import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { listContacts } from "@/features/customers/api.ts";
import { codeSelectOptions } from "@/features/resellers/options.ts";
import { listCurrencies } from "@/services/currencies.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  TENDER_STATUSES,
  createTender,
  getTender,
  getTenderFormOptions,
  updateTender,
  type TenderCreateWrite,
  type TenderStatus,
  type TenderUpdateWrite,
} from "./api.ts";
import {
  formatMoney,
  statusLabel,
  TenderStatusBadge,
  toLocalDateTimeInput,
} from "./shared.tsx";
import {
  TENDER_INITIAL_STATUSES,
  TENDER_STAGES,
  TENDER_STATUS_HELP,
  isTerminalTenderStatus,
  nextTenderStatuses,
  tenderStageIndex,
} from "./workflow.ts";

const amountPattern = /^\d{1,15}(\.\d{1,4})?$/;
const controlClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50";
const textareaClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50";

const schema = z
  .object({
    title: z.string().trim().min(1, "Enter a title").max(200),
    referenceNumber: z.string().trim().max(120),
    status: z.enum(TENDER_STATUSES),
    customerId: z.string().min(1, "Choose a customer"),
    contactId: z.string(),
    ownerUserId: z.string(),
    estimatedValue: z.string().trim().regex(amountPattern, "Enter a non-negative amount with up to 4 decimals"),
    currencyCode: z.string().trim().regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code"),
    submissionDeadline: z.string(),
    expectedAwardDate: z.string(),
    description: z.string().trim().max(4000),
    notes: z.string().trim().max(4000),
  })
  .superRefine((values, ctx) => {
    if (!values.submissionDeadline || !values.expectedAwardDate) {
      return;
    }
    const deadline = new Date(values.submissionDeadline);
    if (Number.isNaN(deadline.getTime())) {
      return;
    }
    const deadlineDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    const awardDay = new Date(`${values.expectedAwardDate}T00:00:00`);
    if (!Number.isNaN(awardDay.getTime()) && awardDay < deadlineDay) {
      ctx.addIssue({
        code: "custom",
        path: ["expectedAwardDate"],
        message: "Award date cannot be before the submission date",
      });
    }
  });

type FormValues = z.infer<typeof schema>;
type Tab = "brief" | "commercials" | "review";

const empty: FormValues = {
  title: "",
  referenceNumber: "",
  status: "DRAFT",
  customerId: "",
  contactId: "",
  ownerUserId: "",
  estimatedValue: "0",
  currencyCode: "PKR",
  submissionDeadline: "",
  expectedAwardDate: "",
  description: "",
  notes: "",
};

export default function TenderFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [tab, setTab] = useState<Tab>("brief");
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty, mode: "onTouched" });

  const existing = useQuery({
    queryKey: ["tenders", id],
    queryFn: () => getTender(id as string),
    enabled: isEdit,
  });
  const formOptions = useQuery({
    queryKey: ["tenders", "form-options"],
    queryFn: getTenderFormOptions,
    staleTime: 5 * 60_000,
  });
  const currencies = useQuery({
    queryKey: ["currencies"],
    queryFn: listCurrencies,
    staleTime: 5 * 60_000,
  });

  const customerId = form.watch("customerId");
  const status = form.watch("status");
  const estimatedValue = form.watch("estimatedValue");
  const currencyCode = form.watch("currencyCode");
  const descriptionLength = form.watch("description")?.length ?? 0;
  const notesLength = form.watch("notes")?.length ?? 0;
  const customerRef = useRef("");

  const contacts = useQuery({
    queryKey: ["customers", customerId, "contacts"],
    queryFn: () => listContacts(customerId),
    enabled: Boolean(customerId),
  });

  const currencyOptions = useMemo(
    () =>
      codeSelectOptions(
        (currencies.data ?? [])
          .filter((currency) => currency.isActive)
          .map((currency) => ({ code: currency.code, name: currency.name })),
        currencyCode,
      ),
    [currencies.data, currencyCode],
  );

  const statusChoices = useMemo(() => {
    if (!isEdit || !existing.data) {
      return TENDER_INITIAL_STATUSES;
    }
    return [existing.data.status, ...nextTenderStatuses(existing.data.status)];
  }, [isEdit, existing.data]);

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    form.reset({
      title: existing.data.title,
      referenceNumber: existing.data.referenceNumber ?? "",
      status: existing.data.status,
      customerId: existing.data.customerId,
      contactId: existing.data.contactId ?? "",
      ownerUserId: existing.data.ownerUserId,
      estimatedValue: existing.data.estimatedValue,
      currencyCode: existing.data.currencyCode,
      submissionDeadline: existing.data.submissionDeadline
        ? toLocalDateTimeInput(existing.data.submissionDeadline)
        : "",
      expectedAwardDate: existing.data.expectedAwardDate
        ? String(existing.data.expectedAwardDate).slice(0, 10)
        : "",
      description: existing.data.description ?? "",
      notes: existing.data.notes ?? "",
    });
  }, [existing.data, form]);

  useEffect(() => {
    if (customerRef.current && customerRef.current !== customerId) {
      form.setValue("contactId", "");
    }
    customerRef.current = customerId;
  }, [customerId, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      if (id) {
        await updateTender(id, toUpdateWrite(values));
        navigate(`/tenders/${id}`);
        return;
      }
      const created = await createTender(toCreateWrite(values));
      navigate(`/tenders/${created.id}`);
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h6" />
              </svg>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">CRM / Bid management</p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">{isEdit ? "Edit tender" : "New tender"}</h1>
              <p className="mt-1.5 text-sm text-slate-600">A tender number is assigned by the server. Build the brief, set commercial terms, then review the workflow stage.</p>
            </div>
          </div>
          <Link to={isEdit ? `/tenders/${id}` : "/tenders"} className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50">
            Cancel
          </Link>
        </div>
      </header>

      {existing.isError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{getApiErrorMessage(existing.error)}</p> : null}
      {formOptions.isError || currencies.isError ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Customer, owner or currency options could not be loaded. {getApiErrorMessage(formOptions.error ?? currencies.error)}</p> : null}

      <form className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm" noValidate onSubmit={submit}>
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/60 px-3 pt-3 sm:px-5">
          <TabButton label="Tender brief" active={tab === "brief"} onClick={() => setTab("brief")} />
          <TabButton label="Commercials & dates" active={tab === "commercials"} onClick={() => setTab("commercials")} />
          <TabButton label="Review & notes" active={tab === "review"} onClick={() => setTab("review")} />
        </div>

        <div className="p-5 sm:p-6">
          {tab === "brief" ? (
            <div className="grid gap-5">
              <FormSection title="Tender identity" description="The core record used across the bid register and customer history." icon="file">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
                  <FormField label="Title" htmlFor="title" error={form.formState.errors.title?.message} required>
                    <Input id="title" className={controlClass} placeholder="Network refresh and maintenance" {...form.register("title")} />
                  </FormField>
                  <FormField label="Workflow status" htmlFor="status" required>
                    <select id="status" className={`${controlClass} disabled:bg-slate-50`} disabled={isTerminalTenderStatus(status) || (formOptions.isPending && !isEdit)} {...form.register("status")}>
                      {statusChoices.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
                    </select>
                    <p className="text-xs leading-5 text-slate-500">{TENDER_STATUS_HELP[status]}</p>
                  </FormField>
                </div>
                <div className="mt-4">
                  <FormField label="Reference number" htmlFor="referenceNumber" error={form.formState.errors.referenceNumber?.message}>
                    <Input id="referenceNumber" className={controlClass} placeholder="Customer or portal reference" {...form.register("referenceNumber")} />
                  </FormField>
                </div>
              </FormSection>

              <FormSection title="Customer & ownership" description="Links the bid to a customer, contact and accountable owner." icon="users">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Customer" htmlFor="customerId" error={form.formState.errors.customerId?.message} required>
                    <select id="customerId" className={controlClass} disabled={formOptions.isPending} {...form.register("customerId")}>
                      <option value="">{formOptions.isPending ? "Loading customers…" : "Select customer"}</option>
                      {(formOptions.data?.customers ?? []).map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName} ({customer.customerNumber})</option>)}
                    </select>
                  </FormField>
                  <FormField label="Contact" htmlFor="contactId">
                    <select id="contactId" className={`${controlClass} disabled:bg-slate-50`} disabled={!customerId || contacts.isPending} {...form.register("contactId")}>
                      <option value="">{!customerId ? "Choose a customer first" : contacts.isPending ? "Loading contacts…" : "No specific contact"}</option>
                      {(contacts.data?.items ?? []).map((contact) => <option key={contact.id} value={contact.id}>{contact.displayName}{contact.email ? ` · ${contact.email}` : ""}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Owner" htmlFor="ownerUserId">
                    <select id="ownerUserId" className={controlClass} disabled={formOptions.isPending} {...form.register("ownerUserId")}>
                      <option value="">{isEdit ? "Keep current owner" : "Assign to me"}</option>
                      {(formOptions.data?.owners ?? []).map((owner) => <option key={owner.id} value={owner.id}>{owner.firstName} {owner.lastName} · {owner.email}</option>)}
                    </select>
                  </FormField>
                </div>
                <div className="mt-4">
                  <div className="relative">
                    <textarea id="description" maxLength={4000} className={`${textareaClass} min-h-28`} placeholder="Scope, evaluation criteria, submission requirements…" {...form.register("description")} />
                    <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">{descriptionLength}/4000</span>
                  </div>
                </div>
              </FormSection>
            </div>
          ) : null}

          {tab === "commercials" ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <FormSection title="Commercial terms" description="Estimated bid value and the currency used for the customer snapshot." icon="wallet">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <FormField label="Estimated value" htmlFor="estimatedValue" error={form.formState.errors.estimatedValue?.message} required>
                    <Input id="estimatedValue" inputMode="decimal" className={`${controlClass} pr-9 text-right font-semibold tabular-nums`} placeholder="0.0000" {...form.register("estimatedValue")} />
                    <p className="text-xs leading-5 text-slate-500">Non-negative amount with up to four decimal places.</p>
                  </FormField>
                  <FormField label="Currency" htmlFor="currencyCode" error={form.formState.errors.currencyCode?.message} required>
                    <select id="currencyCode" className={controlClass} disabled={currencies.isPending} {...form.register("currencyCode")}>
                      <option value="">{currencies.isPending ? "Loading…" : "Select currency"}</option>
                      {currencyOptions.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} · {currency.name}</option>)}
                    </select>
                  </FormField>
                </div>
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <div className="mb-4 flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200"><Icon name="calendar" className="h-4 w-4" /></span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-950">Bid timeline</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Deadlines drive overdue indicators across the register.</p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Submission deadline" htmlFor="submissionDeadline">
                      <Input id="submissionDeadline" type="datetime-local" className={controlClass} {...form.register("submissionDeadline")} />
                    </FormField>
                    <FormField label="Expected award date" htmlFor="expectedAwardDate" error={form.formState.errors.expectedAwardDate?.message}>
                      <Input id="expectedAwardDate" type="date" className={controlClass} {...form.register("expectedAwardDate")} />
                    </FormField>
                  </div>
                </div>
              </FormSection>
              <aside className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 via-white to-sky-50/70 p-4 shadow-inner ring-1 ring-brand-50">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">Estimate preview</p>
                <p className="mt-4 text-xs font-medium text-slate-500">Bid value</p>
                <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-slate-950">{formatMoney(estimatedValue || "0", currencyCode || "PKR")}</p>
                <div className="mt-4 rounded-xl border border-white bg-white/80 p-3 shadow-sm">
                  <p className="text-[11px] font-semibold text-slate-500">Currency snapshot</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">The server stores the exchange rate and base-currency estimate when this tender is saved.</p>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-slate-500">Award date cannot be earlier than the submission date.</p>
              </aside>
            </div>
          ) : null}

          {tab === "review" ? (
            <div className="grid gap-5">
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100"><Icon name="flag" className="h-5 w-5" /></span>
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-slate-950">Workflow progress</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Tenders move forward one stage at a time. Outcome statuses are final.</p>
                  </div>
                </div>
                <WorkflowStepper status={status} />
                <div className="mt-5 flex flex-wrap gap-2">
                  <TenderStatusBadge status={status} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{TENDER_STATUS_HELP[status]}</span>
                </div>
              </section>

              <FormSection title="Internal notes" description="Context for the bid team. Never shown to the customer." icon="note">
                <div className="relative">
                  <textarea id="notes" maxLength={4000} className={`${textareaClass} min-h-32`} placeholder="Evaluation committee, pricing approvals, submission checklist, follow-up owners…" {...form.register("notes")} />
                  <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">{notesLength}/4000</span>
                </div>
              </FormSection>
            </div>
          ) : null}

          {form.formState.errors.root ? (
            <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{form.formState.errors.root.message}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-5 py-4">
          <p className="text-xs text-slate-500">All monetary values use decimal-safe storage.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setTab(tab === "brief" ? "review" : "brief")}>Previous</Button>
            <Button type="button" variant="secondary" onClick={() => setTab(tab === "review" ? "brief" : tab === "brief" ? "commercials" : "review")}>Next</Button>
            <Button type="submit" disabled={form.formState.isSubmitting || (isEdit && existing.isPending) || formOptions.isPending || currencies.isPending} className="bg-brand-800 hover:bg-brand-900">
              {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create tender"}
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

function FormSection({ title, description, icon, children }: { title: string; description: string; icon: "file" | "users" | "wallet" | "note"; children: ReactNode }) {
  const icons: Record<typeof icon, ReactNode> = {
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>,
    wallet: <><rect x="3" y="6" width="18" height="12" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></>,
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

function WorkflowStepper({ status }: { status: TenderStatus }) {
  const current = tenderStageIndex(status);
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {TENDER_STAGES.map((stage, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <div key={stage.key} className={`relative rounded-xl border p-3 transition ${active ? "border-brand-300 bg-brand-50 shadow-sm" : done ? "border-emerald-100 bg-emerald-50/60" : "border-slate-200 bg-white"}`}>
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${done ? "bg-emerald-500 text-white" : active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                {done ? "✓" : index + 1}
              </span>
              <p className={`text-xs font-bold ${active ? "text-brand-900" : done ? "text-emerald-800" : "text-slate-500"}`}>{stage.label}</p>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-slate-500">{stage.hint}</p>
          </div>
        );
      })}
    </div>
  );
}

function Icon({ name, className }: { name: "file" | "users" | "wallet" | "calendar" | "flag" | "note"; className?: string }) {
  const paths: Record<typeof name, ReactNode> = {
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>,
    wallet: <><rect x="3" y="6" width="18" height="12" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    flag: <><path d="M4 22V4" /><path d="M4 5h13l-2 4 2 4H4" /></>,
    note: <><path d="M4 4h16v12l-4 4H4z" /><path d="M16 20v-4h4" /></>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function toCreateWrite(values: FormValues): TenderCreateWrite {
  const body: TenderCreateWrite = {
    title: values.title,
    status: values.status,
    customerId: values.customerId,
    estimatedValue: values.estimatedValue,
    currencyCode: values.currencyCode.trim().toUpperCase(),
  };
  if (values.referenceNumber) body.referenceNumber = values.referenceNumber;
  if (values.contactId) body.contactId = values.contactId;
  if (values.ownerUserId) body.ownerUserId = values.ownerUserId;
  if (values.submissionDeadline) body.submissionDeadline = new Date(values.submissionDeadline).toISOString();
  if (values.expectedAwardDate) body.expectedAwardDate = values.expectedAwardDate;
  if (values.description) body.description = values.description;
  if (values.notes) body.notes = values.notes;
  return body;
}

function toUpdateWrite(values: FormValues): TenderUpdateWrite {
  const body: TenderUpdateWrite = {
    title: values.title,
    description: values.description || null,
    referenceNumber: values.referenceNumber || null,
    status: values.status,
    customerId: values.customerId,
    contactId: values.contactId || null,
    estimatedValue: values.estimatedValue,
    currencyCode: values.currencyCode.trim().toUpperCase(),
    submissionDeadline: values.submissionDeadline ? new Date(values.submissionDeadline).toISOString() : null,
    expectedAwardDate: values.expectedAwardDate || null,
    notes: values.notes || null,
  };
  if (values.ownerUserId) body.ownerUserId = values.ownerUserId;
  return body;
}

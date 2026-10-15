import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { listContacts, listCustomers } from "@/features/customers/api.ts";
import {
  LEAD_SOURCES,
  createOpportunity,
  getOpportunity,
  getOpportunityFormOptions,
  updateOpportunity,
  type OpportunityCreateWrite,
  type OpportunityLeadSource,
  type OpportunityUpdateWrite,
} from "./api.ts";

const schema = z.object({
  mode: z.enum(["existing", "prospect"]),
  title: z.string().trim().min(1, "Enter a title").max(200),
  description: z.string().trim().max(4000),
  customerId: z.string(),
  contactId: z.string(),
  prospectDisplayName: z.string().trim().max(200),
  prospectLegalName: z.string().trim().max(200),
  prospectEmail: z.string().trim().max(320),
  prospectPhone: z.string().trim().max(40),
  prospectCountryCode: z.string().trim().max(2),
  resellerId: z.string(),
  ownerUserId: z.string(),
  leadSource: z.string(),
  estimatedValue: z.string().trim(),
  currencyCode: z.string().trim().max(3),
  probabilityPercent: z.string().trim(),
  expectedCloseDate: z.string(),
  nextAction: z.string().trim().max(500),
  nextActionDueAt: z.string(),
  competitorName: z.string().trim().max(200),
  notes: z.string().trim().max(4000),
});

type FormValues = z.infer<typeof schema>;

const empty: FormValues = {
  mode: "existing",
  title: "",
  description: "",
  customerId: "",
  contactId: "",
  prospectDisplayName: "",
  prospectLegalName: "",
  prospectEmail: "",
  prospectPhone: "",
  prospectCountryCode: "",
  resellerId: "",
  ownerUserId: "",
  leadSource: "",
  estimatedValue: "",
  currencyCode: "PKR",
  probabilityPercent: "",
  expectedCloseDate: "",
  nextAction: "",
  nextActionDueAt: "",
  competitorName: "",
  notes: "",
};

export default function OpportunityFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [hadCustomerOnLoad, setHadCustomerOnLoad] = useState(false);
  const existing = useQuery({
    queryKey: ["opportunities", id],
    queryFn: () => getOpportunity(id as string),
    enabled: Boolean(id),
  });
  const formOptions = useQuery({ queryKey: ["opportunities", "form-options"], queryFn: getOpportunityFormOptions });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty });
  const mode = form.watch("mode");
  const customerId = form.watch("customerId");

  const customers = useQuery({
    queryKey: ["customers", "picker"],
    queryFn: () => listCustomers({ limit: 100, status: "ACTIVE" }),
    enabled: mode === "existing" || hadCustomerOnLoad,
  });
  const contacts = useQuery({
    queryKey: ["customers", customerId, "contacts"],
    queryFn: () => listContacts(customerId),
    enabled: Boolean(customerId),
  });

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    const linkedToCustomer = Boolean(existing.data.customerId);
    setHadCustomerOnLoad(linkedToCustomer);
    form.reset({
      mode: linkedToCustomer ? "existing" : "prospect",
      title: existing.data.title,
      description: existing.data.description ?? "",
      customerId: existing.data.customerId ?? "",
      contactId: existing.data.contactId ?? "",
      prospectDisplayName: existing.data.prospectDisplayName ?? "",
      prospectLegalName: existing.data.prospectLegalName ?? "",
      prospectEmail: existing.data.prospectEmail ?? "",
      prospectPhone: existing.data.prospectPhone ?? "",
      prospectCountryCode: existing.data.prospectCountryCode ?? "",
      resellerId: existing.data.resellerId ?? "",
      ownerUserId: existing.data.ownerUserId ?? "",
      leadSource: existing.data.leadSource ?? "",
      estimatedValue: existing.data.estimatedValue ?? "",
      currencyCode: existing.data.currencyCode,
      probabilityPercent: String(existing.data.probabilityPercent ?? ""),
      expectedCloseDate: existing.data.expectedCloseDate ? String(existing.data.expectedCloseDate).slice(0, 10) : "",
      nextAction: existing.data.nextAction ?? "",
      nextActionDueAt: existing.data.nextActionDueAt ? toLocalInput(existing.data.nextActionDueAt) : "",
      competitorName: existing.data.competitorName ?? "",
      notes: existing.data.notes ?? "",
    });
  }, [existing.data, form]);

  // Reset the contact when the selected customer changes while editing the form interactively.
  useEffect(() => {
    if (!existing.data) {
      return;
    }
    if (customerId !== (existing.data.customerId ?? "")) {
      form.setValue("contactId", "");
    }
  }, [customerId, existing.data, form]);

  const isEdit = Boolean(id);
  const showCustomerPicker = !isEdit && mode === "existing";
  const showProspectFields = !isEdit ? mode === "prospect" : !hadCustomerOnLoad;
  const showContactPicker = isEdit ? hadCustomerOnLoad : mode === "existing" && Boolean(customerId);

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="border-b border-slate-200 pb-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
          <span className="h-2 w-2 rounded-full bg-teal-600" />
          CRM / Pipeline
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">{id ? "Edit opportunity" : "New opportunity"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          The opportunity number is assigned by the server. Stage changes happen from the detail page.
        </p>
      </div>
      {existing.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(existing.error)}</p> : null}
      <form
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          if (!id) {
            if (values.mode === "existing" && !values.customerId) {
              form.setError("customerId", { message: "Choose a customer" });
              return;
            }
            if (values.mode === "prospect" && !values.prospectDisplayName.trim()) {
              form.setError("prospectDisplayName", { message: "Enter a prospect display name" });
              return;
            }
          }
          try {
            if (id) {
              await updateOpportunity(id, toUpdateWrite(values));
              navigate(`/opportunities/${id}`);
              return;
            }
            const created = await createOpportunity(toCreateWrite(values));
            navigate(`/opportunities/${created.id}`);
          } catch (error) {
            form.setError("root", { message: getApiErrorMessage(error) });
          }
        })}
      >
        <FormField label="Title" htmlFor="title" error={form.formState.errors.title?.message}>
          <Input id="title" {...form.register("title")} />
        </FormField>
        <FormField label="Description" htmlFor="description">
          <textarea
            id="description"
            className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...form.register("description")}
          />
        </FormField>

        {!isEdit ? (
          <fieldset className="grid gap-3 rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-sm font-medium text-slate-800">Customer</legend>
            <div className="flex gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input type="radio" value="existing" {...form.register("mode")} />
                Link an existing customer
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" value="prospect" {...form.register("mode")} />
                New prospect (no customer yet)
              </label>
            </div>
          </fieldset>
        ) : (
          <fieldset className="rounded-md border border-slate-200 p-3 text-sm text-slate-600">
            <legend className="px-1 text-sm font-medium text-slate-800">Customer</legend>
            {hadCustomerOnLoad ? (
              existing.data?.customer ? (
                <p>
                  Linked to{" "}
                  <Link className="font-medium text-slate-900 underline" to={`/customers/${existing.data.customer.id}`}>
                    {existing.data.customer.displayName}
                  </Link>
                  . Use Convert on the detail page to relink.
                </p>
              ) : (
                <p>Linked to a customer.</p>
              )
            ) : (
              <p>Not linked to a customer yet. Edit the prospect fields below, or use Convert on the detail page.</p>
            )}
          </fieldset>
        )}

        {showCustomerPicker ? (
          <FormField label="Customer" htmlFor="customerId" error={form.formState.errors.customerId?.message}>
            <select
              id="customerId"
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              {...form.register("customerId")}
            >
              <option value="">{customers.isPending ? "Loading…" : "Select customer"}</option>
              {(customers.data?.items ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName} ({customer.customerNumber})
                </option>
              ))}
            </select>
          </FormField>
        ) : null}

        {showContactPicker ? (
          <FormField label="Contact" htmlFor="contactId">
            <select
              id="contactId"
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              {...form.register("contactId")}
            >
              <option value="">{contacts.isPending ? "Loading…" : "No specific contact"}</option>
              {(contacts.data?.items ?? []).map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.displayName}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}

        {showProspectFields ? (
          <fieldset className="grid gap-3 rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-sm font-medium text-slate-800">Prospect details</legend>
            <FormField
              label="Prospect display name"
              htmlFor="prospectDisplayName"
              error={form.formState.errors.prospectDisplayName?.message}
            >
              <Input id="prospectDisplayName" {...form.register("prospectDisplayName")} />
            </FormField>
            <FormField label="Prospect legal name" htmlFor="prospectLegalName">
              <Input id="prospectLegalName" {...form.register("prospectLegalName")} />
            </FormField>
            <FormField label="Prospect email" htmlFor="prospectEmail">
              <Input id="prospectEmail" type="email" {...form.register("prospectEmail")} />
            </FormField>
            <FormField label="Prospect phone" htmlFor="prospectPhone">
              <Input id="prospectPhone" {...form.register("prospectPhone")} />
            </FormField>
            <FormField label="Prospect country" htmlFor="prospectCountryCode">
              <Input id="prospectCountryCode" maxLength={2} placeholder="PK" {...form.register("prospectCountryCode")} />
            </FormField>
          </fieldset>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Reseller" htmlFor="resellerId">
            <select
              id="resellerId"
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              {...form.register("resellerId")}
            >
              <option value="">None</option>
              {(formOptions.data?.resellers ?? []).map((reseller) => (
                <option key={reseller.id} value={reseller.id}>
                  {reseller.displayName}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Owner" htmlFor="ownerUserId">
            <select
              id="ownerUserId"
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              {...form.register("ownerUserId")}
            >
              <option value="">{id ? "Keep current owner" : "Assign to me"}</option>
              {(formOptions.data?.owners ?? []).map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.firstName} {owner.lastName}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Lead source" htmlFor="leadSource">
          <select
            id="leadSource"
            className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
            {...form.register("leadSource")}
          >
            <option value="">Unknown</option>
            {LEAD_SOURCES.map((value) => (
              <option key={value} value={value}>
                {leadSourceLabel(value)}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid gap-4 md:grid-cols-3">
          <FormField label="Estimated value" htmlFor="estimatedValue" error={form.formState.errors.estimatedValue?.message}>
            <Input id="estimatedValue" placeholder="0.0000" {...form.register("estimatedValue")} />
          </FormField>
          <FormField label="Currency" htmlFor="currencyCode" error={form.formState.errors.currencyCode?.message}>
            <Input id="currencyCode" maxLength={3} {...form.register("currencyCode")} />
          </FormField>
          <FormField label="Probability %" htmlFor="probabilityPercent">
            <Input id="probabilityPercent" type="number" min={0} max={100} {...form.register("probabilityPercent")} />
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Expected close date" htmlFor="expectedCloseDate">
            <Input id="expectedCloseDate" type="date" {...form.register("expectedCloseDate")} />
          </FormField>
          <FormField label="Competitor name" htmlFor="competitorName">
            <Input id="competitorName" {...form.register("competitorName")} />
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Next action" htmlFor="nextAction">
            <Input id="nextAction" {...form.register("nextAction")} />
          </FormField>
          <FormField label="Next action due" htmlFor="nextActionDueAt">
            <Input id="nextActionDueAt" type="datetime-local" {...form.register("nextActionDueAt")} />
          </FormField>
        </div>

        <FormField label="Notes" htmlFor="notes">
          <textarea
            id="notes"
            className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...form.register("notes")}
          />
        </FormField>

        {form.formState.errors.root ? <p className="text-sm text-red-700">{form.formState.errors.root.message}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {id ? "Save changes" : "Create opportunity"}
          </Button>
          <Link
            to={id ? `/opportunities/${id}` : "/opportunities"}
            className="inline-flex h-9 items-center px-3 text-sm text-slate-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

function toCreateWrite(values: FormValues): OpportunityCreateWrite {
  const body: OpportunityCreateWrite = {
    title: values.title,
    description: values.description.trim() || undefined,
    currencyCode: values.currencyCode.trim().toUpperCase(),
  };
  if (values.mode === "existing") {
    body.customerId = values.customerId || undefined;
    if (values.contactId) {
      body.contactId = values.contactId;
    }
  } else {
    body.prospectDisplayName = values.prospectDisplayName.trim();
    if (values.prospectLegalName.trim()) body.prospectLegalName = values.prospectLegalName.trim();
    if (values.prospectEmail.trim()) body.prospectEmail = values.prospectEmail.trim();
    if (values.prospectPhone.trim()) body.prospectPhone = values.prospectPhone.trim();
    if (values.prospectCountryCode.trim()) body.prospectCountryCode = values.prospectCountryCode.trim().toUpperCase();
  }
  if (values.resellerId) body.resellerId = values.resellerId;
  if (values.ownerUserId) body.ownerUserId = values.ownerUserId;
  if (values.leadSource) body.leadSource = values.leadSource as OpportunityLeadSource;
  if (values.estimatedValue.trim()) body.estimatedValue = values.estimatedValue.trim();
  if (values.probabilityPercent.trim()) body.probabilityPercent = Number(values.probabilityPercent);
  if (values.expectedCloseDate) body.expectedCloseDate = values.expectedCloseDate;
  if (values.nextAction.trim()) body.nextAction = values.nextAction.trim();
  if (values.nextActionDueAt) body.nextActionDueAt = new Date(values.nextActionDueAt).toISOString();
  if (values.competitorName.trim()) body.competitorName = values.competitorName.trim();
  if (values.notes.trim()) body.notes = values.notes.trim();
  return body;
}

function toUpdateWrite(values: FormValues): OpportunityUpdateWrite {
  const body: OpportunityUpdateWrite = {
    title: values.title,
    description: values.description.trim() || null,
    currencyCode: values.currencyCode.trim().toUpperCase(),
    notes: values.notes.trim() || null,
    nextAction: values.nextAction.trim() || null,
    nextActionDueAt: values.nextActionDueAt ? new Date(values.nextActionDueAt).toISOString() : null,
    competitorName: values.competitorName.trim() || null,
    expectedCloseDate: values.expectedCloseDate || null,
    resellerId: values.resellerId || null,
    leadSource: (values.leadSource as OpportunityLeadSource) || null,
  };
  if (values.mode === "existing") {
    if (values.contactId) {
      body.contactId = values.contactId;
    } else {
      body.contactId = null;
    }
  } else {
    body.prospectDisplayName = values.prospectDisplayName.trim() || null;
    body.prospectLegalName = values.prospectLegalName.trim() || null;
    body.prospectEmail = values.prospectEmail.trim() || null;
    body.prospectPhone = values.prospectPhone.trim() || null;
    body.prospectCountryCode = values.prospectCountryCode.trim().toUpperCase() || null;
  }
  if (values.ownerUserId) {
    body.ownerUserId = values.ownerUserId;
  }
  if (values.estimatedValue.trim()) {
    body.estimatedValue = values.estimatedValue.trim();
  }
  if (values.probabilityPercent.trim()) {
    body.probabilityPercent = Number(values.probabilityPercent);
  }
  return body;
}

function leadSourceLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

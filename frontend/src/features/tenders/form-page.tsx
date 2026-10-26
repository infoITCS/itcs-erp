import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { listContacts } from "@/features/customers/api.ts";
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
import { statusLabel, toLocalDateTimeInput } from "./shared.tsx";

const amountPattern = /^\d{1,15}(\.\d{1,4})?$/;

const schema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200),
  referenceNumber: z.string().trim().max(120),
  status: z.enum(TENDER_STATUSES),
  customerId: z.string().min(1, "Choose a customer"),
  contactId: z.string(),
  ownerUserId: z.string(),
  estimatedValue: z.string().trim().regex(amountPattern, "Enter a non-negative amount with up to 4 decimals"),
  currencyCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code"),
  submissionDeadline: z.string(),
  expectedAwardDate: z.string(),
  description: z.string().trim().max(4000),
  notes: z.string().trim().max(4000),
});

type FormValues = z.infer<typeof schema>;

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
  const existing = useQuery({
    queryKey: ["tenders", id],
    queryFn: () => getTender(id as string),
    enabled: isEdit,
  });
  const formOptions = useQuery({
    queryKey: ["tenders", "form-options"],
    queryFn: getTenderFormOptions,
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty });
  const customerId = form.watch("customerId");
  const customerRef = useRef("");

  const contacts = useQuery({
    queryKey: ["customers", customerId, "contacts"],
    queryFn: () => listContacts(customerId),
    enabled: Boolean(customerId),
  });

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

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="border-b border-slate-200 pb-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
          <span className="h-2 w-2 rounded-full bg-teal-600" />
          CRM / Tenders
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">
          {isEdit ? "Edit tender" : "New tender"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          The tender number is assigned by the server. A customer is required for every tender.
        </p>
      </div>

      {existing.isError ? (
        <p className="text-sm text-red-700">{getApiErrorMessage(existing.error)}</p>
      ) : null}
      {formOptions.isError ? (
        <p className="text-sm text-red-700">{getApiErrorMessage(formOptions.error)}</p>
      ) : null}

      <form
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
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
        })}
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <FormField label="Title" htmlFor="title" error={form.formState.errors.title?.message}>
            <Input id="title" placeholder="Network refresh and maintenance" {...form.register("title")} />
          </FormField>
          <FormField label="Status" htmlFor="status">
            <select
              id="status"
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              {...form.register("status")}
            >
              {TENDER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Reference number"
            htmlFor="referenceNumber"
            error={form.formState.errors.referenceNumber?.message}
          >
            <Input
              id="referenceNumber"
              placeholder="Customer or portal reference"
              {...form.register("referenceNumber")}
            />
          </FormField>
          <FormField label="Owner" htmlFor="ownerUserId">
            <select
              id="ownerUserId"
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              {...form.register("ownerUserId")}
            >
              <option value="">{isEdit ? "Keep current owner" : "Assign to me"}</option>
              {(formOptions.data?.owners ?? []).map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.firstName} {owner.lastName}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Customer"
            htmlFor="customerId"
            error={form.formState.errors.customerId?.message}
          >
            <select
              id="customerId"
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              {...form.register("customerId")}
            >
              <option value="">{formOptions.isPending ? "Loading…" : "Select customer"}</option>
              {(formOptions.data?.customers ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName} ({customer.customerNumber})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Contact" htmlFor="contactId">
            <select
              id="contactId"
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm disabled:bg-slate-50"
              disabled={!customerId || contacts.isPending}
              {...form.register("contactId")}
            >
              <option value="">
                {!customerId ? "Choose a customer first" : contacts.isPending ? "Loading…" : "No specific contact"}
              </option>
              {(contacts.data?.items ?? []).map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.displayName}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Submission deadline" htmlFor="submissionDeadline">
            <Input id="submissionDeadline" type="datetime-local" {...form.register("submissionDeadline")} />
          </FormField>
          <FormField label="Expected award date" htmlFor="expectedAwardDate">
            <Input id="expectedAwardDate" type="date" {...form.register("expectedAwardDate")} />
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_140px]">
          <FormField
            label="Estimated value"
            htmlFor="estimatedValue"
            error={form.formState.errors.estimatedValue?.message}
          >
            <Input id="estimatedValue" inputMode="decimal" placeholder="0.0000" {...form.register("estimatedValue")} />
          </FormField>
          <FormField
            label="Currency"
            htmlFor="currencyCode"
            error={form.formState.errors.currencyCode?.message}
          >
            <Input id="currencyCode" maxLength={3} {...form.register("currencyCode")} />
          </FormField>
        </div>

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

        {form.formState.errors.root ? (
          <p className="text-sm text-red-700">{form.formState.errors.root.message}</p>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting || (isEdit && existing.isPending)}
          >
            {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create tender"}
          </Button>
          <Link
            to={id ? `/tenders/${id}` : "/tenders"}
            className="inline-flex h-9 items-center px-3 text-sm text-slate-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

function toCreateWrite(values: FormValues): TenderCreateWrite {
  const body: TenderCreateWrite = {
    title: values.title,
    status: values.status as TenderStatus,
    customerId: values.customerId,
    estimatedValue: values.estimatedValue,
    currencyCode: values.currencyCode.trim().toUpperCase(),
  };
  if (values.referenceNumber) {
    body.referenceNumber = values.referenceNumber;
  }
  if (values.contactId) {
    body.contactId = values.contactId;
  }
  if (values.ownerUserId) {
    body.ownerUserId = values.ownerUserId;
  }
  if (values.submissionDeadline) {
    body.submissionDeadline = new Date(values.submissionDeadline).toISOString();
  }
  if (values.expectedAwardDate) {
    body.expectedAwardDate = values.expectedAwardDate;
  }
  if (values.description) {
    body.description = values.description;
  }
  if (values.notes) {
    body.notes = values.notes;
  }
  return body;
}

function toUpdateWrite(values: FormValues): TenderUpdateWrite {
  const body: TenderUpdateWrite = {
    title: values.title,
    description: values.description || null,
    referenceNumber: values.referenceNumber || null,
    status: values.status as TenderStatus,
    customerId: values.customerId,
    contactId: values.contactId || null,
    estimatedValue: values.estimatedValue,
    currencyCode: values.currencyCode.trim().toUpperCase(),
    submissionDeadline: values.submissionDeadline
      ? new Date(values.submissionDeadline).toISOString()
      : null,
    expectedAwardDate: values.expectedAwardDate || null,
    notes: values.notes || null,
  };
  if (values.ownerUserId) {
    body.ownerUserId = values.ownerUserId;
  }
  return body;
}

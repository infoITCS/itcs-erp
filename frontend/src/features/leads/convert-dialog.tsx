import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FormField } from "@/components/forms/FormField.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  convertLead,
  getLeadFormOptions,
  type ConvertLeadWrite,
  type Lead,
  type LeadOwnerRef,
} from "./api.ts";

interface ConvertDialogProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  onConverted: (lead: Lead) => void;
}

export function ConvertLeadDialog({ lead, open, onClose, onConverted }: ConvertDialogProps) {
  const queryClient = useQueryClient();
  const formOptions = useQuery({
    queryKey: ["leads", "form-options"],
    queryFn: getLeadFormOptions,
    enabled: open,
  });
  const owners: LeadOwnerRef[] = formOptions.data?.owners ?? [];
  const [mode, setMode] = useState<"ACCOUNT" | "PROSPECT">("ACCOUNT");
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState(() => defaults(lead));

  useEffect(() => {
    if (open) {
      setMode("ACCOUNT");
      setError(null);
      setValues(defaults(lead));
    }
  }, [open, lead]);

  const convert = useMutation({
    mutationFn: (body: ConvertLeadWrite) => convertLead(lead.id, body),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
      ]);
      onConverted(updated);
      onClose();
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError)),
  });

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    setError(null);
    if (!values.title.trim()) {
      setError("Enter an opportunity title.");
      return;
    }
    if (mode === "ACCOUNT" && !values.legalName.trim()) {
      setError("Enter the legal name for the customer account.");
      return;
    }
    if (mode === "PROSPECT" && !values.prospectDisplayName.trim()) {
      setError("Enter a prospect display name.");
      return;
    }
    if (!values.contactFirstName.trim() || !values.contactLastName.trim()) {
      setError("Enter the contact first and last name.");
      return;
    }

    const opportunity = {
      title: values.title.trim(),
      estimatedValue: values.estimatedValue.trim() || undefined,
      currencyCode: values.currencyCode.trim().toUpperCase() || undefined,
      expectedCloseDate: values.expectedCloseDate || undefined,
      ownerUserId: values.ownerUserId || undefined,
      nextAction: values.nextAction.trim() || undefined,
      nextActionDueAt: values.nextActionDueAt ? new Date(values.nextActionDueAt).toISOString() : undefined,
      notes: values.notes.trim() || undefined,
    };

    const body: ConvertLeadWrite =
      mode === "ACCOUNT"
        ? {
            mode: "ACCOUNT",
            customer: {
              legalName: values.legalName.trim(),
              displayName: values.displayName.trim() || undefined,
              customerType: values.customerType,
              entityType: values.entityType,
              email: values.email.trim() || null,
              phone: values.phone.trim() || null,
              website: values.website.trim() || null,
              countryCode: values.countryCode.trim().toUpperCase() || undefined,
              currencyCode: values.customerCurrencyCode.trim().toUpperCase() || undefined,
              contact: {
                firstName: values.contactFirstName.trim(),
                lastName: values.contactLastName.trim(),
                jobTitle: values.contactJobTitle.trim() || undefined,
                email: values.contactEmail.trim() || undefined,
                phone: values.contactPhone.trim() || undefined,
              },
            },
            opportunity,
          }
        : {
            mode: "PROSPECT",
            opportunity: {
              ...opportunity,
              prospectDisplayName: values.prospectDisplayName.trim(),
              prospectLegalName: values.prospectLegalName.trim() || undefined,
              prospectEmail: values.prospectEmail.trim() || undefined,
              prospectPhone: values.prospectPhone.trim() || undefined,
              prospectCountryCode: values.prospectCountryCode.trim().toUpperCase() || undefined,
            },
          };

    convert.mutate(body);
  }

  return (
    <Modal
      open={open}
      title={`Convert ${lead.displayName}`}
      onClose={convert.isPending ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={convert.isPending}>
            Cancel
          </Button>
          <Button className="bg-teal-800 hover:bg-teal-900" onClick={submit} disabled={convert.isPending}>
            {convert.isPending ? "Converting…" : "Convert lead"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-md border border-teal-100 bg-teal-50 px-3 py-2 text-sm text-teal-900">
          A lead can only be converted once. The lead will be marked <strong>Converted</strong> and an opportunity is
          created with the lead source and reference preserved.
        </p>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Conversion mode">
          <ModeButton active={mode === "ACCOUNT"} onClick={() => setMode("ACCOUNT")}>
            Create customer account
          </ModeButton>
          <ModeButton active={mode === "PROSPECT"} onClick={() => setMode("PROSPECT")}>
            Prospect only
          </ModeButton>
        </div>

        {error ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {mode === "ACCOUNT" ? (
          <fieldset className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold text-slate-900">Customer account</legend>
            <FormField label="Legal name" htmlFor="legalName">
              <Input id="legalName" value={values.legalName} onChange={(e) => update("legalName", e.target.value)} />
            </FormField>
            <FormField label="Display name" htmlFor="accountDisplayName">
              <Input
                id="accountDisplayName"
                value={values.displayName}
                onChange={(e) => update("displayName", e.target.value)}
              />
            </FormField>
            <FormField label="Entity type" htmlFor="entityType">
              <select
                id="entityType"
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={values.entityType}
                onChange={(e) => update("entityType", e.target.value as FormValues["entityType"])}
              >
                <option value="COMPANY">Company</option>
                <option value="INDIVIDUAL">Individual</option>
              </select>
            </FormField>
            <FormField label="Customer type" htmlFor="customerType">
              <select
                id="customerType"
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={values.customerType}
                onChange={(e) => update("customerType", e.target.value as FormValues["customerType"])}
              >
                <option value="B2B">B2B</option>
                <option value="B2C">B2C</option>
                <option value="COMPANY">Company</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="WHOLESALE">Wholesale</option>
              </select>
            </FormField>
            <FormField label="Account email" htmlFor="accountEmail">
              <Input id="accountEmail" type="email" value={values.email} onChange={(e) => update("email", e.target.value)} />
            </FormField>
            <FormField label="Account phone" htmlFor="accountPhone">
              <Input id="accountPhone" value={values.phone} onChange={(e) => update("phone", e.target.value)} />
            </FormField>
            <FormField label="Website" htmlFor="accountWebsite">
              <Input id="accountWebsite" value={values.website} onChange={(e) => update("website", e.target.value)} />
            </FormField>
            <FormField label="Country code" htmlFor="accountCountry">
              <Input
                id="accountCountry"
                maxLength={2}
                className="uppercase"
                value={values.countryCode}
                onChange={(e) => update("countryCode", e.target.value)}
              />
            </FormField>
            <FormField label="Account currency" htmlFor="accountCurrency">
              <Input
                id="accountCurrency"
                maxLength={3}
                className="uppercase"
                value={values.customerCurrencyCode}
                onChange={(e) => update("customerCurrencyCode", e.target.value)}
              />
            </FormField>
          </fieldset>
        ) : (
          <fieldset className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold text-slate-900">Prospect</legend>
            <FormField label="Prospect display name" htmlFor="prospectDisplayName">
              <Input
                id="prospectDisplayName"
                value={values.prospectDisplayName}
                onChange={(e) => update("prospectDisplayName", e.target.value)}
              />
            </FormField>
            <FormField label="Legal name" htmlFor="prospectLegalName">
              <Input
                id="prospectLegalName"
                value={values.prospectLegalName}
                onChange={(e) => update("prospectLegalName", e.target.value)}
              />
            </FormField>
            <FormField label="Email" htmlFor="prospectEmail">
              <Input
                id="prospectEmail"
                type="email"
                value={values.prospectEmail}
                onChange={(e) => update("prospectEmail", e.target.value)}
              />
            </FormField>
            <FormField label="Phone" htmlFor="prospectPhone">
              <Input
                id="prospectPhone"
                value={values.prospectPhone}
                onChange={(e) => update("prospectPhone", e.target.value)}
              />
            </FormField>
            <FormField label="Country code" htmlFor="prospectCountry">
              <Input
                id="prospectCountry"
                maxLength={2}
                className="uppercase"
                value={values.prospectCountryCode}
                onChange={(e) => update("prospectCountryCode", e.target.value)}
              />
            </FormField>
          </fieldset>
        )}

        <fieldset className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold text-slate-900">Opportunity</legend>
          <div className="sm:col-span-2">
            <FormField label="Title" htmlFor="opportunityTitle">
              <Input id="opportunityTitle" value={values.title} onChange={(e) => update("title", e.target.value)} />
            </FormField>
          </div>
          <FormField label="Estimated value" htmlFor="opportunityValue">
            <Input
              id="opportunityValue"
              inputMode="decimal"
              value={values.estimatedValue}
              onChange={(e) => update("estimatedValue", e.target.value)}
            />
          </FormField>
          <FormField label="Currency" htmlFor="opportunityCurrency">
            <Input
              id="opportunityCurrency"
              maxLength={3}
              className="uppercase"
              value={values.currencyCode}
              onChange={(e) => update("currencyCode", e.target.value)}
            />
          </FormField>
          <FormField label="Expected close" htmlFor="opportunityClose">
            <Input
              id="opportunityClose"
              type="date"
              value={values.expectedCloseDate}
              onChange={(e) => update("expectedCloseDate", e.target.value)}
            />
          </FormField>
          <FormField label="Owner" htmlFor="opportunityOwner">
            <select
              id="opportunityOwner"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={values.ownerUserId}
              onChange={(e) => update("ownerUserId", e.target.value)}
            >
              <option value="">Lead owner (default)</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.firstName} {owner.lastName}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Next action" htmlFor="opportunityAction">
            <Input
              id="opportunityAction"
              value={values.nextAction}
              onChange={(e) => update("nextAction", e.target.value)}
            />
          </FormField>
          <FormField label="Next action due" htmlFor="opportunityActionDue">
            <Input
              id="opportunityActionDue"
              type="datetime-local"
              value={values.nextActionDueAt}
              onChange={(e) => update("nextActionDueAt", e.target.value)}
            />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Notes" htmlFor="opportunityNotes">
              <textarea
                id="opportunityNotes"
                className="min-h-16 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={values.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </FormField>
          </div>
        </fieldset>

        {mode === "ACCOUNT" ? (
          <fieldset className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold text-slate-900">Primary contact</legend>
            <FormField label="First name" htmlFor="contactFirstName">
              <Input
                id="contactFirstName"
                value={values.contactFirstName}
                onChange={(e) => update("contactFirstName", e.target.value)}
              />
            </FormField>
            <FormField label="Last name" htmlFor="contactLastName">
              <Input
                id="contactLastName"
                value={values.contactLastName}
                onChange={(e) => update("contactLastName", e.target.value)}
              />
            </FormField>
            <FormField label="Job title" htmlFor="contactJobTitle">
              <Input
                id="contactJobTitle"
                value={values.contactJobTitle}
                onChange={(e) => update("contactJobTitle", e.target.value)}
              />
            </FormField>
            <FormField label="Email" htmlFor="contactEmail">
              <Input
                id="contactEmail"
                type="email"
                value={values.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
              />
            </FormField>
            <FormField label="Phone" htmlFor="contactPhone">
              <Input
                id="contactPhone"
                value={values.contactPhone}
                onChange={(e) => update("contactPhone", e.target.value)}
              />
            </FormField>
          </fieldset>
        ) : null}
      </div>
    </Modal>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-teal-800 text-white shadow-sm" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

interface FormValues {
  legalName: string;
  displayName: string;
  customerType: "COMPANY" | "INDIVIDUAL" | "B2B" | "B2C" | "WHOLESALE";
  entityType: "COMPANY" | "INDIVIDUAL";
  email: string;
  phone: string;
  website: string;
  countryCode: string;
  customerCurrencyCode: string;
  contactFirstName: string;
  contactLastName: string;
  contactJobTitle: string;
  contactEmail: string;
  contactPhone: string;
  prospectDisplayName: string;
  prospectLegalName: string;
  prospectEmail: string;
  prospectPhone: string;
  prospectCountryCode: string;
  title: string;
  estimatedValue: string;
  currencyCode: string;
  expectedCloseDate: string;
  ownerUserId: string;
  nextAction: string;
  nextActionDueAt: string;
  notes: string;
}

function defaults(lead: Lead): FormValues {
  return {
    legalName: lead.companyName ?? lead.displayName,
    displayName: lead.companyName ?? lead.displayName,
    customerType: "B2B",
    entityType: "COMPANY",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    website: lead.website ?? "",
    countryCode: lead.countryCode,
    customerCurrencyCode: lead.currencyCode,
    contactFirstName: lead.firstName,
    contactLastName: lead.lastName,
    contactJobTitle: lead.jobTitle ?? "",
    contactEmail: lead.email ?? "",
    contactPhone: lead.phone ?? "",
    prospectDisplayName: lead.companyName ?? lead.displayName,
    prospectLegalName: lead.companyName ?? "",
    prospectEmail: lead.email ?? "",
    prospectPhone: lead.phone ?? "",
    prospectCountryCode: lead.countryCode,
    title: `Opportunity for ${lead.companyName ?? lead.displayName}`,
    estimatedValue: lead.estimatedValue,
    currencyCode: lead.currencyCode,
    expectedCloseDate: "",
    ownerUserId: lead.ownerUserId,
    nextAction: lead.nextAction ?? "",
    nextActionDueAt: lead.nextActionDueAt ? toLocalInput(lead.nextActionDueAt) : "",
    notes: lead.notes ?? "",
  };
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

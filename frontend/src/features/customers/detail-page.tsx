import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField.tsx";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  createAddress,
  createContact,
  deleteAddress,
  deleteContact,
  deleteCustomer,
  getCustomer,
  listContacts,
  listCustomerAudit,
  updateContact,
  type AddressWrite,
  type ContactWrite,
} from "./api.ts";

const contactSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name"),
  lastName: z.string().trim().min(1, "Enter a last name"),
  email: z.string().trim(),
  phone: z.string().trim(),
  jobTitle: z.string().trim(),
  isPrimary: z.boolean(),
});

type PendingDelete =
  | { kind: "customer" }
  | { kind: "address"; id: string; label: string }
  | { kind: "contact"; id: string; label: string };

export default function CustomerDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [contactOpen, setContactOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const customer = useQuery({ queryKey: ["customers", id], queryFn: () => getCustomer(id) });
  const contacts = useQuery({ queryKey: ["customers", id, "contacts"], queryFn: () => listContacts(id) });
  const audit = useQuery({ queryKey: ["customers", id, "audit"], queryFn: () => listCustomerAudit(id) });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["customers", id] });
  };

  const removeCustomer = useMutation({
    mutationFn: () => deleteCustomer(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
      navigate("/customers");
    },
  });

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    setConfirmBusy(true);
    try {
      if (pendingDelete.kind === "customer") {
        await removeCustomer.mutateAsync();
      } else if (pendingDelete.kind === "address") {
        await deleteAddress(id, pendingDelete.id);
        await refresh();
      } else {
        await deleteContact(pendingDelete.id);
        await refresh();
      }
      setPendingDelete(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      {customer.isPending ? <p className="text-sm text-slate-500">Loading customer…</p> : null}
      {customer.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(customer.error)}</p> : null}
      {customer.data ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">{customer.data.customerNumber}</p>
              <h1 className="text-2xl font-semibold text-slate-900">{customer.data.displayName}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {customer.data.legalName} · {customer.data.customerType} · {customer.data.status} · {customer.data.countryCode} ·{" "}
                {customer.data.currencyCode}
              </p>
            </div>
            <div className="flex gap-2">
              <Link to={`/customers/${id}/edit`} className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm">
                Edit
              </Link>
              <Button variant="secondary" onClick={() => setPendingDelete({ kind: "customer" })}>
                Delete
              </Button>
            </div>
          </div>
          {customer.data.email || customer.data.phone || customer.data.notes ? (
            <p className="text-sm text-slate-700">
              {[customer.data.email, customer.data.phone, customer.data.notes].filter(Boolean).join(" · ")}
            </p>
          ) : null}

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Addresses</h2>
              <Button variant="secondary" onClick={() => setAddressOpen(true)}>
                Add address
              </Button>
            </div>
            {customer.data.addresses.length === 0 ? <p className="text-sm text-slate-500">No addresses yet.</p> : null}
            <ul className="grid gap-3 md:grid-cols-2">
              {customer.data.addresses.map((address) => (
                <li key={address.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                  <p className="font-medium text-slate-900">
                    {address.purpose}
                    {address.isPrimary ? " · Primary" : ""}
                  </p>
                  <p className="mt-1 text-slate-700">
                    {address.line1}, {address.city}, {address.countryCode}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-sm text-red-700"
                    onClick={() =>
                      setPendingDelete({
                        kind: "address",
                        id: address.id,
                        label: `${address.purpose} · ${address.line1}`,
                      })
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Contacts</h2>
              <Button variant="secondary" onClick={() => setContactOpen(true)}>
                Add contact
              </Button>
            </div>
            {contacts.isPending ? <p className="text-sm text-slate-500">Loading contacts…</p> : null}
            {contacts.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(contacts.error)}</p> : null}
            {contacts.data && contacts.data.items.length === 0 ? <p className="text-sm text-slate-500">No contacts yet.</p> : null}
            <ul className="flex flex-col gap-2">
              {contacts.data?.items.map((contact) => (
                <li key={contact.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">
                      {contact.displayName}
                      {contact.isPrimary ? " · Primary" : ""}
                    </p>
                    <p className="text-slate-600">{[contact.jobTitle, contact.email, contact.phone].filter(Boolean).join(" · ") || contact.status}</p>
                  </div>
                  <div className="flex gap-3">
                    {contact.isPrimary ? null : (
                      <button type="button" className="text-slate-700" onClick={() => updateContact(contact.id, { isPrimary: true }).then(refresh)}>
                        Make primary
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-red-700"
                      onClick={() => setPendingDelete({ kind: "contact", id: contact.id, label: contact.displayName })}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Activity</h2>
            {audit.isPending ? <p className="text-sm text-slate-500">Loading activity…</p> : null}
            {audit.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(audit.error)}</p> : null}
            {audit.data && audit.data.items.length === 0 ? <p className="text-sm text-slate-500">No activity yet.</p> : null}
            <ul className="flex flex-col gap-1 text-sm text-slate-700">
              {audit.data?.items.map((event) => (
                <li key={event.id}>
                  {event.action} · {new Date(event.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete?.kind === "customer"
            ? "Delete customer?"
            : pendingDelete?.kind === "address"
              ? "Remove address?"
              : "Remove contact?"
        }
        description={
          pendingDelete?.kind === "customer" ? (
            <p>
              Soft-delete <span className="font-medium text-slate-900">{customer.data?.displayName}</span>? You can restore it later
              with the right permission.
            </p>
          ) : (
            <p>
              Remove <span className="font-medium text-slate-900">{pendingDelete?.label}</span>? This soft-deletes the record.
            </p>
          )
        }
        confirmLabel={pendingDelete?.kind === "customer" ? "Delete customer" : "Remove"}
        busy={confirmBusy || removeCustomer.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
      />

      <Modal open={addressOpen} title="Add address" onClose={() => setAddressOpen(false)}>
        <AddressForm
          error={formError}
          onSubmit={async (body) => {
            setFormError(null);
            try {
              await createAddress(id, body);
              await refresh();
              setAddressOpen(false);
            } catch (error) {
              setFormError(getApiErrorMessage(error));
            }
          }}
        />
      </Modal>

      <Modal open={contactOpen} title="Add contact" onClose={() => setContactOpen(false)}>
        <ContactForm
          error={formError}
          onSubmit={async (body) => {
            setFormError(null);
            try {
              await createContact(id, body);
              await refresh();
              setContactOpen(false);
            } catch (error) {
              setFormError(getApiErrorMessage(error));
            }
          }}
        />
      </Modal>
    </section>
  );
}

function AddressForm({ error, onSubmit }: { error: string | null; onSubmit: (body: AddressWrite) => Promise<void> }) {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void onSubmit({
          purpose: String(form.get("purpose") ?? "BILLING") as AddressWrite["purpose"],
          isPrimary: form.get("isPrimary") === "on",
          line1: String(form.get("line1") ?? ""),
          city: String(form.get("city") ?? ""),
          countryCode: String(form.get("countryCode") ?? "").toUpperCase(),
          line2: String(form.get("line2") ?? "") || undefined,
          region: String(form.get("region") ?? "") || undefined,
          postalCode: String(form.get("postalCode") ?? "") || undefined,
        });
      }}
    >
      <FormField label="Purpose" htmlFor="purpose">
        <select id="purpose" name="purpose" className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm" defaultValue="BILLING">
          <option value="BILLING">Billing</option>
          <option value="SHIPPING">Shipping</option>
        </select>
      </FormField>
      <FormField label="Line 1" htmlFor="line1">
        <Input id="line1" name="line1" required />
      </FormField>
      <FormField label="City" htmlFor="city">
        <Input id="city" name="city" required />
      </FormField>
      <FormField label="Country" htmlFor="countryCode">
        <Input id="countryCode" name="countryCode" maxLength={2} required defaultValue="PK" />
      </FormField>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="isPrimary" />
        Primary for this purpose
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button type="submit">Save address</Button>
    </form>
  );
}

function ContactForm({ error, onSubmit }: { error: string | null; onSubmit: (body: ContactWrite) => Promise<void> }) {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const parsed = contactSchema.safeParse({
          firstName: String(form.get("firstName") ?? ""),
          lastName: String(form.get("lastName") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          jobTitle: String(form.get("jobTitle") ?? ""),
          isPrimary: form.get("isPrimary") === "on",
        });
        if (!parsed.success) {
          return;
        }
        void onSubmit({
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          email: parsed.data.email || undefined,
          phone: parsed.data.phone || undefined,
          jobTitle: parsed.data.jobTitle || undefined,
          isPrimary: parsed.data.isPrimary,
        });
      }}
    >
      <FormField label="First name" htmlFor="firstName">
        <Input id="firstName" name="firstName" required />
      </FormField>
      <FormField label="Last name" htmlFor="lastName">
        <Input id="lastName" name="lastName" required />
      </FormField>
      <FormField label="Job title" htmlFor="jobTitle">
        <Input id="jobTitle" name="jobTitle" />
      </FormField>
      <FormField label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" />
      </FormField>
      <FormField label="Phone" htmlFor="phone">
        <Input id="phone" name="phone" />
      </FormField>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="isPrimary" />
        Primary contact
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button type="submit">Save contact</Button>
    </form>
  );
}

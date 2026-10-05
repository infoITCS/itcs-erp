import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField.tsx";
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

export default function CustomerDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [contactOpen, setContactOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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
              <Button variant="secondary" onClick={() => removeCustomer.mutate()} disabled={removeCustomer.isPending}>
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
                    onClick={() => deleteAddress(id, address.id).then(refresh)}
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
                    <button type="button" className="text-red-700" onClick={() => deleteContact(contact.id).then(refresh)}>
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

      <ContactModal
        open={contactOpen}
        error={formError}
        onClose={() => setContactOpen(false)}
        onSubmit={async (values) => {
          setFormError(null);
          try {
            await createContact(id, values);
            setContactOpen(false);
            await refresh();
          } catch (error) {
            setFormError(getApiErrorMessage(error));
          }
        }}
      />
      <AddressModal
        open={addressOpen}
        error={formError}
        onClose={() => setAddressOpen(false)}
        onSubmit={async (values) => {
          setFormError(null);
          try {
            await createAddress(id, values);
            setAddressOpen(false);
            await refresh();
          } catch (error) {
            setFormError(getApiErrorMessage(error));
          }
        }}
      />
    </section>
  );
}

function ContactModal({
  open,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ContactWrite) => Promise<void>;
}) {
  const [values, setValues] = useState({ firstName: "", lastName: "", email: "", phone: "", jobTitle: "", isPrimary: true });
  const [fieldError, setFieldError] = useState<string | null>(null);
  return (
    <Modal open={open} title="Add contact" onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = contactSchema.safeParse(values);
          if (!parsed.success) {
            setFieldError(parsed.error.issues[0]?.message ?? "Check the contact");
            return;
          }
          setFieldError(null);
          void onSubmit({
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            isPrimary: parsed.data.isPrimary,
            ...(parsed.data.email ? { email: parsed.data.email } : {}),
            ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
            ...(parsed.data.jobTitle ? { jobTitle: parsed.data.jobTitle } : {}),
          });
        }}
      >
        <FormField label="First name" htmlFor="firstName">
          <Input id="firstName" value={values.firstName} onChange={(event) => setValues({ ...values, firstName: event.target.value })} />
        </FormField>
        <FormField label="Last name" htmlFor="lastName">
          <Input id="lastName" value={values.lastName} onChange={(event) => setValues({ ...values, lastName: event.target.value })} />
        </FormField>
        <FormField label="Email" htmlFor="contactEmail">
          <Input id="contactEmail" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} />
        </FormField>
        <FormField label="Phone" htmlFor="contactPhone">
          <Input id="contactPhone" value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })} />
        </FormField>
        <FormField label="Job title" htmlFor="jobTitle">
          <Input id="jobTitle" value={values.jobTitle} onChange={(event) => setValues({ ...values, jobTitle: event.target.value })} />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={values.isPrimary} onChange={(event) => setValues({ ...values, isPrimary: event.target.checked })} />
          Primary contact
        </label>
        {fieldError ? <p className="text-sm text-red-700">{fieldError}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit">Save contact</Button>
      </form>
    </Modal>
  );
}

function AddressModal({
  open,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: AddressWrite) => Promise<void>;
}) {
  const [values, setValues] = useState<AddressWrite>({
    purpose: "BILLING",
    isPrimary: true,
    line1: "",
    city: "",
    countryCode: "PK",
  });
  return (
    <Modal open={open} title="Add address" onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({ ...values, countryCode: values.countryCode.toUpperCase(), isPrimary: true });
        }}
      >
        <FormField label="Purpose" htmlFor="purpose">
          <select
            id="purpose"
            className="h-9 rounded-md border border-slate-300 px-3 text-sm"
            value={values.purpose}
            onChange={(event) => setValues({ ...values, purpose: event.target.value as AddressWrite["purpose"] })}
          >
            <option value="BILLING">Billing</option>
            <option value="SHIPPING">Shipping</option>
          </select>
        </FormField>
        <FormField label="Address line" htmlFor="line1">
          <Input id="line1" value={values.line1} onChange={(event) => setValues({ ...values, line1: event.target.value })} />
        </FormField>
        <FormField label="City" htmlFor="city">
          <Input id="city" value={values.city} onChange={(event) => setValues({ ...values, city: event.target.value })} />
        </FormField>
        <FormField label="Country" htmlFor="addressCountry">
          <Input id="addressCountry" maxLength={2} value={values.countryCode} onChange={(event) => setValues({ ...values, countryCode: event.target.value })} />
        </FormField>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit">Save address</Button>
      </form>
    </Modal>
  );
}

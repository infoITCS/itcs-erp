import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
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
  updateAddress,
  updateContact,
  type AddressWrite,
  type CustomerAddress,
  type ContactWrite,
} from "./api.ts";

const contactSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name"),
  lastName: z.string().trim().min(1, "Enter a last name"),
  email: z.string().trim(),
  phone: z.string().trim(),
  jobTitle: z.string().trim(),
  department: z.string().trim(),
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
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
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
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {customer.isPending ? <p className="text-sm text-slate-500">Loading customer…</p> : null}
      {customer.isError ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{getApiErrorMessage(customer.error)}</p> : null}
      {customer.data ? (
        <>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/customers" className="hover:text-slate-900">Customers</Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-slate-700">{customer.data.customerNumber}</span>
          </nav>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-5 p-5 md:p-7">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-teal-800">Customer profile</p>
                <h1 className="mt-2 break-words text-2xl font-semibold text-slate-950 md:text-3xl">{customer.data.displayName}</h1>
                {customer.data.legalName !== customer.data.displayName ? <p className="mt-1 text-sm text-slate-600">{customer.data.legalName}</p> : null}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <StatusBadge status={customer.data.status} />
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{customer.data.entityType === "INDIVIDUAL" ? "Individual" : "Company"}</span>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{customerTypeLabel(customer.data.customerType)}</span>
                  {customer.data.customerCategory ? <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">{labelFor(customer.data.customerCategory)}</span> : null}
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{customer.data.countryCode} · {customer.data.currencyCode}</span>
                  {customer.data.creditHold ? <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Credit hold</span> : null}
                </div>
              </div>
              <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                <Link to={`/customers/${id}/edit`} className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 sm:flex-none">
                  Edit customer
                </Link>
                <Button variant="secondary" onClick={() => setPendingDelete({ kind: "customer" })} className="flex-1 text-red-700 hover:bg-red-50 sm:flex-none">
                  Delete
                </Button>
              </div>
            </div>
            <div className="grid gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:grid-cols-2 md:grid-cols-3 md:px-7">
              <ContactDetail label="Email" value={customer.data.email} href={customer.data.email ? `mailto:${customer.data.email}` : undefined} />
              <ContactDetail label="Phone" value={customer.data.phone} href={customer.data.phone ? `tel:${customer.data.phone}` : undefined} />
              <ContactDetail label="Website" value={customer.data.website} href={customer.data.website ?? undefined} />
            </div>
            {customer.data.notes ? <p className="border-t border-slate-200 px-5 py-4 text-sm leading-6 text-slate-600 md:px-7">{customer.data.notes}</p> : null}
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex min-w-0 flex-col gap-6">
              <section className="flex flex-col gap-4">
                <SectionHeading title="Addresses" count={customer.data.addresses.length} action={<Button variant="secondary" onClick={() => {
                  setFormError(null);
                  setEditingAddress(null);
                  setAddressOpen(true);
                }}>Add address</Button>} />
                {customer.data.addresses.length === 0 ? <EmptySection>No addresses have been added.</EmptySection> : null}
                <ul className="grid gap-3 md:grid-cols-2">
                  {customer.data.addresses.map((address) => (
                    <li key={address.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">{address.label || (address.purpose === "BILLING" ? "Billing address" : "Shipping address")}</p>
                            {address.isPrimary ? <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">Primary</span> : null}
                          </div>
                          <p className="mt-1 text-xs font-medium uppercase text-slate-500">{address.purpose}</p>
                          <p className="mt-3 text-sm leading-6 text-slate-700">{[address.line1, address.line2, address.city, address.region, address.postalCode, address.countryCode].filter(Boolean).join(", ")}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button type="button" className="rounded px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700" onClick={() => {
                            setFormError(null);
                            setEditingAddress(address);
                            setAddressOpen(true);
                          }}>Edit</button>
                          <button type="button" className="rounded px-2 py-1 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600" onClick={() => setPendingDelete({ kind: "address", id: address.id, label: `${address.purpose} · ${address.line1}` })}>Remove</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="flex flex-col gap-4">
                <SectionHeading title="Contacts" count={contacts.data?.items.length ?? 0} action={<Button variant="secondary" onClick={() => setContactOpen(true)}>Add contact</Button>} />
                {contacts.isPending ? <p className="text-sm text-slate-500">Loading contacts…</p> : null}
                {contacts.isError ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{getApiErrorMessage(contacts.error)}</p> : null}
                {contacts.data && contacts.data.items.length === 0 ? <EmptySection>No contacts have been added.</EmptySection> : null}
                <ul className="flex flex-col gap-3">
                  {contacts.data?.items.map((contact) => (
                    <li key={contact.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-semibold text-teal-800">{contact.displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                            {contact.displayName}
                            {contact.isPrimary ? <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">Primary</span> : null}
                          </p>
                          <p className="mt-1 break-words text-sm text-slate-600">{[contact.jobTitle, contact.email, contact.phone].filter(Boolean).join(" · ") || contact.status}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:ml-auto">
                        {contact.isPrimary ? null : <button type="button" className="rounded px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={() => updateContact(contact.id, { isPrimary: true }).then(refresh)}>Make primary</button>}
                        <button type="button" className="rounded px-2 py-1 text-sm font-medium text-red-700 hover:bg-red-50" onClick={() => setPendingDelete({ kind: "contact", id: contact.id, label: contact.displayName })}>Remove</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <aside className="flex flex-col gap-6">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-slate-950">Account details</h2>
                <dl className="mt-4 flex flex-col divide-y divide-slate-100">
                  <DetailRow label="Credit limit" value={`${customer.data.currencyCode} ${customer.data.creditLimit}`} />
                  <DetailRow label="Credit status" value={customer.data.creditHold ? "On hold" : "Available"} />
                  <DetailRow label="Opening balance" value={`${customer.data.currencyCode} ${customer.data.openingBalance}`} />
                  <DetailRow label="Balance date" value={customer.data.openingBalanceDate ? new Date(customer.data.openingBalanceDate).toLocaleDateString() : "Not set"} />
                  <DetailRow label="Payment terms" value={customer.data.paymentTermId ? "Configured" : "Organization default"} />
                  <DetailRow label="Price family" value={customer.data.pricingGroupId ? "Configured" : "Organization default"} />
                  <DetailRow label="Payment method" value={customer.data.preferredPaymentMethod ? labelFor(customer.data.preferredPaymentMethod) : "Not set"} />
                  <DetailRow label="Communication" value={customer.data.preferredCommunicationChannel ? labelFor(customer.data.preferredCommunicationChannel) : "Not set"} />
                  <DetailRow label="Lead source" value={customer.data.leadSource ? labelFor(customer.data.leadSource) : "Not set"} />
                  <DetailRow label="Industry" value={customer.data.industry || "Not set"} />
                </dl>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-slate-950">Business profile</h2>
                <dl className="mt-4 flex flex-col divide-y divide-slate-100">
                  <DetailRow label="Employees" value={customer.data.employeeCount == null ? "Not set" : customer.data.employeeCount.toLocaleString()} />
                  <DetailRow label="Incorporation" value={customer.data.incorporationStatus ? labelFor(customer.data.incorporationStatus) : "Not set"} />
                  <DetailRow label="Registered" value={customer.data.businessRegistrationDate ? new Date(customer.data.businessRegistrationDate).toLocaleDateString() : "Not set"} />
                  <DetailRow label="Marketing consent" value={customer.data.emailMarketingOptIn ? "Opted in" : "Not opted in"} />
                  <DetailRow label="Delivery address" value={customer.data.sameAsBilling ? "Same as billing" : "Separate address"} />
                </dl>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-slate-950">Tax information</h2>
                <dl className="mt-4 flex flex-col divide-y divide-slate-100">
                  <DetailRow label="Tax ID type" value={customer.data.taxIdType ?? "Not set"} />
                  <DetailRow label="Tax number" value={customer.data.taxNumber || "Not set"} />
                  <DetailRow label="Sales tax group" value={customer.data.defaultTaxCodeId ? "Configured" : "Organization default"} />
                  <DetailRow label="Tax status" value={customer.data.taxExempt ? "Exempt" : "Standard"} />
                  {customer.data.taxExempt ? <DetailRow label="Exemption code" value={customer.data.taxExemptionCode || "Not set"} /> : null}
                </dl>
              </section>
            </aside>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Recent activity</h2>
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{audit.data?.items.length ?? 0} events</span>
            </div>
            {audit.isPending ? <p className="mt-4 text-sm text-slate-500">Loading activity…</p> : null}
            {audit.isError ? <p role="alert" className="mt-4 text-sm text-red-700">{getApiErrorMessage(audit.error)}</p> : null}
            {audit.data && audit.data.items.length === 0 ? <p className="mt-4 text-sm text-slate-500">No activity yet.</p> : null}
            <ol className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
              {audit.data?.items.map((event) => (
                <li key={event.id} className="relative border-l border-slate-200 pb-4 pl-4 last:pb-0">
                  <span aria-hidden="true" className="absolute -left-1 top-1 h-2 w-2 rounded-full bg-teal-700 ring-4 ring-white" />
                  <p className="text-sm font-medium text-slate-800">{formatActivityAction(event.action)}</p>
                  <time className="mt-1 block text-xs text-slate-500" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                </li>
              ))}
            </ol>
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

      <Modal
        open={addressOpen}
        title={editingAddress ? "Edit address" : "Add address"}
        onClose={() => {
          setAddressOpen(false);
          setEditingAddress(null);
        }}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => {
              setAddressOpen(false);
              setEditingAddress(null);
            }}>Cancel</Button>
            <Button type="submit" form="address-form">Save address</Button>
          </>
        }
      >
        <AddressForm
          key={editingAddress?.id ?? "new-address"}
          address={editingAddress}
          error={formError}
          onSubmit={async (body) => {
            setFormError(null);
            try {
              if (editingAddress) {
                await updateAddress(id, editingAddress.id, body);
              } else {
                await createAddress(id, body);
              }
              await refresh();
              setAddressOpen(false);
              setEditingAddress(null);
            } catch (error) {
              setFormError(getApiErrorMessage(error));
            }
          }}
        />
      </Modal>

      <Modal
        open={contactOpen}
        title="Add contact"
        onClose={() => setContactOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setContactOpen(false)}>Cancel</Button>
            <Button type="submit" form="contact-form">Save contact</Button>
          </>
        }
      >
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

function StatusBadge({ status }: { status: "ACTIVE" | "INACTIVE" | "HOLD" }) {
  const styles = status === "ACTIVE"
    ? "bg-emerald-50 text-emerald-800"
    : status === "HOLD"
      ? "bg-amber-50 text-amber-800"
      : "bg-slate-100 text-slate-700";
  const label = status === "HOLD" ? "On hold" : status[0] + status.slice(1).toLowerCase();
  return <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${styles}`}>{label}</span>;
}

function ContactDetail({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      {href ? <a href={href} className="mt-1 block break-words text-sm font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-teal-800">{value}</a> : <p className="mt-1 break-words text-sm font-medium text-slate-800">{value || "Not provided"}</p>}
    </div>
  );
}

function SectionHeading({ title, count, action }: { title: string; count: number; action: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-lg font-semibold text-slate-950">{title}</h2>
        <span className="shrink-0 rounded-md bg-slate-200/70 px-2 py-0.5 text-xs font-semibold text-slate-600">{count}</span>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function EmptySection({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">{children}</p>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="max-w-[60%] break-words text-right text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function customerTypeLabel(type: string): string {
  if (type === "COMPANY") return "Company";
  if (type === "INDIVIDUAL") return "Individual";
  if (type === "WHOLESALE") return "Wholesale";
  return type;
}

function labelFor(value: string): string {
  return value.toLowerCase().split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function formatActivityAction(action: string): string {
  return action.replace(/[._]/g, " ").split(/\s+/).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function AddressForm({
  address,
  error,
  onSubmit,
}: {
  address: CustomerAddress | null;
  error: string | null;
  onSubmit: (body: AddressWrite) => Promise<void>;
}) {
  const [fieldError, setFieldError] = useState<string | null>(null);
  return (
    <form
      id="address-form"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const parsed = addressSchema.safeParse({
          purpose: form.get("purpose"),
          isPrimary: form.get("isPrimary") === "on",
          label: String(form.get("label") ?? ""),
          line1: String(form.get("line1") ?? ""),
          line2: String(form.get("line2") ?? ""),
          city: String(form.get("city") ?? ""),
          region: String(form.get("region") ?? ""),
          postalCode: String(form.get("postalCode") ?? ""),
          countryCode: String(form.get("countryCode") ?? ""),
          latitude: String(form.get("latitude") ?? ""),
          longitude: String(form.get("longitude") ?? ""),
          geofenceRadiusMeters: String(form.get("geofenceRadiusMeters") ?? ""),
        });
        if (!parsed.success) {
          setFieldError(parsed.error.issues[0]?.message ?? "Check the address details");
          return;
        }
        setFieldError(null);
        void onSubmit({
          purpose: parsed.data.purpose,
          isPrimary: parsed.data.isPrimary,
          line1: parsed.data.line1,
          city: parsed.data.city,
          countryCode: parsed.data.countryCode.toUpperCase(),
          label: parsed.data.label || undefined,
          line2: parsed.data.line2 || undefined,
          region: parsed.data.region || undefined,
          postalCode: parsed.data.postalCode || undefined,
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          geofenceRadiusMeters: parsed.data.geofenceRadiusMeters,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Purpose" htmlFor="purpose">
          <select id="purpose" name="purpose" className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm" defaultValue={address?.purpose ?? "BILLING"}>
            <option value="BILLING">Billing</option>
            <option value="SHIPPING">Shipping</option>
          </select>
        </FormField>
        <FormField label="Label" htmlFor="label">
          <Input id="label" name="label" placeholder="Head office" defaultValue={address?.label ?? ""} />
        </FormField>
      </div>
      <FormField label="Line 1" htmlFor="line1">
        <Input id="line1" name="line1" required defaultValue={address?.line1 ?? ""} />
      </FormField>
      <FormField label="Line 2" htmlFor="line2">
        <Input id="line2" name="line2" defaultValue={address?.line2 ?? ""} />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="City" htmlFor="city">
          <Input id="city" name="city" required defaultValue={address?.city ?? ""} />
        </FormField>
        <FormField label="Country" htmlFor="countryCode">
          <Input id="countryCode" name="countryCode" maxLength={2} required defaultValue={address?.countryCode ?? "PK"} />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Region / state" htmlFor="region">
          <Input id="region" name="region" defaultValue={address?.region ?? ""} />
        </FormField>
        <FormField label="Postal code" htmlFor="postalCode">
          <Input id="postalCode" name="postalCode" defaultValue={address?.postalCode ?? ""} />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Latitude (optional)" htmlFor="latitude">
          <Input id="latitude" name="latitude" inputMode="decimal" defaultValue={address?.latitude == null ? "" : String(address.latitude)} />
        </FormField>
        <FormField label="Longitude (optional)" htmlFor="longitude">
          <Input id="longitude" name="longitude" inputMode="decimal" defaultValue={address?.longitude == null ? "" : String(address.longitude)} />
        </FormField>
      </div>
      <FormField label="Geofence radius in metres (optional)" htmlFor="geofenceRadiusMeters">
        <Input id="geofenceRadiusMeters" name="geofenceRadiusMeters" type="number" min="1" step="1" defaultValue={address?.geofenceRadiusMeters ?? ""} />
      </FormField>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="isPrimary" defaultChecked={address?.isPrimary ?? false} />
        Primary for this purpose
      </label>
      {fieldError ? <p role="alert" className="text-sm text-red-700">{fieldError}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}

const optionalCoordinate = (min: number, max: number, label: string) =>
  z.string().trim().refine((value) => !value || (Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max), `Enter a ${label} between ${min} and ${max}`).transform((value) => (value ? Number(value) : undefined));

const addressSchema = z.object({
  purpose: z.enum(["BILLING", "SHIPPING"]),
  isPrimary: z.boolean(),
  label: z.string().trim().max(80),
  line1: z.string().trim().min(1, "Enter address line 1").max(200),
  line2: z.string().trim().max(200),
  city: z.string().trim().min(1, "Enter a city").max(120),
  region: z.string().trim().max(120),
  postalCode: z.string().trim().max(20),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a two-letter country code"),
  latitude: optionalCoordinate(-90, 90, "latitude"),
  longitude: optionalCoordinate(-180, 180, "longitude"),
  geofenceRadiusMeters: z.string().trim().refine((value) => !value || (Number.isInteger(Number(value)) && Number(value) > 0), "Enter a positive whole number of metres").transform((value) => (value ? Number(value) : undefined)),
}).refine((value) => (value.latitude === undefined) === (value.longitude === undefined), {
  message: "Provide both latitude and longitude, or leave both empty",
  path: ["latitude"],
});

function ContactForm({ error, onSubmit }: { error: string | null; onSubmit: (body: ContactWrite) => Promise<void> }) {
  return (
    <form
      id="contact-form"
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
          department: String(form.get("department") ?? ""),
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
          department: parsed.data.department || undefined,
          isPrimary: parsed.data.isPrimary,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="First name" htmlFor="firstName">
          <Input id="firstName" name="firstName" required />
        </FormField>
        <FormField label="Last name" htmlFor="lastName">
          <Input id="lastName" name="lastName" required />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Job title" htmlFor="jobTitle">
          <Input id="jobTitle" name="jobTitle" />
        </FormField>
        <FormField label="Department" htmlFor="department">
          <Input id="department" name="department" />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" />
        </FormField>
        <FormField label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="isPrimary" />
        Primary contact
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}

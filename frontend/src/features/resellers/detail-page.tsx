import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormField } from "@/components/forms/FormField.tsx";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { listCustomers } from "@/features/customers/api.ts";
import {
  assignCustomer,
  createAddress,
  createContact,
  deleteAddress,
  deleteContact,
  deleteReseller,
  getReseller,
  listResellerAudit,
  listResellerCustomers,
  unassignCustomer,
  updateContact,
  type AddressWrite,
  type ContactWrite,
} from "./api.ts";

type PendingDelete =
  | { kind: "reseller" }
  | { kind: "address"; id: string; label: string }
  | { kind: "contact"; id: string; label: string }
  | { kind: "customer"; id: string; label: string };

export default function ResellerDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [contactOpen, setContactOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const reseller = useQuery({ queryKey: ["resellers", id], queryFn: () => getReseller(id) });
  const customers = useQuery({ queryKey: ["resellers", id, "customers"], queryFn: () => listResellerCustomers(id) });
  const audit = useQuery({ queryKey: ["resellers", id, "audit"], queryFn: () => listResellerAudit(id) });
  const customerPicker = useQuery({
    queryKey: ["customers", "assign-picker"],
    queryFn: () => listCustomers({ limit: 100, status: "ACTIVE" }),
    enabled: customerOpen,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["resellers", id] });
  };

  const removeReseller = useMutation({
    mutationFn: () => deleteReseller(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resellers", "list"] });
      navigate("/resellers");
    },
  });

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    setConfirmBusy(true);
    try {
      if (pendingDelete.kind === "reseller") {
        await removeReseller.mutateAsync();
      } else if (pendingDelete.kind === "address") {
        await deleteAddress(id, pendingDelete.id);
        await refresh();
      } else if (pendingDelete.kind === "contact") {
        await deleteContact(pendingDelete.id);
        await refresh();
      } else {
        await unassignCustomer(id, pendingDelete.id);
        await queryClient.invalidateQueries({ queryKey: ["resellers", id] });
      }
      setPendingDelete(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {reseller.isPending ? <p className="text-sm text-slate-500">Loading reseller…</p> : null}
      {reseller.isError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {getApiErrorMessage(reseller.error)}
        </p>
      ) : null}
      {reseller.data ? (
        <>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/resellers" className="hover:text-slate-900">
              Resellers
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-slate-700">{reseller.data.resellerNumber}</span>
          </nav>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-5 p-5 md:p-7">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">CRM / Channel</p>
                <p className="mt-2 font-mono text-xs text-slate-500">{reseller.data.resellerNumber}</p>
                <h1 className="mt-1 break-words text-2xl font-semibold text-slate-950 md:text-3xl">{reseller.data.displayName}</h1>
                {reseller.data.legalName !== reseller.data.displayName ? (
                  <p className="mt-1 text-sm text-slate-600">{reseller.data.legalName}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                      reseller.data.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                        : reseller.data.status === "SUSPENDED"
                          ? "bg-amber-50 text-amber-800 ring-amber-200"
                          : "bg-slate-100 text-slate-700 ring-slate-200"
                    }`}
                  >
                    {reseller.data.status === "ACTIVE" ? "Active" : reseller.data.status === "SUSPENDED" ? "Suspended" : "Inactive"}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {reseller.data.countryCode} · {reseller.data.currencyCode}
                  </span>
                  <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">
                    List {reseller.data.priceListCode}
                  </span>
                </div>
              </div>
              <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                <Link
                  to={`/resellers/${id}/edit`}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:flex-none"
                >
                  Edit
                </Link>
                <Button
                  variant="secondary"
                  className="h-10 flex-1 text-red-700 hover:bg-red-50 sm:flex-none"
                  onClick={() => setPendingDelete({ kind: "reseller" })}
                >
                  Delete
                </Button>
              </div>
            </div>
            <div className="grid gap-3 border-t border-slate-100 px-5 py-4 text-sm sm:grid-cols-3 md:px-7">
              <div>
                <p className="text-xs text-slate-500">Contact</p>
                <p className="mt-0.5 text-slate-800">{[reseller.data.email, reseller.data.phone].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Website / tax</p>
                <p className="mt-0.5 text-slate-800">{[reseller.data.website, reseller.data.taxNumber].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Pricing defaults</p>
                <p className="mt-0.5 text-slate-800">
                  {[reseller.data.defaultDiscountPercent ? `Discount ${reseller.data.defaultDiscountPercent}%` : null, reseller.data.defaultCommissionPercent ? `Commission ${reseller.data.defaultCommissionPercent}%` : null]
                    .filter(Boolean)
                    .join(" · ") || "No defaults"}
                </p>
              </div>
            </div>
            {reseller.data.notes ? <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-600 md:px-7">{reseller.data.notes}</p> : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Addresses</h2>
              <Button variant="secondary" className="h-9" onClick={() => setAddressOpen(true)}>
                Add address
              </Button>
            </div>
            {reseller.data.addresses.length === 0 ? <p className="text-sm text-slate-500">No addresses yet.</p> : null}
            <ul className="grid gap-3 md:grid-cols-2">
              {reseller.data.addresses.map((address) => (
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

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Contacts</h2>
              <Button variant="secondary" className="h-9" onClick={() => setContactOpen(true)}>
                Add contact
              </Button>
            </div>
            <ul className="flex flex-col gap-2">
              {reseller.data.contacts.map((contact) => (
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

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Customers</h2>
              <Button variant="secondary" className="h-9" onClick={() => setCustomerOpen(true)} disabled={reseller.data.status !== "ACTIVE"}>
                Assign customer
              </Button>
            </div>
            {customers.data?.items.length === 0 ? <p className="text-sm text-slate-500">No customers assigned.</p> : null}
            <ul className="flex flex-col gap-2">
              {customers.data?.items.map((customer) => (
                <li key={customer.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
                  <Link className="font-medium text-slate-900 underline" to={`/customers/${customer.id}`}>
                    {customer.displayName} ({customer.customerNumber})
                  </Link>
                  <button
                    type="button"
                    className="text-red-700"
                    onClick={() =>
                      setPendingDelete({
                        kind: "customer",
                        id: customer.id,
                        label: `${customer.displayName} (${customer.customerNumber})`,
                      })
                    }
                  >
                    Unassign
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-900">Performance</h2>
            <p className="mt-1 text-sm text-slate-500">Sales, invoices, and renewals will appear here after those modules ship.</p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Activity</h2>
            {(audit.data?.items ?? []).length === 0 ? <p className="text-sm text-slate-500">No audit events yet.</p> : null}
            <ul className="flex flex-col gap-1 text-sm text-slate-700">
              {(audit.data?.items ?? []).map((event) => (
                <li key={event.id}>
                  {event.action} · {new Date(event.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>

          <ConfirmDialog
            open={pendingDelete !== null}
            title={
              pendingDelete?.kind === "reseller"
                ? "Delete reseller?"
                : pendingDelete?.kind === "address"
                  ? "Remove address?"
                  : pendingDelete?.kind === "contact"
                    ? "Remove contact?"
                    : "Unassign customer?"
            }
            description={
              pendingDelete?.kind === "reseller" ? (
                <p>
                  Soft-delete <span className="font-medium text-slate-900">{reseller.data.displayName}</span>? You can restore it
                  later with the right permission.
                </p>
              ) : pendingDelete?.kind === "customer" ? (
                <p>
                  Unassign <span className="font-medium text-slate-900">{pendingDelete.label}</span> from this reseller? The
                  customer record stays intact.
                </p>
              ) : (
                <p>
                  Remove <span className="font-medium text-slate-900">{pendingDelete?.label}</span>? This soft-deletes the
                  record.
                </p>
              )
            }
            confirmLabel={
              pendingDelete?.kind === "reseller"
                ? "Delete reseller"
                : pendingDelete?.kind === "customer"
                  ? "Unassign"
                  : "Remove"
            }
            busy={confirmBusy || removeReseller.isPending}
            onCancel={() => setPendingDelete(null)}
            onConfirm={() => {
              void confirmDelete();
            }}
          />

          <Modal open={addressOpen} title="Add address" onClose={() => setAddressOpen(false)}>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const body: AddressWrite = {
                  purpose: String(form.get("purpose") ?? "BILLING") as AddressWrite["purpose"],
                  isPrimary: form.get("isPrimary") === "on",
                  line1: String(form.get("line1") ?? ""),
                  city: String(form.get("city") ?? ""),
                  countryCode: String(form.get("countryCode") ?? "").toUpperCase(),
                  line2: String(form.get("line2") ?? "") || undefined,
                  region: String(form.get("region") ?? "") || undefined,
                  postalCode: String(form.get("postalCode") ?? "") || undefined,
                };
                setFormError(null);
                try {
                  await createAddress(id, body);
                  await refresh();
                  setAddressOpen(false);
                } catch (error) {
                  setFormError(getApiErrorMessage(error));
                }
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
              {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
              <Button type="submit">Save address</Button>
            </form>
          </Modal>

          <Modal open={contactOpen} title="Add contact" onClose={() => setContactOpen(false)}>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const body: ContactWrite = {
                  firstName: String(form.get("firstName") ?? ""),
                  lastName: String(form.get("lastName") ?? ""),
                  email: String(form.get("email") ?? "") || undefined,
                  phone: String(form.get("phone") ?? "") || undefined,
                  jobTitle: String(form.get("jobTitle") ?? "") || undefined,
                  isPrimary: form.get("isPrimary") === "on",
                };
                setFormError(null);
                try {
                  await createContact(id, body);
                  await refresh();
                  setContactOpen(false);
                } catch (error) {
                  setFormError(getApiErrorMessage(error));
                }
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
              {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
              <Button type="submit">Save contact</Button>
            </form>
          </Modal>

          <Modal open={customerOpen} title="Assign customer" onClose={() => setCustomerOpen(false)}>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const customerId = String(form.get("customerId") ?? "");
                setFormError(null);
                try {
                  await assignCustomer(id, customerId);
                  await queryClient.invalidateQueries({ queryKey: ["resellers", id] });
                  setCustomerOpen(false);
                } catch (error) {
                  setFormError(getApiErrorMessage(error));
                }
              }}
            >
              <FormField label="Customer" htmlFor="customerId">
                <select id="customerId" name="customerId" required className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm">
                  <option value="">{customerPicker.isPending ? "Loading…" : "Select customer"}</option>
                  {(customerPicker.data?.items ?? []).map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.displayName} ({customer.customerNumber})
                    </option>
                  ))}
                </select>
              </FormField>
              {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
              <Button type="submit">Assign</Button>
            </form>
          </Modal>
        </>
      ) : null}
    </section>
  );
}

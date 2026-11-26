import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormField } from "@/components/forms/FormField.tsx";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { listCustomers } from "@/features/customers/api.ts";
import { useHasPermission } from "@/hooks/useSession.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  assignCustomer,
  createAddress,
  createContact,
  deleteAddress,
  deleteContact,
  deleteReseller,
  getReseller,
  getResellerFormOptions,
  listResellerCustomers,
  restoreReseller,
  unassignCustomer,
  updateAddress,
  updateContact,
  type AddressWrite,
  type ContactWrite,
  type ResellerAddress,
  type ResellerContact,
  type ResellerStatus,
} from "./api.ts";
import { countrySelectOptions } from "./options.ts";

type Tab = "overview" | "addresses" | "contacts" | "customers";
type AddressTarget = ResellerAddress | "new" | null;
type ContactTarget = ResellerContact | "new" | null;
type PendingDelete =
  | { kind: "reseller" }
  | { kind: "address"; id: string; label: string }
  | { kind: "contact"; id: string; label: string }
  | { kind: "customer"; id: string; label: string };

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "addresses", label: "Addresses" },
  { id: "contacts", label: "Contacts" },
  { id: "customers", label: "Customers" },
];

export default function ResellerDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission("resellers:update");
  const canDelete = useHasPermission("resellers:delete");
  const canRestore = useHasPermission("resellers:restore");

  const [tab, setTab] = useState<Tab>("overview");
  const [addressTarget, setAddressTarget] = useState<AddressTarget>(null);
  const [contactTarget, setContactTarget] = useState<ContactTarget>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const reseller = useQuery({ queryKey: ["resellers", id], queryFn: () => getReseller(id), enabled: Boolean(id) });
  const customers = useQuery({
    queryKey: ["resellers", id, "customers"],
    queryFn: () => listResellerCustomers(id, { limit: 100 }),
    enabled: Boolean(id),
  });
  const customerPicker = useQuery({
    queryKey: ["customers", "assign-picker"],
    queryFn: () => listCustomers({ limit: 100, status: "ACTIVE" }),
    enabled: pickerOpen,
  });
  const formOptions = useQuery({
    queryKey: ["resellers", "form-options"],
    queryFn: getResellerFormOptions,
    staleTime: 5 * 60_000,
  });
  const addressCountryOptions = countrySelectOptions(formOptions.data?.countries ?? [], [
    addressTarget === "new" ? "PK" : addressTarget?.countryCode,
  ]);

  const removeReseller = useMutation({
    mutationFn: () => deleteReseller(id),
    onSuccess: async () => {
      await refresh();
      navigate("/resellers");
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });
  const restore = useMutation({
    mutationFn: () => restoreReseller(id),
    onSuccess: async () => {
      await refresh();
      setActionError(null);
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  const data = reseller.data;
  const isDeleted = Boolean(data?.deletedAt);
  const addressCount = data?.addresses.length ?? 0;
  const contactCount = data?.contacts.length ?? 0;
  const customerCount = customers.data?.items.length ?? 0;

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["resellers"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
    ]);
  }

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    setConfirmBusy(true);
    setActionError(null);
    try {
      if (pendingDelete.kind === "reseller") {
        await removeReseller.mutateAsync();
      } else if (pendingDelete.kind === "address") {
        await deleteAddress(id, pendingDelete.id);
      } else if (pendingDelete.kind === "contact") {
        await deleteContact(pendingDelete.id);
      } else {
        await unassignCustomer(id, pendingDelete.id);
      }
      await refresh();
      setPendingDelete(null);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setConfirmBusy(false);
    }
  }

  async function makePrimary(contact: ResellerContact) {
    setActionError(null);
    try {
      await updateContact(contact.id, { isPrimary: true });
      await refresh();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    }
  }

  async function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addressTarget) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const optional = (name: string) => value(name) || null;
    const body: AddressWrite = {
      purpose: value("purpose") === "SHIPPING" ? "SHIPPING" : "BILLING",
      isPrimary: form.get("isPrimary") === "on",
      label: optional("label"),
      line1: value("line1"),
      line2: optional("line2"),
      city: value("city"),
      region: optional("region"),
      postalCode: optional("postalCode"),
      countryCode: value("countryCode").toUpperCase(),
    };
    setSaving(true);
    setFormError(null);
    try {
      if (addressTarget === "new") {
        await createAddress(id, body);
      } else {
        await updateAddress(id, addressTarget.id, body);
      }
      await refresh();
      setAddressTarget(null);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contactTarget) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const optional = (name: string) => value(name) || null;
    const body: ContactWrite = {
      firstName: value("firstName"),
      lastName: value("lastName"),
      displayName: optional("displayName"),
      jobTitle: optional("jobTitle"),
      department: optional("department"),
      email: optional("email"),
      phone: optional("phone"),
      mobile: optional("mobile"),
      isPrimary: form.get("isPrimary") === "on",
      status: value("status") === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      notes: optional("notes"),
    };
    setSaving(true);
    setFormError(null);
    try {
      if (contactTarget === "new") {
        await createContact(id, body);
      } else {
        await updateContact(contactTarget.id, body);
      }
      await refresh();
      setContactTarget(null);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const customerId = String(new FormData(event.currentTarget).get("customerId") ?? "");
    if (!customerId) {
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await assignCustomer(id, customerId);
      await refresh();
      setPickerOpen(false);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      {reseller.isPending ? (
        <div className="grid gap-5">
          <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      ) : null}

      {reseller.isError ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          <p className="font-semibold">Unable to load this reseller.</p>
          <p className="mt-1">{getApiErrorMessage(reseller.error)}</p>
          <Button variant="secondary" className="mt-4" onClick={() => void reseller.refetch()}>Try again</Button>
        </div>
      ) : null}

      {data ? (
        <>
          {isDeleted ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              <p className="font-medium">This reseller was deleted on {formatDate(data.deletedAt)}.</p>
              {canRestore ? (
                <Button variant="secondary" disabled={restore.isPending} onClick={() => restore.mutate()}>
                  {restore.isPending ? "Restoring…" : "Restore reseller"}
                </Button>
              ) : null}
            </div>
          ) : null}

          <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-sky-400" />
            <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-xs text-slate-500">
                  <Link to="/resellers" className="hover:text-brand-700">Resellers</Link>
                  <span aria-hidden="true">/</span>
                  <span className="font-mono">{data.resellerNumber}</span>
                </nav>
                <div className="flex items-start gap-4">
                  <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-700 to-sky-500 text-base font-bold text-white shadow-sm sm:flex">
                    {initials(data.displayName)}
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">CRM / Channel partner</p>
                    <h1 className="break-words text-3xl font-bold tracking-tight text-slate-950">{data.displayName}</h1>
                    {data.legalName !== data.displayName ? <p className="mt-1 text-sm text-slate-600">{data.legalName}</p> : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusPill status={data.status} />
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{data.countryCode} · {data.currencyCode}</span>
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">List {data.priceListCode}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex w-full shrink-0 flex-wrap gap-2 lg:w-auto">
                {canUpdate && !isDeleted ? (
                  <Link to={`/resellers/${id}/edit`} className="inline-flex h-10 items-center justify-center rounded-md bg-brand-800 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-900">Edit reseller</Link>
                ) : null}
                {canDelete && !isDeleted ? (
                  <Button variant="secondary" className="h-10 text-rose-700 hover:bg-rose-50" onClick={() => setPendingDelete({ kind: "reseller" })}>Delete</Button>
                ) : null}
              </div>
            </div>
            <div className="grid gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Linked customers" value={customerCount.toString()} hint="Active portfolio" />
              <Metric label="Contacts" value={contactCount.toString()} hint={`${data.contacts.filter((contact) => contact.isPrimary).length} primary`} />
              <Metric label="Addresses" value={addressCount.toString()} hint={`${data.addresses.filter((address) => address.isPrimary).length} primary`} />
              <Metric label="Pricing defaults" value={data.defaultDiscountPercent ? `${data.defaultDiscountPercent}%` : "—"} hint={data.defaultCommissionPercent ? `${data.defaultCommissionPercent}% commission` : "No commission"} />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <nav aria-label="Reseller sections" className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/60 px-3 pt-3 sm:px-5">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`relative whitespace-nowrap px-4 py-3 text-sm font-semibold transition ${tab === item.id ? "text-brand-800" : "text-slate-500 hover:text-slate-800"}`}
                >
                  {item.label}
                  {tab === item.id ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-600" /> : null}
                </button>
              ))}
            </nav>

            <div className="p-5 sm:p-6">
              {actionError ? (
                <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{actionError}</p>
              ) : null}

              {tab === "overview" ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  <InfoCard title="Company" rows={[
                    ["Legal name", data.legalName],
                    ["Display name", data.displayName],
                    ["Tax / VAT", data.taxNumber ?? "—"],
                    ["Country", data.countryCode],
                    ["Currency", data.currencyCode],
                  ]} />
                  <InfoCard title="Business contact" rows={[
                    ["Email", data.email ?? "—"],
                    ["Phone", data.phone ?? "—"],
                    ["Website", data.website ?? "—"],
                    ["Primary contact", data.contacts.find((contact) => contact.isPrimary)?.displayName ?? "—"],
                  ]} />
                  <InfoCard title="Pricing" rows={[
                    ["Price list", data.priceListCode],
                    ["Default discount", data.defaultDiscountPercent ? `${data.defaultDiscountPercent}%` : "—"],
                    ["Default commission", data.defaultCommissionPercent ? `${data.defaultCommissionPercent}%` : "—"],
                  ]} />
                  <section className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
                    <h2 className="text-sm font-bold text-slate-950">Internal notes</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{data.notes || "No notes recorded."}</p>
                  </section>
                </div>
              ) : null}

              {tab === "addresses" ? (
                <div className="flex flex-col gap-4">
                  <SectionHeader
                    title="Partner addresses"
                    description="Billing and shipping locations used by channel operations."
                    action={canUpdate && !isDeleted ? <Button onClick={() => { setFormError(null); setAddressTarget("new"); }}>Add address</Button> : null}
                  />
                  {addressCount === 0 ? <EmptyState title="No addresses yet" description="Add the first billing or shipping address for this partner." /> : null}
                  <div className="grid gap-3 md:grid-cols-2">
                    {data.addresses.map((address) => (
                      <article key={address.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-950">{address.purpose}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {[address.line1, address.line2, address.city, address.region, address.postalCode, address.countryCode].filter(Boolean).join(", ")}
                            </p>
                          </div>
                          {address.isPrimary ? <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-800">PRIMARY</span> : null}
                        </div>
                        {canUpdate && !isDeleted ? (
                          <div className="mt-4 flex gap-3 text-xs font-semibold">
                            <button type="button" className="text-brand-700 hover:underline" onClick={() => { setFormError(null); setAddressTarget(address); }}>Edit</button>
                            <button type="button" className="text-rose-700 hover:underline" onClick={() => setPendingDelete({ kind: "address", id: address.id, label: `${address.purpose} · ${address.line1}` })}>Remove</button>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {tab === "contacts" ? (
                <div className="flex flex-col gap-4">
                  <SectionHeader
                    title="Partner contacts"
                    description="Primary and secondary people who manage this relationship."
                    action={canUpdate && !isDeleted ? <Button onClick={() => { setFormError(null); setContactTarget("new"); }}>Add contact</Button> : null}
                  />
                  {contactCount === 0 ? <EmptyState title="No contacts yet" description="Add a named contact so sales and support know who to reach." /> : null}
                  <div className="grid gap-3 md:grid-cols-2">
                    {data.contacts.map((contact) => (
                      <article key={contact.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">{initials(contact.displayName)}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-slate-950">{contact.displayName}</p>
                              {contact.isPrimary ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-800">PRIMARY</span> : null}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{[contact.jobTitle, contact.department].filter(Boolean).join(" · ") || contact.status}</p>
                            <p className="mt-2 break-words text-sm text-slate-600">{[contact.email, contact.phone, contact.mobile].filter(Boolean).join(" · ") || "No contact details"}</p>
                          </div>
                        </div>
                        {canUpdate && !isDeleted ? (
                          <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
                            <button type="button" className="text-brand-700 hover:underline" onClick={() => { setFormError(null); setContactTarget(contact); }}>Edit</button>
                            {!contact.isPrimary ? <button type="button" className="text-brand-700 hover:underline" onClick={() => void makePrimary(contact)}>Make primary</button> : null}
                            <button type="button" className="text-rose-700 hover:underline" onClick={() => setPendingDelete({ kind: "contact", id: contact.id, label: contact.displayName })}>Remove</button>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {tab === "customers" ? (
                <div className="flex flex-col gap-4">
                  <SectionHeader
                    title="Assigned customers"
                    description="Only active resellers can receive new customer assignments."
                    action={canUpdate && !isDeleted && data.status === "ACTIVE" ? <Button onClick={() => { setFormError(null); setPickerOpen(true); }}>Assign customer</Button> : null}
                  />
                  {data.status !== "ACTIVE" && !isDeleted ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Activate this reseller before assigning customers.</p>
                  ) : null}
                  {customers.isPending ? <p className="text-sm text-slate-500">Loading customers…</p> : null}
                  {customers.isError ? <p role="alert" className="text-sm text-rose-700">{getApiErrorMessage(customers.error)}</p> : null}
                  {customers.data?.items.length === 0 ? <EmptyState title="No customers assigned" description="Assign an existing customer to track this partner’s portfolio." /> : null}
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    {(customers.data?.items ?? []).map((customer) => (
                      <div key={customer.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                        <div>
                          <Link to={`/customers/${customer.id}`} className="text-sm font-semibold text-brand-800 hover:underline">{customer.displayName}</Link>
                          <p className="mt-0.5 font-mono text-xs text-slate-500">{customer.customerNumber} · {customer.countryCode} · {customer.status}</p>
                        </div>
                        {canUpdate && !isDeleted ? (
                          <button type="button" className="text-xs font-semibold text-rose-700 hover:underline" onClick={() => setPendingDelete({ kind: "customer", id: customer.id, label: `${customer.displayName} (${customer.customerNumber})` })}>Unassign</button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

            </div>
          </section>
        </>
      ) : null}

      <Modal open={addressTarget !== null} title={addressTarget === "new" ? "Add address" : "Edit address"} onClose={() => setAddressTarget(null)}>
        <form key={addressTarget === "new" ? "new" : addressTarget?.id} className="grid gap-4" onSubmit={(event) => void submitAddress(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Purpose" htmlFor="address-purpose">
              <select id="address-purpose" name="purpose" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" defaultValue={addressTarget === "new" ? "BILLING" : addressTarget?.purpose}>
                <option value="BILLING">Billing</option>
                <option value="SHIPPING">Shipping</option>
              </select>
            </FormField>
            <FormField label="Label" htmlFor="address-label">
              <Input id="address-label" name="label" defaultValue={addressTarget === "new" ? "" : addressTarget?.label ?? ""} />
            </FormField>
          </div>
          <FormField label="Line 1" htmlFor="address-line1" required>
            <Input id="address-line1" name="line1" required defaultValue={addressTarget === "new" ? "" : addressTarget?.line1 ?? ""} />
          </FormField>
          <FormField label="Line 2" htmlFor="address-line2">
            <Input id="address-line2" name="line2" defaultValue={addressTarget === "new" ? "" : addressTarget?.line2 ?? ""} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="City" htmlFor="address-city" required>
              <Input id="address-city" name="city" required defaultValue={addressTarget === "new" ? "" : addressTarget?.city ?? ""} />
            </FormField>
            <FormField label="Region" htmlFor="address-region">
              <Input id="address-region" name="region" defaultValue={addressTarget === "new" ? "" : addressTarget?.region ?? ""} />
            </FormField>
            <FormField label="Postal code" htmlFor="address-postal">
              <Input id="address-postal" name="postalCode" defaultValue={addressTarget === "new" ? "" : addressTarget?.postalCode ?? ""} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Country" htmlFor="address-country" required>
              <select id="address-country" name="countryCode" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" disabled={formOptions.isPending} required defaultValue={addressTarget === "new" ? "PK" : addressTarget?.countryCode ?? "PK"}>
                <option value="">{formOptions.isPending ? "Loading…" : "Select country"}</option>
                {addressCountryOptions.map((country) => <option key={country.code} value={country.code}>{country.name} ({country.code})</option>)}
              </select>
            </FormField>
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="isPrimary" defaultChecked={addressTarget !== "new" && addressTarget?.isPrimary} /> Primary for this purpose
            </label>
          </div>
          {formError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAddressTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save address"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={contactTarget !== null} title={contactTarget === "new" ? "Add contact" : "Edit contact"} onClose={() => setContactTarget(null)}>
        <form key={contactTarget === "new" ? "new" : contactTarget?.id} className="grid gap-4" onSubmit={(event) => void submitContact(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name" htmlFor="contact-first" required>
              <Input id="contact-first" name="firstName" required defaultValue={contactTarget === "new" ? "" : contactTarget?.firstName ?? ""} />
            </FormField>
            <FormField label="Last name" htmlFor="contact-last" required>
              <Input id="contact-last" name="lastName" required defaultValue={contactTarget === "new" ? "" : contactTarget?.lastName ?? ""} />
            </FormField>
          </div>
          <FormField label="Display name" htmlFor="contact-display">
            <Input id="contact-display" name="displayName" defaultValue={contactTarget === "new" ? "" : contactTarget?.displayName ?? ""} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Job title" htmlFor="contact-title">
              <Input id="contact-title" name="jobTitle" defaultValue={contactTarget === "new" ? "" : contactTarget?.jobTitle ?? ""} />
            </FormField>
            <FormField label="Department" htmlFor="contact-department">
              <Input id="contact-department" name="department" defaultValue={contactTarget === "new" ? "" : contactTarget?.department ?? ""} />
            </FormField>
            <FormField label="Email" htmlFor="contact-email">
              <Input id="contact-email" name="email" type="email" defaultValue={contactTarget === "new" ? "" : contactTarget?.email ?? ""} />
            </FormField>
            <FormField label="Phone" htmlFor="contact-phone">
              <Input id="contact-phone" name="phone" defaultValue={contactTarget === "new" ? "" : contactTarget?.phone ?? ""} />
            </FormField>
            <FormField label="Mobile" htmlFor="contact-mobile">
              <Input id="contact-mobile" name="mobile" defaultValue={contactTarget === "new" ? "" : contactTarget?.mobile ?? ""} />
            </FormField>
            <FormField label="Status" htmlFor="contact-status">
              <select id="contact-status" name="status" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" defaultValue={contactTarget === "new" ? "ACTIVE" : contactTarget?.status ?? "ACTIVE"}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </FormField>
          </div>
          <FormField label="Notes" htmlFor="contact-notes">
            <textarea id="contact-notes" name="notes" className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={contactTarget === "new" ? "" : contactTarget?.notes ?? ""} />
          </FormField>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" name="isPrimary" defaultChecked={contactTarget !== "new" && contactTarget?.isPrimary} /> Primary contact
          </label>
          {formError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setContactTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save contact"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={pickerOpen} title="Assign customer" onClose={() => setPickerOpen(false)}>
        <form className="grid gap-4" onSubmit={(event) => void submitAssignment(event)}>
          <FormField label="Customer" htmlFor="assign-customer" required>
            <select id="assign-customer" name="customerId" required className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" defaultValue="">
              <option value="">{customerPicker.isPending ? "Loading…" : "Select customer"}</option>
              {(customerPicker.data?.items ?? [])
                .filter((customer) => !(customers.data?.items ?? []).some((assigned) => assigned.id === customer.id))
                .map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.displayName} ({customer.customerNumber})</option>
                ))}
            </select>
          </FormField>
          {formError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPickerOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Assigning…" : "Assign"}</Button>
          </div>
        </form>
      </Modal>

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
            <p>Soft-delete <span className="font-semibold text-slate-900">{data?.displayName}</span>? You can restore it later.</p>
          ) : pendingDelete?.kind === "customer" ? (
            <p>Unassign <span className="font-semibold text-slate-900">{pendingDelete.label}</span>? The customer record stays intact.</p>
          ) : (
            <p>Remove <span className="font-semibold text-slate-900">{pendingDelete?.label}</span>? This soft-deletes the record.</p>
          )
        }
        confirmLabel={pendingDelete?.kind === "customer" ? "Unassign" : pendingDelete?.kind === "reseller" ? "Delete reseller" : "Remove"}
        busy={confirmBusy || removeReseller.isPending}
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function StatusPill({ status }: { status: ResellerStatus }) {
  const tone = status === "ACTIVE"
    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
    : status === "SUSPENDED"
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : "bg-slate-100 text-slate-700 ring-slate-200";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${tone}`}>{status}</span>;
}

function InfoCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-slate-950">{title}</h2>
      <dl className="mt-3 divide-y divide-slate-100 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap justify-between gap-3 py-2">
            <dt className="text-slate-500">{label}</dt>
            <dd className="max-w-[65%] break-words text-right font-medium text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SectionHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-10 text-center">
      <p className="text-sm font-bold text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "RS";
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FormField } from "@/components/forms/FormField.tsx";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { listCustomers, type CustomerSummary } from "@/features/customers/api.ts";
import { createContact, deleteContact, listOrgContacts, updateContact } from "./api.ts";
import { ContactListView } from "./contact-list-view.tsx";

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("contacts:create");
  const canUpdate = useHasPermission("contacts:update");
  const canDelete = useHasPermission("contacts:delete");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [primary, setPrimary] = useState("");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);
  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    isPrimary: primary || undefined,
    cursor,
    limit: 50,
  };
  const contacts = useQuery({
    queryKey: queryKeys.list("contacts", params),
    queryFn: () => listOrgContacts(params),
  });
  const customers = useQuery({
    queryKey: ["customers", "picker"],
    queryFn: () => listCustomers({ limit: 100, status: "ACTIVE" }),
    enabled: open,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
  };

  const remove = useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: async () => {
      await refresh();
      setPendingDelete(null);
    },
  });
  const promote = useMutation({
    mutationFn: (id: string) => updateContact(id, { isPrimary: true }),
    onSuccess: async () => refresh(),
  });

  const rows = contacts.data?.items ?? [];
  const error = contacts.isError ? getApiErrorMessage(contacts.error) : null;
  const actionError = promote.isError ? getApiErrorMessage(promote.error) : deleteError;
  const pageSummary = `${rows.length} contact${rows.length === 1 ? "" : "s"} on page ${cursors.length}`;

  function reset(setter: (value: string) => void, value: string) {
    setter(value);
    setCursors([undefined]);
  }

  function clearFilters() {
    setQ("");
    setStatus("");
    setPrimary("");
    setCursors([undefined]);
  }

  async function createContactFromForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customerId = String(form.get("customerId") ?? "");
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    if (!customerId) {
      setFormError("Choose a customer");
      return;
    }
    if (!firstName || !lastName) {
      setFormError("First and last name are required");
      return;
    }
    setFormError(null);
    setFormSaving(true);
    try {
      await createContact(customerId, {
        firstName,
        lastName,
        email: String(form.get("email") ?? "").trim() || undefined,
        phone: String(form.get("phone") ?? "").trim() || undefined,
        jobTitle: String(form.get("jobTitle") ?? "").trim() || undefined,
        isPrimary: form.get("isPrimary") === "on",
      });
      await refresh();
      setOpen(false);
    } catch (createError) {
      setFormError(getApiErrorMessage(createError));
    } finally {
      setFormSaving(false);
    }
  }

  return (
    <>
      <ContactListView
        rows={rows}
        filters={{ q, status, primary }}
        isLoading={contacts.isPending}
        error={error}
        actionError={actionError}
        pageSummary={pageSummary}
        hasNextPage={contacts.data?.pageInfo.hasNextPage ?? false}
        hasPreviousPage={cursors.length > 1}
        promotingId={promote.isPending ? promote.variables : null}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onQueryChange={(value) => reset(setQ, value)}
        onStatusChange={(value) => reset(setStatus, value)}
        onPrimaryChange={(value) => reset(setPrimary, value)}
        onClearFilters={clearFilters}
        onNext={() => {
          const next = contacts.data?.pageInfo.nextCursor;
          if (next) {
            setCursors((current) => [...current, next]);
          }
        }}
        onPrevious={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
        onAdd={() => setOpen(true)}
        onSetPrimary={(contact) => promote.mutate(contact.id)}
        onRemove={(contact) => {
          setDeleteError(null);
          setPendingDelete({ id: contact.id, label: contact.displayName });
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove contact?"
        description={
          <div className="flex flex-col gap-2">
            <p>
              Soft-delete <span className="font-medium text-slate-900">{pendingDelete?.label}</span>? You can restore it later with the right permission.
            </p>
            {deleteError ? <p role="alert" className="text-rose-700">{deleteError}</p> : null}
          </div>
        }
        confirmLabel="Remove contact"
        busy={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) {
            return;
          }
          setDeleteError(null);
          remove.mutate(pendingDelete.id, {
            onError: (mutationError) => setDeleteError(getApiErrorMessage(mutationError)),
          });
        }}
      />

      <Modal
        open={open}
        title="New contact"
        onClose={() => {
          setOpen(false);
          setFormError(null);
        }}
      >
        <form className="flex flex-col gap-4" onSubmit={createContactFromForm}>
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-600">
            Add a person to a customer account. Primary contacts become the default point of contact for that customer.
          </p>
          <FormField label="Customer" htmlFor="customerId">
            <select id="customerId" name="customerId" required className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
              <option value="">{customers.isPending ? "Loading customers…" : "Select customer"}</option>
              {(customers.data?.items ?? []).map((customer: CustomerSummary) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName} ({customer.customerNumber})
                </option>
              ))}
            </select>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name" htmlFor="firstName">
              <Input id="firstName" name="firstName" required maxLength={100} />
            </FormField>
            <FormField label="Last name" htmlFor="lastName">
              <Input id="lastName" name="lastName" required maxLength={100} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Job title" htmlFor="jobTitle">
              <Input id="jobTitle" name="jobTitle" maxLength={120} />
            </FormField>
            <FormField label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" maxLength={320} />
            </FormField>
          </div>
          <FormField label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" maxLength={40} />
          </FormField>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" name="isPrimary" className="h-4 w-4 accent-brand-800" />
            Primary contact for this customer
          </label>
          {formError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">{formError}</p> : null}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" className="h-10 px-4" onClick={() => { setOpen(false); setFormError(null); }}>Cancel</Button>
            <Button type="submit" disabled={formSaving} className="h-10 bg-brand-800 px-5 font-semibold hover:bg-brand-900">
              {formSaving ? "Creating…" : "Create contact"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

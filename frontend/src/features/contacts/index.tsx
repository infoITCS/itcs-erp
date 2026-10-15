import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/tables/DataTable.tsx";
import { FormField } from "@/components/forms/FormField.tsx";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { listCustomers, type CustomerSummary } from "@/features/customers/api.ts";
import { createContact, deleteContact, listOrgContacts, updateContact, type ContactRow } from "./api.ts";

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [primary, setPrimary] = useState("");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
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
    onSuccess: () => refresh(),
  });

  const rows = contacts.data?.items ?? [];
  const activeCount = rows.filter((row) => row.status === "ACTIVE").length;
  const inactiveCount = rows.filter((row) => row.status === "INACTIVE").length;
  const primaryCount = rows.filter((row) => row.isPrimary).length;

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col items-start justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-teal-800">
            <span className="h-2 w-2 rounded-full bg-teal-600" />
            CRM / Directory
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">Contacts</h1>
          <p className="mt-1 text-sm text-slate-600">People linked to your customers. Primary contacts are marked clearly.</p>
        </div>
        <Button className="h-10 bg-teal-800 px-4 hover:bg-teal-900" onClick={() => setOpen(true)}>
          Add New Contact
        </Button>
      </header>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 sm:grid-cols-4 sm:divide-y-0">
        <SummaryItem label="Visible" value={rows.length.toString()} tone="slate" />
        <SummaryItem label="Active" value={activeCount.toString()} tone="teal" />
        <SummaryItem label="Primary" value={primaryCount.toString()} tone="teal" />
        <SummaryItem label="Inactive" value={inactiveCount.toString()} tone="amber" />
      </div>

      <section aria-label="Contact filters" className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Input
            className="h-10"
            value={q}
            placeholder="Search name, email, phone, or customer"
            onChange={(event) => reset(setQ, event.target.value)}
          />
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={status}
            onChange={(event) => reset(setStatus, event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={primary}
            onChange={(event) => reset(setPrimary, event.target.value)}
          >
            <option value="">All contacts</option>
            <option value="true">Primary only</option>
            <option value="false">Non-primary</option>
          </select>
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900">Contact directory</h2>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">{rows.length}</span>
        </div>
        <div className="p-1">
          <DataTable
            columns={[
              {
                id: "name",
                header: "Name",
                cell: (row: ContactRow) => (
                  <Link className="font-semibold text-slate-950 underline-offset-4 hover:text-teal-800 hover:underline" to={`/customers/${row.customerId}`}>
                    {row.displayName}
                    {row.isPrimary ? " · Primary" : ""}
                  </Link>
                ),
              },
              {
                id: "customer",
                header: "Customer",
                cell: (row: ContactRow) => (
                  <Link className="text-slate-700 underline-offset-4 hover:underline" to={`/customers/${row.customerId}`}>
                    {row.customer.displayName}
                  </Link>
                ),
              },
              { id: "job", header: "Title", cell: (row: ContactRow) => row.jobTitle ?? "—" },
              { id: "email", header: "Email", cell: (row: ContactRow) => row.email ?? "—" },
              { id: "phone", header: "Phone", cell: (row: ContactRow) => row.phone ?? row.mobile ?? "—" },
              { id: "status", header: "Status", cell: (row: ContactRow) => row.status },
              {
                id: "actions",
                header: "",
                cell: (row: ContactRow) => (
                  <div className="flex justify-end gap-3">
                    {row.isPrimary ? null : (
                      <button
                        type="button"
                        className="text-sm text-slate-700"
                        onClick={() => updateContact(row.id, { isPrimary: true }).then(refresh)}
                      >
                        Make primary
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-sm text-red-700"
                      onClick={() => setPendingDelete({ id: row.id, label: row.displayName })}
                    >
                      Remove
                    </button>
                  </div>
                ),
              },
            ]}
            rows={rows}
            getRowId={(row) => row.id}
            isLoading={contacts.isPending}
            error={contacts.isError ? getApiErrorMessage(contacts.error) : null}
            emptyMessage="No contacts match these filters. Add people from here or from a customer record."
            hasNextPage={contacts.data?.pageInfo.hasNextPage ?? false}
            hasPreviousPage={cursors.length > 1}
            onNext={() => {
              const next = contacts.data?.pageInfo.nextCursor;
              if (next) {
                setCursors((current) => [...current, next]);
              }
            }}
            onPrevious={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
          />
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove contact?"
        description={
          <p>
            Soft-delete <span className="font-medium text-slate-900">{pendingDelete?.label}</span>? You can restore it later
            with the right permission.
          </p>
        }
        confirmLabel="Remove contact"
        busy={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) {
            return;
          }
          remove.mutate(pendingDelete.id, {
            onSuccess: () => setPendingDelete(null),
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
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const customerId = String(form.get("customerId") ?? "");
            if (!customerId) {
              setFormError("Choose a customer");
              return;
            }
            setFormError(null);
            try {
              await createContact(customerId, {
                firstName: String(form.get("firstName") ?? ""),
                lastName: String(form.get("lastName") ?? ""),
                email: String(form.get("email") ?? "") || undefined,
                phone: String(form.get("phone") ?? "") || undefined,
                jobTitle: String(form.get("jobTitle") ?? "") || undefined,
                isPrimary: form.get("isPrimary") === "on",
              });
              await refresh();
              setOpen(false);
            } catch (error) {
              setFormError(getApiErrorMessage(error));
            }
          }}
        >
          <FormField label="Customer" htmlFor="customerId">
            <select id="customerId" name="customerId" required className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm">
              <option value="">{customers.isPending ? "Loading customers…" : "Select customer"}</option>
              {(customers.data?.items ?? []).map((customer: CustomerSummary) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName} ({customer.customerNumber})
                </option>
              ))}
            </select>
          </FormField>
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
            Primary contact for this customer
          </label>
          {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
          <Button type="submit">Create contact</Button>
        </form>
      </Modal>
    </section>
  );

  function reset(setter: (value: string) => void, value: string) {
    setter(value);
    setCursors([undefined]);
  }
}

function SummaryItem({ label, value, tone }: { label: string; value: string; tone: "slate" | "teal" | "amber" }) {
  const valueColor = tone === "teal" ? "text-teal-800" : tone === "amber" ? "text-amber-800" : "text-slate-950";
  return (
    <div className="flex min-h-[76px] flex-col justify-center px-4 py-3 first:pl-0 sm:pl-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}

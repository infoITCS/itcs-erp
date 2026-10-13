import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { deleteCustomer, listCustomers, permanentlyDeleteCustomer, restoreCustomer } from "./api.ts";
import { CustomerListView, type CustomerListRow } from "./customer-list-view.tsx";

const PAGE_SIZE = 50;

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [pendingDelete, setPendingDelete] = useState<CustomerListRow | null>(null);
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState<CustomerListRow | null>(null);
  const [permanentDeleteConfirmation, setPermanentDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);
  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    customerType: customerType || undefined,
    includeDeleted: includeDeleted ? "true" : undefined,
    cursor,
    limit: PAGE_SIZE,
  };
  const customers = useQuery({
    queryKey: queryKeys.list("customers", params),
    queryFn: () => listCustomers(params),
  });
  const restore = useMutation({
    mutationFn: restoreCustomer,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["customers", "list"] }),
  });
  const remove = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers", "list"] });
      setPendingDelete(null);
    },
  });
  const permanentlyRemove = useMutation({
    mutationFn: permanentlyDeleteCustomer,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["customers", "list"] }),
  });

  const rows = customers.data?.items ?? [];
  const hasNextPage = customers.data?.pageInfo.hasNextPage ?? false;
  const hasPreviousPage = cursors.length > 1;
  const error = customers.isError ? getApiErrorMessage(customers.error) : null;
  const actionError = restore.isError
    ? getApiErrorMessage(restore.error)
    : permanentlyRemove.isError
      ? getApiErrorMessage(permanentlyRemove.error)
      : deleteError;
  const pageSummary = `${rows.length} customer${rows.length === 1 ? "" : "s"} on page ${cursors.length}`;

  function resetPage() {
    setCursors([undefined]);
  }

  function nextPage() {
    const next = customers.data?.pageInfo.nextCursor;
    if (next) {
      setCursors((current) => [...current, next]);
    }
  }

  function previousPage() {
    setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }

  function restoreRow(customerId: string) {
    restore.mutate(customerId);
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    setDeleteError(null);
    remove.mutate(pendingDelete.id, {
      onError: (mutationError) => setDeleteError(getApiErrorMessage(mutationError)),
    });
  }

  function confirmPermanentDelete() {
    if (!pendingPermanentDelete || permanentDeleteConfirmation !== pendingPermanentDelete.customerNumber) {
      return;
    }
    permanentlyRemove.mutate(pendingPermanentDelete.id, {
      onSuccess: () => {
        setPendingPermanentDelete(null);
        setPermanentDeleteConfirmation("");
      },
    });
  }

  return (
    <>
      <CustomerListView
        rows={rows}
        filters={{ q, status, customerType, includeDeleted }}
        isLoading={customers.isPending}
        error={error}
        actionError={actionError}
        pageSummary={pageSummary}
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPreviousPage}
        restoringId={restore.isPending ? restore.variables : null}
        permanentlyDeletingId={permanentlyRemove.isPending ? permanentlyRemove.variables : null}
        onQueryChange={(value) => {
          setQ(value);
          resetPage();
        }}
        onStatusChange={(value) => {
          setStatus(value);
          resetPage();
        }}
        onCustomerTypeChange={(value) => {
          setCustomerType(value);
          resetPage();
        }}
        onIncludeDeletedChange={(value) => {
          setIncludeDeleted(value);
          resetPage();
        }}
        onNext={nextPage}
        onPrevious={previousPage}
        onDelete={(customer) => {
          setDeleteError(null);
          setPendingDelete(customer);
        }}
        onRestore={restoreRow}
        onPermanentDelete={(customer) => {
          setPermanentDeleteConfirmation("");
          setPendingPermanentDelete(customer);
        }}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete customer?"
        description={
          <div className="flex flex-col gap-2">
            <p>
              Soft-delete <span className="font-medium text-slate-900">{pendingDelete?.displayName}</span>? You can restore the record later.
            </p>
            {deleteError ? <p role="alert" className="text-red-700">{deleteError}</p> : null}
          </div>
        }
        confirmLabel="Delete customer"
        busy={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
      <Modal
        open={pendingPermanentDelete !== null}
        title="Permanently delete customer?"
        onClose={() => {
          if (!permanentlyRemove.isPending) {
            setPendingPermanentDelete(null);
            setPermanentDeleteConfirmation("");
          }
        }}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-6 text-slate-600">
            This cannot be undone. Related addresses, contacts, notes, activities and tickets will also be permanently removed. Customers with stored documents must have those documents removed first.
          </p>
          <label htmlFor="permanent-delete-confirmation" className="text-sm text-slate-700">
            Type <span className="font-semibold text-slate-950">{pendingPermanentDelete?.customerNumber}</span> to confirm.
          </label>
          <Input
            id="permanent-delete-confirmation"
            value={permanentDeleteConfirmation}
            onChange={(event) => setPermanentDeleteConfirmation(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={permanentlyRemove.isPending} onClick={() => {
              setPendingPermanentDelete(null);
              setPermanentDeleteConfirmation("");
            }}>Cancel</Button>
            <Button
              disabled={permanentDeleteConfirmation !== pendingPermanentDelete?.customerNumber || permanentlyRemove.isPending}
              onClick={confirmPermanentDelete}
              className="bg-red-700 hover:bg-red-800 disabled:bg-slate-400"
            >
              {permanentlyRemove.isPending ? "Deleting…" : "Permanently delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

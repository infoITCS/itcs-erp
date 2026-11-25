import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { getTenderFormOptions, listTenders, deleteTender, restoreTender, type Tender, type TenderStatus } from "./api.ts";
import { TenderListView, type TenderListFilters } from "./tender-list-view.tsx";

const PAGE_SIZE = 50;

const initialFilters: TenderListFilters = {
  q: "",
  status: "",
  customerId: "",
  ownerUserId: "",
  from: "",
  to: "",
  sort: "createdAt",
  order: "desc",
  includeDeleted: false,
};

export default function TendersPage() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("tenders:create");
  const canEdit = useHasPermission("tenders:update");
  const canRestore = useHasPermission("tenders:restore");
  const canDelete = useHasPermission("tenders:delete");
  const canIncludeDeleted = canDelete || canRestore;

  const [filters, setFilters] = useState<TenderListFilters>(initialFilters);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [pendingDelete, setPendingDelete] = useState<Tender | null>(null);
  const debouncedQ = useDebouncedValue(filters.q, 300);
  const cursor = cursors.at(-1);

  const params = {
    q: debouncedQ || undefined,
    status: (filters.status || undefined) as TenderStatus | undefined,
    customerId: filters.customerId || undefined,
    ownerUserId: filters.ownerUserId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    includeDeleted: canIncludeDeleted && filters.includeDeleted ? "true" : undefined,
    cursor,
    limit: PAGE_SIZE,
    sort: filters.sort,
    order: filters.order,
  };

  const tenders = useQuery({
    queryKey: queryKeys.list("tenders", params),
    queryFn: () => listTenders(params),
  });
  const formOptions = useQuery({
    queryKey: ["tenders", "form-options"],
    queryFn: getTenderFormOptions,
    staleTime: 5 * 60_000,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTender(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tenders"] });
      setPendingDelete(null);
    },
  });
  const restore = useMutation({
    mutationFn: (id: string) => restoreTender(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tenders"] });
    },
  });

  const rows = tenders.data?.items ?? [];
  const error = tenders.isError ? getApiErrorMessage(tenders.error) : null;
  const actionError = remove.isError
    ? getApiErrorMessage(remove.error)
    : restore.isError
      ? getApiErrorMessage(restore.error)
      : null;
  const pageSummary = `${rows.length} tender${rows.length === 1 ? "" : "s"} on page ${cursors.length}`;

  function resetPage() {
    setCursors([undefined]);
  }

  function updateFilter<K extends keyof TenderListFilters>(key: K, value: TenderListFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    resetPage();
  }

  function clearFilters() {
    setFilters(initialFilters);
    resetPage();
  }

  function nextPage() {
    const next = tenders.data?.pageInfo.nextCursor;
    if (next) {
      setCursors((current) => [...current, next]);
    }
  }

  function previousPage() {
    setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }

  return (
    <>
      <TenderListView
        rows={rows}
        filters={filters}
        customers={formOptions.data?.customers ?? []}
        owners={formOptions.data?.owners ?? []}
        isLoading={tenders.isPending}
        error={error}
        actionError={actionError}
        pageSummary={pageSummary}
        hasNextPage={tenders.data?.pageInfo.hasNextPage ?? false}
        hasPreviousPage={cursors.length > 1}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        canRestore={canRestore}
        deletingId={remove.isPending ? remove.variables ?? null : null}
        restoringId={restore.isPending ? restore.variables ?? null : null}
        onQueryChange={(value) => updateFilter("q", value)}
        onStatusChange={(value) => updateFilter("status", value)}
        onCustomerChange={(value) => updateFilter("customerId", value)}
        onOwnerChange={(value) => updateFilter("ownerUserId", value)}
        onFromChange={(value) => updateFilter("from", value)}
        onToChange={(value) => updateFilter("to", value)}
        onSortChange={(value) => updateFilter("sort", value)}
        onOrderChange={(value) => updateFilter("order", value)}
        onIncludeDeletedChange={(value) => updateFilter("includeDeleted", value)}
        onClearFilters={clearFilters}
        onNext={nextPage}
        onPrevious={previousPage}
        onDelete={setPendingDelete}
        onRestore={(row) => restore.mutate(row.id)}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete tender?"
        description={
          <p>
            Soft-delete <span className="font-medium text-slate-900">{pendingDelete?.title}</span>? You can restore it later with the right permission.
          </p>
        }
        confirmLabel="Delete tender"
        danger
        busy={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            remove.mutate(pendingDelete.id);
          }
        }}
      />
    </>
  );
}

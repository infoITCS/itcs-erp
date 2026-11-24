import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { deleteReseller, listResellers, restoreReseller, type ResellerStatus, type ResellerSummary } from "./api.ts";
import { ResellerListView, type ResellerListFilters } from "./reseller-list-view.tsx";

export default function ResellersPage() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("resellers:create");
  const canUpdate = useHasPermission("resellers:update");
  const canDelete = useHasPermission("resellers:delete");
  const canRestore = useHasPermission("resellers:restore");
  const canReviewDeleted = canDelete || canRestore;

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | ResellerStatus>("");
  const [country, setCountry] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<ResellerListFilters["sort"]>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [deleting, setDeleting] = useState<ResellerSummary | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);
  const effectiveIncludeDeleted = canReviewDeleted && includeDeleted;
  const filters: ResellerListFilters = { q: debouncedQ, status, country, from, to, sort, order, includeDeleted: effectiveIncludeDeleted };
  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    country: country.length === 2 ? country : undefined,
    from: from || undefined,
    to: to || undefined,
    sort,
    order,
    includeDeleted: effectiveIncludeDeleted || undefined,
    cursor,
    limit: 50,
  };
  const resellers = useQuery({
    queryKey: queryKeys.list("resellers", params),
    queryFn: () => listResellers(params),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteReseller(id),
    onSuccess: async () => {
      await invalidateResellers(queryClient);
      setDeleting(null);
      setActionError(null);
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });
  const restore = useMutation({
    mutationFn: (id: string) => restoreReseller(id),
    onSuccess: async () => {
      await invalidateResellers(queryClient);
      setActionError(null);
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
    onSettled: () => setRestoringId(null),
  });

  const rows = resellers.data?.items ?? [];
  const hasNextPage = resellers.data?.pageInfo.hasNextPage ?? false;
  const hasPreviousPage = cursors.length > 1;
  const error = resellers.isError ? getApiErrorMessage(resellers.error) : null;
  const pageSummary = `${rows.length} reseller${rows.length === 1 ? "" : "s"} on page ${cursors.length}${effectiveIncludeDeleted ? " · including deleted" : ""}`;

  function resetPage() {
    setCursors([undefined]);
  }

  function clearFilters() {
    setQ("");
    setStatus("");
    setCountry("");
    setFrom("");
    setTo("");
    setSort("createdAt");
    setOrder("desc");
    setIncludeDeleted(false);
    resetPage();
  }

  return (
    <>
      <ResellerListView
        rows={rows}
        filters={filters}
        isLoading={resellers.isPending}
        error={error}
        actionError={actionError}
        pageSummary={pageSummary}
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPreviousPage}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
        canRestore={canRestore}
        deletingId={remove.isPending ? deleting?.id ?? null : null}
        restoringId={restore.isPending ? restoringId : null}
        onQueryChange={(value) => { setQ(value); resetPage(); }}
        onStatusChange={(value) => { setStatus(value); resetPage(); }}
        onCountryChange={(value) => { setCountry(value); resetPage(); }}
        onFromChange={(value) => { setFrom(value); resetPage(); }}
        onToChange={(value) => { setTo(value); resetPage(); }}
        onSortChange={(value) => { setSort(value); resetPage(); }}
        onOrderChange={(value) => { setOrder(value); resetPage(); }}
        onIncludeDeletedChange={(value) => { setIncludeDeleted(value); resetPage(); }}
        onClearFilters={clearFilters}
        onPrevious={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
        onNext={() => {
          const next = resellers.data?.pageInfo.nextCursor;
          if (next) {
            setCursors((current) => [...current, next]);
          }
        }}
        onDelete={(row) => { setActionError(null); setDeleting(row); }}
        onRestore={(row) => { setActionError(null); setRestoringId(row.id); restore.mutate(row.id); }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete reseller?"
        description={
          deleting ? (
            <p>
              Soft-delete <span className="font-medium text-slate-900">{deleting.displayName}</span>? You can restore it later
              with the right permission.
            </p>
          ) : null
        }
        confirmLabel="Delete reseller"
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            remove.mutate(deleting.id);
          }
        }}
      />
    </>
  );
}

async function invalidateResellers(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["resellers"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["analytics"] }),
    queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
  ]);
}

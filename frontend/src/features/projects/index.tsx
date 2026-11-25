import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  deleteProject,
  getProjectFormOptions,
  listProjects,
  type Project,
  type ProjectStatus,
} from "./api.ts";
import { ProjectListView, type ProjectListFilters } from "./project-list-view.tsx";

const PAGE_SIZE = 50;

const initialFilters: ProjectListFilters = {
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

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("projects:create");
  const canEdit = useHasPermission("projects:update");
  const canDelete = useHasPermission("projects:delete");

  const [filters, setFilters] = useState<ProjectListFilters>(initialFilters);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const debouncedQ = useDebouncedValue(filters.q, 300);
  const cursor = cursors.at(-1);

  const params = {
    q: debouncedQ || undefined,
    status: (filters.status || undefined) as ProjectStatus | undefined,
    customerId: filters.customerId || undefined,
    ownerUserId: filters.ownerUserId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    includeDeleted: canDelete && filters.includeDeleted ? "true" : undefined,
    cursor,
    limit: PAGE_SIZE,
    sort: filters.sort,
    order: filters.order,
  };

  const projects = useQuery({
    queryKey: queryKeys.list("projects", params),
    queryFn: () => listProjects(params),
  });
  const formOptions = useQuery({
    queryKey: ["projects", "form-options"],
    queryFn: getProjectFormOptions,
    staleTime: 5 * 60_000,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setPendingDelete(null);
    },
  });

  const rows = projects.data?.items ?? [];
  const error = projects.isError ? getApiErrorMessage(projects.error) : null;
  const actionError = remove.isError ? getApiErrorMessage(remove.error) : null;
  const pageSummary = `${rows.length} project${rows.length === 1 ? "" : "s"} on page ${cursors.length}`;

  function resetPage() {
    setCursors([undefined]);
  }

  function updateFilter<K extends keyof ProjectListFilters>(key: K, value: ProjectListFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    resetPage();
  }

  function clearFilters() {
    setFilters(initialFilters);
    resetPage();
  }

  return (
    <>
      <ProjectListView
        rows={rows}
        filters={filters}
        customers={formOptions.data?.customers ?? []}
        owners={formOptions.data?.owners ?? []}
        isLoading={projects.isPending}
        error={error}
        actionError={actionError}
        pageSummary={pageSummary}
        hasNextPage={projects.data?.pageInfo.hasNextPage ?? false}
        hasPreviousPage={cursors.length > 1}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        deletingId={remove.isPending ? remove.variables ?? null : null}
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
        onNext={() => {
          const next = projects.data?.pageInfo.nextCursor;
          if (next) setCursors((current) => [...current, next]);
        }}
        onPrevious={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
        onDelete={setPendingDelete}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete project?"
        description={<p>Soft-delete <span className="font-medium text-slate-900">{pendingDelete?.name}</span>?</p>}
        confirmLabel="Delete project"
        danger
        busy={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id);
        }}
      />
    </>
  );
}

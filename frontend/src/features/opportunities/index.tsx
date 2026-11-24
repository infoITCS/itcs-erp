import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useHasPermission, useSessionUser } from "@/hooks/useSession.ts";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  OPEN_STAGES,
  changeOpportunityStage,
  getOpportunityFormOptions,
  getOpportunityPipelineSummary,
  listOpportunities,
  markOpportunityLost,
  markOpportunityWon,
  reopenOpportunity,
  restoreOpportunity,
  type Opportunity,
  type OpportunityListParams,
  type OpportunityLostReason,
  type OpportunityStage,
} from "./api.ts";
import {
  OpportunityWorkspace,
  type OpportunityFilters,
  type OpportunityView,
} from "./opportunity-workspace.tsx";

export { stageLabel } from "./api.ts";

const PAGE_SIZE = 100;

const initialFilters: OpportunityFilters = {
  q: "",
  stage: "",
  ownerUserId: "",
  leadSource: "",
  sort: "createdAt",
  order: "desc",
  includeDeleted: false,
  onlyMine: false,
};

export default function OpportunitiesPage() {
  const queryClient = useQueryClient();
  const user = useSessionUser();
  const canCreate = useHasPermission("opportunities:create");
  const canUpdate = useHasPermission("opportunities:update");
  const canDelete = useHasPermission("opportunities:delete");
  const canRestore = useHasPermission("opportunities:restore");

  const [view, setView] = useState<OpportunityView>("pipeline");
  const [filters, setFilters] = useState<OpportunityFilters>(initialFilters);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const debouncedQ = useDebouncedValue(filters.q, 300);
  const cursor = cursors.at(-1);

  const params: OpportunityListParams = {
    q: debouncedQ || undefined,
    stage: (filters.stage || undefined) as OpportunityStage | undefined,
    ownerUserId: filters.onlyMine && user ? user.id : filters.ownerUserId || undefined,
    leadSource: (filters.leadSource || undefined) as OpportunityListParams["leadSource"],
    sort: filters.sort,
    order: filters.order,
    includeDeleted: (canDelete || canRestore) && filters.includeDeleted ? true : undefined,
    cursor,
    limit: PAGE_SIZE,
  };

  const summaryParams: OpportunityListParams = {
    q: params.q,
    stage: params.stage,
    ownerUserId: params.ownerUserId,
    leadSource: params.leadSource,
    includeDeleted: params.includeDeleted,
  };

  const opportunities = useQuery({
    queryKey: queryKeys.list("opportunities", params as unknown as Record<string, unknown>),
    queryFn: () => listOpportunities(params),
  });
  const summary = useQuery({
    queryKey: queryKeys.list("opportunities", {
      type: "pipeline-summary",
      ...summaryParams,
    } as unknown as Record<string, unknown>),
    queryFn: () => getOpportunityPipelineSummary(summaryParams),
  });
  const formOptions = useQuery({
    queryKey: ["opportunities", "form-options"],
    queryFn: getOpportunityFormOptions,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      queryClient.invalidateQueries({ queryKey: ["leads"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
    ]);
  };

  const stageChange = useMutation({
    mutationFn: ({ row, stage }: { row: Opportunity; stage: OpportunityStage }) =>
      changeOpportunityStage(row.id, { stage, applyStageDefault: true }),
    onSuccess: refresh,
  });
  const won = useMutation({
    mutationFn: (row: Opportunity) => markOpportunityWon(row.id, { applyStageDefault: true }),
    onSuccess: refresh,
  });
  const lost = useMutation({
    mutationFn: ({ row, reason }: { row: Opportunity; reason: OpportunityLostReason }) =>
      markOpportunityLost(row.id, { lostReason: reason, applyStageDefault: true }),
    onSuccess: refresh,
  });
  const reopen = useMutation({
    mutationFn: (row: Opportunity) => reopenOpportunity(row.id, { applyStageDefault: true }),
    onSuccess: refresh,
  });
  const restore = useMutation({
    mutationFn: (row: Opportunity) => restoreOpportunity(row.id),
    onSuccess: refresh,
  });

  const actionError = [stageChange, won, lost, reopen, restore].find((mutation) => mutation.isError);
  const rows = opportunities.data?.items ?? [];
  const pageSummary = `${rows.length} opportunit${rows.length === 1 ? "y" : "ies"} · page ${cursors.length}`;

  function resetPage() {
    setCursors([undefined]);
  }

  function updateFilter<K extends keyof OpportunityFilters>(key: K, value: OpportunityFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    resetPage();
  }

  function clearFilters() {
    setFilters(initialFilters);
    resetPage();
  }

  function nextPage() {
    const next = opportunities.data?.pageInfo.nextCursor;
    if (next) setCursors((current) => [...current, next]);
  }

  function previousPage() {
    setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }

  return (
    <OpportunityWorkspace
      rows={rows}
      summary={summary.data ?? null}
      filters={filters}
      owners={formOptions.data?.owners ?? []}
      currentUserId={user?.id ?? ""}
      view={view}
      loading={opportunities.isPending || summary.isPending}
      error={
        opportunities.isError
          ? getApiErrorMessage(opportunities.error)
          : summary.isError
            ? getApiErrorMessage(summary.error)
            : null
      }
      actionError={actionError?.isError ? getApiErrorMessage(actionError.error) : null}
      pageSummary={pageSummary}
      hasNextPage={opportunities.data?.pageInfo.hasNextPage ?? false}
      hasPreviousPage={cursors.length > 1}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canRestore={canRestore}
      onViewChange={setView}
      onFilterChange={updateFilter}
      onClearFilters={clearFilters}
      onStageChange={(row, stage) => {
        if ((OPEN_STAGES as string[]).includes(stage) && stage !== row.stage) {
          stageChange.mutate({ row, stage });
        }
      }}
      onMarkWon={(row) => won.mutate(row)}
      onMarkLost={(row, reason) => lost.mutate({ row, reason })}
      onReopen={(row) => reopen.mutate(row)}
      onRestore={(row) => restore.mutate(row)}
      onNextPage={nextPage}
      onPreviousPage={previousPage}
    />
  );
}

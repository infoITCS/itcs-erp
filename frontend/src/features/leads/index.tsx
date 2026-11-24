import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { useHasPermission, useSessionUser } from "@/hooks/useSession.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  changeLeadStatus,
  getLeadFormOptions,
  listLeads,
  restoreLead,
} from "./api.ts";
import { LeadsAnalytics } from "./analytics.tsx";
import { LeadListView, LeadTabs, type LeadFilters } from "./lead-list-view.tsx";

const PAGE_SIZE = 50;

export default function LeadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useSessionUser();
  const canCreate = useHasPermission("leads:create");
  const canUpdate = useHasPermission("leads:update");
  const canDelete = useHasPermission("leads:delete");
  const canRestore = useHasPermission("leads:restore");
  const canSeeDeleted = canDelete || canRestore;
  const [tab, setTab] = useState<"pipeline" | "analytics">("pipeline");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);
  const effectiveOwner = onlyMine && user ? user.id : ownerUserId;

  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    source: source || undefined,
    ownerUserId: effectiveOwner || undefined,
    priority: priority || undefined,
    sort,
    order,
    includeDeleted: includeDeleted && canSeeDeleted ? "true" : undefined,
    cursor,
    limit: PAGE_SIZE,
  };

  const leads = useQuery({
    queryKey: queryKeys.list("leads", params),
    queryFn: () => listLeads(params),
    enabled: tab === "pipeline",
  });
  const formOptions = useQuery({ queryKey: ["leads", "form-options"], queryFn: getLeadFormOptions });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["leads"] });
  };

  const restore = useMutation({
    mutationFn: (id: string) => restoreLead(id),
    onSuccess: async () => refresh(),
  });
  const contact = useMutation({
    mutationFn: (id: string) => changeLeadStatus(id, { status: "CONTACTED" }),
    onSuccess: async () => refresh(),
  });

  const rows = leads.data?.items ?? [];
  const error = leads.isError ? getApiErrorMessage(leads.error) : null;
  const actionError = restore.isError
    ? getApiErrorMessage(restore.error)
    : contact.isError
      ? getApiErrorMessage(contact.error)
      : null;
  const filters: LeadFilters = {
    q,
    status,
    source,
    ownerUserId: effectiveOwner,
    priority,
    sort,
    order,
    includeDeleted,
    onlyMine,
  };

  function resetPage() {
    setCursors([undefined]);
  }

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    if (onlyMine && setter !== setOwnerUserId) {
      setOnlyMine(false);
    }
    resetPage();
  }

  function clearFilters() {
    setQ("");
    setStatus("");
    setSource("");
    setOwnerUserId("");
    setPriority("");
    setIncludeDeleted(false);
    setOnlyMine(false);
    setSort("createdAt");
    setOrder("desc");
    resetPage();
  }

  function toggleMine() {
    setOnlyMine((current) => !current);
    if (!onlyMine) {
      setOwnerUserId("");
    }
    resetPage();
  }

  return (
    <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <LeadTabs active={tab} onChange={setTab} />

      {tab === "analytics" ? <LeadsAnalytics /> : null}

      {tab === "pipeline" ? (
        <LeadListView
          rows={rows}
          filters={filters}
          owners={formOptions.data?.owners ?? []}
          sources={formOptions.data?.sources ?? []}
          priorities={formOptions.data?.priorities ?? []}
          statuses={formOptions.data?.statuses ?? []}
          currentUserId={user?.id ?? ""}
          isLoading={leads.isPending}
          error={error}
          actionError={actionError}
          pageSummary={`Page ${cursors.length} · ${rows.length} lead${rows.length === 1 ? "" : "s"} shown`}
          hasNextPage={leads.data?.pageInfo.hasNextPage ?? false}
          hasPreviousPage={cursors.length > 1}
          restoringId={restore.isPending ? restore.variables : null}
          contactingId={contact.isPending ? contact.variables : null}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
          canRestore={canRestore}
          onQueryChange={(value) => updateFilter(setQ, value)}
          onStatusChange={(value) => updateFilter(setStatus, value)}
          onSourceChange={(value) => updateFilter(setSource, value)}
          onOwnerChange={(value) => {
            setOnlyMine(false);
            updateFilter(setOwnerUserId, value);
          }}
          onPriorityChange={(value) => updateFilter(setPriority, value)}
          onSortChange={(value) => {
            setSort(value);
            resetPage();
          }}
          onOrderChange={(value) => {
            setOrder(value);
            resetPage();
          }}
          onIncludeDeletedChange={(value) => {
            setIncludeDeleted(value);
            resetPage();
          }}
          onToggleMine={toggleMine}
          onClearFilters={clearFilters}
          onNext={() => {
            const next = leads.data?.pageInfo.nextCursor;
            if (next) {
              setCursors((current) => [...current, next]);
            }
          }}
          onPrevious={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
          onAdd={() => navigate("/leads/new")}
          onMarkContacted={(lead) => contact.mutate(lead.id)}
          onRestore={(lead) => restore.mutate(lead.id)}
        />
      ) : null}
    </section>
  );
}

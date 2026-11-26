import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  deleteTender,
  getTender,
  listTenderAudit,
  restoreTender,
  updateTender,
  type TenderOpportunityRef,
  type TenderStatus,
} from "./api.ts";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  isDeadlineOverdue,
  statusLabel,
  tenderActionLabel,
  TenderStatusBadge,
} from "./shared.tsx";
import {
  TENDER_STAGES,
  TENDER_STATUS_HELP,
  isTerminalTenderStatus,
  nextTenderStatuses,
  tenderStageIndex,
} from "./workflow.ts";

type Tab = "overview" | "workflow" | "activity";

export default function TenderDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = useHasPermission("tenders:update");
  const canDelete = useHasPermission("tenders:delete");
  const canRestore = useHasPermission("tenders:restore");
  const [tab, setTab] = useState<Tab>("overview");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TenderStatus | null>(null);

  const tender = useQuery({ queryKey: ["tenders", id], queryFn: () => getTender(id) });
  const audit = useQuery({
    queryKey: ["tenders", id, "audit"],
    queryFn: () => listTenderAudit(id),
    enabled: tab === "activity",
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["tenders"] });
  };

  const remove = useMutation({
    mutationFn: () => deleteTender(id),
    onSuccess: async () => {
      await refresh();
      navigate("/tenders");
    },
  });
  const restore = useMutation({
    mutationFn: () => restoreTender(id),
    onSuccess: refresh,
  });
  const changeStatus = useMutation({
    mutationFn: (status: TenderStatus) => updateTender(id, { status }),
    onSuccess: async () => {
      await refresh();
      setPendingStatus(null);
    },
  });

  const data = tender.data;
  const overdue = data ? isDeadlineOverdue(data.submissionDeadline, data.status) : false;
  const stage = data ? TENDER_STAGES[tenderStageIndex(data.status)] : undefined;
  const actionError = remove.isError
    ? getApiErrorMessage(remove.error)
    : restore.isError
      ? getApiErrorMessage(restore.error)
      : changeStatus.isError
        ? getApiErrorMessage(changeStatus.error)
        : null;

  return (
    <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      {tender.isPending ? (
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}</div>
        </div>
      ) : null}
      {tender.isError ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{getApiErrorMessage(tender.error)}</p>
      ) : null}

      {data ? (
        <>
          <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-sky-400" />
            <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 sm:flex">
                  <Icon name="file" className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> CRM / Bid management
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="font-mono text-xs text-slate-500">{data.tenderNumber}</p>
                    <TenderStatusBadge status={data.status} deleted={Boolean(data.deletedAt)} />
                    {stage ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{stage.label} stage</span> : null}
                    {data.opportunity ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                        <Icon name="check" className="h-3 w-3" /> Opportunity created
                      </span>
                    ) : null}
                    {overdue ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">Overdue</span> : null}
                  </div>
                  <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{data.title}</h1>
                  <p className="mt-1.5 text-sm text-slate-600">
                    {data.customer?.displayName ?? "No customer"} · {formatMoney(data.estimatedValue, data.currencyCode)}
                    {data.referenceNumber ? ` · Ref ${data.referenceNumber}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
                {data.deletedAt ? (
                  canRestore ? (
                    <Button variant="secondary" className="h-11 w-full rounded-xl sm:w-auto" disabled={restore.isPending} onClick={() => restore.mutate()}>
                      <Icon name="restore" className="h-4 w-4" /> {restore.isPending ? "Restoring…" : "Restore"}
                    </Button>
                  ) : null
                ) : (
                  <>
                    {canEdit && data.status === "WON" && !data.opportunity ? (
                      <Button
                        variant="primary"
                        className="h-11 w-full rounded-xl sm:w-auto"
                        disabled={changeStatus.isPending}
                        onClick={() => changeStatus.mutate("WON")}
                      >
                        <Icon name="briefcase" className="h-4 w-4" /> Create opportunity
                      </Button>
                    ) : null}
                    {canEdit ? (
                      <Link to={`/tenders/${id}/edit`} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 sm:w-auto">
                        <Icon name="pencil" className="h-4 w-4" /> Edit tender
                      </Link>
                    ) : null}
                    {canDelete ? (
                      <Button variant="secondary" className="h-11 w-full rounded-xl text-rose-700 sm:w-auto" onClick={() => setConfirmDeleteOpen(true)}>
                        <Icon name="trash" className="h-4 w-4" /> Delete
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </header>

          {actionError ? (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> {actionError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <MetricCard label="Estimated value" value={formatMoney(data.estimatedValue, data.currencyCode)} hint={data.estimatedValueBase ? `${formatMoney(data.estimatedValueBase, data.baseCurrencyCode ?? "")} base` : undefined} tone="brand" icon="wallet" />
            <MetricCard label="Submission deadline" value={formatDateTime(data.submissionDeadline)} hint={overdue ? "Past due" : undefined} tone={overdue ? "amber" : "blue"} icon="clock" />
            <MetricCard label="Expected award" value={formatDate(data.expectedAwardDate)} tone="emerald" icon="calendar" />
            <MetricCard label="Owner" value={data.owner ? `${data.owner.firstName} ${data.owner.lastName}` : "Not assigned"} hint={data.owner?.email} tone="slate" icon="user" />
            {data.opportunity ? (
              <OpportunityMetric opportunity={data.opportunity} />
            ) : (
              <MetricCard
                label="CRM conversion"
                value={data.status === "WON" ? "Not linked" : "On award"}
                hint={data.status === "WON" ? "Create the opportunity from this tender" : "A WON tender creates a WON opportunity"}
                tone={data.status === "WON" ? "amber" : "blue"}
                icon="briefcase"
              />
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/60 px-3 pt-3 sm:px-5">
              <TabButton label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
              <TabButton label="Workflow" active={tab === "workflow"} onClick={() => setTab("workflow")} />
              <TabButton label="Activity" active={tab === "activity"} onClick={() => setTab("activity")} />
            </div>

            <div className="p-5 sm:p-6">
              {tab === "overview" ? (
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="grid gap-5">
                    <Panel title="Tender summary" description="Core identifiers, dates and ownership.">
                      <dl className="grid gap-4 sm:grid-cols-2">
                        <Detail label="Customer">
                          {data.customer ? (
                            <Link className="font-semibold text-brand-700 underline-offset-4 hover:underline" to={`/customers/${data.customer.id}`}>
                              {data.customer.displayName} ({data.customer.customerNumber})
                            </Link>
                          ) : "Not set"}
                        </Detail>
                        <Detail label="Contact">{data.contact ? `${data.contact.displayName}${data.contact.email ? ` · ${data.contact.email}` : ""}` : "No specific contact"}</Detail>
                        <Detail label="Reference number">{data.referenceNumber ?? "—"}</Detail>
                        <Detail label="Submission deadline">
                          <span className={overdue ? "font-semibold text-amber-800" : ""}>{formatDateTime(data.submissionDeadline)}{overdue ? " · Overdue" : ""}</span>
                        </Detail>
                        <Detail label="Expected award date">{formatDate(data.expectedAwardDate)}</Detail>
                        <Detail label="Last updated">{formatDateTime(data.updatedAt)}</Detail>
                      </dl>
                    </Panel>
                    {data.description ? <Panel title="Tender brief" description="Scope and submission requirements."><p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{data.description}</p></Panel> : null}
                    {data.notes ? <Panel title="Internal notes" description="Visible to the internal bid team only."><p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{data.notes}</p></Panel> : null}
                  </div>
                  <aside className="min-w-0 overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/70 via-white to-sky-50/60 p-4 shadow-inner ring-1 ring-brand-50">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">Current stage</p>
                    <div className="mt-4"><WorkflowStepper status={data.status} compact /></div>
                    <div className="mt-4 rounded-xl border border-white bg-white/80 p-3 shadow-sm">
                      <TenderStatusBadge status={data.status} deleted={Boolean(data.deletedAt)} />
                      <p className="mt-2 text-xs leading-5 text-slate-600">{TENDER_STATUS_HELP[data.status]}</p>
                    </div>
                    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 ring-1 ring-inset ring-emerald-100">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800">CRM conversion</p>
                      {data.opportunity ? (
                        <div className="mt-2 min-w-0">
                          <Link className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-900 underline-offset-4 hover:underline" to={`/opportunities/${data.opportunity.id}`}>
                            <Icon name="briefcase" className="h-4 w-4 shrink-0" />
                            <span className="truncate">{data.opportunity.opportunityNumber}</span>
                            <Icon name="external" className="h-3.5 w-3.5 shrink-0" />
                          </Link>
                          <p className="mt-1 truncate text-xs text-emerald-800/80">{data.opportunity.title}</p>
                          <p className="mt-1 text-[11px] font-semibold text-emerald-700">{statusLabel(data.opportunity.stage)} stage</p>
                        </div>
                      ) : data.status === "WON" ? (
                        <div className="mt-2">
                          <p className="text-xs leading-5 text-emerald-900/80">This tender is won but has no linked opportunity yet.</p>
                          {canEdit && !data.deletedAt ? (
                            <Button
                              variant="primary"
                              className="mt-3 h-10 w-full rounded-xl"
                              disabled={changeStatus.isPending}
                              onClick={() => changeStatus.mutate("WON")}
                            >
                              <Icon name="briefcase" className="h-4 w-4" /> Create opportunity
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs leading-5 text-emerald-900/80">
                          Moving this tender to Won creates a linked WON opportunity automatically.
                        </p>
                      )}
                    </div>
                  </aside>
                </div>
              ) : null}

              {tab === "workflow" ? (
                <div className="grid gap-5">
                  <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                    <div className="mb-5 flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100"><Icon name="flag" className="h-5 w-5" /></span>
                      <div>
                        <h2 className="text-base font-bold tracking-tight text-slate-950">Bid lifecycle</h2>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Tenders advance one stage at a time. Outcome statuses are final.</p>
                      </div>
                    </div>
                    <WorkflowStepper status={data.status} />
                  </section>

                  <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                    <h2 className="text-sm font-bold text-slate-950">Next actions</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {!canEdit || data.deletedAt
                        ? "Status changes require update permission and an active tender."
                        : isTerminalTenderStatus(data.status)
                          ? "This tender has reached a final outcome."
                          : "Choose the next status to record a workflow event."}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {nextTenderStatuses(data.status).map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={!canEdit || Boolean(data.deletedAt) || changeStatus.isPending}
                          onClick={() => setPendingStatus(status)}
                          className={`rounded-xl border p-4 text-left shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            status === "WON"
                              ? "border-emerald-200 bg-emerald-50/70 enabled:hover:-translate-y-0.5 enabled:hover:border-emerald-300 enabled:hover:bg-emerald-50 enabled:hover:shadow-md"
                              : "border-slate-200 bg-white enabled:hover:-translate-y-0.5 enabled:hover:border-brand-300 enabled:hover:bg-brand-50/40 enabled:hover:shadow-md"
                          }`}
                        >
                          <span className="flex items-center gap-2 text-sm font-bold text-slate-950">
                            {statusLabel(status)}
                            {status === "WON" ? <Icon name="briefcase" className="h-4 w-4 text-emerald-600" /> : null}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            {status === "WON" ? "Creates a linked WON opportunity in the CRM pipeline." : TENDER_STATUS_HELP[status]}
                          </span>
                        </button>
                      ))}
                      {isTerminalTenderStatus(data.status) ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No further transitions are available.</p> : null}
                    </div>
                  </section>
                </div>
              ) : null}

              {tab === "activity" ? (
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-sm font-bold text-slate-950">Audit trail</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Latest workflow and record events for this tender.</p>
                  {audit.isPending ? <div className="mt-5 space-y-3">{[0, 1, 2].map((index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div> : null}
                  {audit.isError ? <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{getApiErrorMessage(audit.error)}</p> : null}
                  {!audit.isPending && !audit.isError && (audit.data?.items ?? []).length === 0 ? (
                    <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">No audit events yet.</div>
                  ) : null}
                  <ol className="mt-5 space-y-4">
                    {(audit.data?.items ?? []).map((event) => (
                      <li key={event.id} className="relative flex gap-3 border-l border-slate-200 pl-5">
                        <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-brand-50" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{tenderActionLabel(event.action)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(event.createdAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </div>
          </div>

          <ConfirmDialog
            open={confirmDeleteOpen}
            title="Delete tender?"
            description={<p>Soft-delete <span className="font-medium text-slate-900">{data.title}</span>? You can restore it later with the right permission.</p>}
            confirmLabel="Delete tender"
            danger
            busy={remove.isPending}
            onCancel={() => setConfirmDeleteOpen(false)}
            onConfirm={() => remove.mutate()}
          />
          <ConfirmDialog
            open={Boolean(pendingStatus)}
            title={`Move to ${pendingStatus ? statusLabel(pendingStatus) : ""}?`}
            description={
              <p>
                {pendingStatus === "WON" && !data.opportunity
                  ? "This records a workflow event and creates a linked WON opportunity for "
                  : "This records a workflow event for "}
                <span className="font-medium text-slate-900">{data.title}</span>.
              </p>
            }
            confirmLabel="Update status"
            busy={changeStatus.isPending}
            onCancel={() => setPendingStatus(null)}
            onConfirm={() => {
              if (pendingStatus) {
                changeStatus.mutate(pendingStatus);
              }
            }}
          />
        </>
      ) : null}
    </section>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`relative px-4 py-3 text-sm font-semibold transition ${active ? "text-brand-800" : "text-slate-500 hover:text-slate-800"}`}>
      {label}
      {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-600" /> : null}
    </button>
  );
}

function WorkflowStepper({ status, compact = false }: { status: TenderStatus; compact?: boolean }) {
  const current = tenderStageIndex(status);
  return (
    <div className={compact ? "grid grid-cols-1 gap-2" : "grid gap-2 sm:grid-cols-2 xl:grid-cols-4"}>
      {TENDER_STAGES.map((stage, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <div
            key={stage.key}
            className={`relative min-w-0 rounded-xl border p-3 transition ${compact ? "flex items-center gap-3" : ""} ${active ? "border-brand-300 bg-brand-50 shadow-sm" : done ? "border-emerald-100 bg-emerald-50/60" : "border-slate-200 bg-white"}`}
          >
            <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${done ? "bg-emerald-500 text-white" : active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"}`}>
              {done ? "✓" : index + 1}
            </span>
            <div className="min-w-0">
              <p className={`truncate text-xs font-bold ${active ? "text-brand-900" : done ? "text-emerald-800" : "text-slate-500"}`}>{stage.label}</p>
              {compact ? null : <p className="mt-2 text-[11px] leading-4 text-slate-500">{stage.hint}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-950">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function MetricCard({ label, value, hint, tone, icon }: { label: string; value: string; hint?: string; tone: "brand" | "blue" | "emerald" | "amber" | "slate"; icon: "wallet" | "clock" | "calendar" | "user" | "briefcase" }) {
  const tones = {
    brand: "bg-brand-500",
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    slate: "bg-slate-400",
  };
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${tones[tone]}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 truncate text-lg font-bold tracking-tight text-slate-950">{value}</p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200"><Icon name={icon} className="h-4 w-4" /></span>
      </div>
      {hint ? <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-400">{hint}</p> : null}
    </div>
  );
}

function OpportunityMetric({ opportunity }: { opportunity: TenderOpportunityRef }) {
  return (
    <Link
      to={`/opportunities/${opportunity.id}`}
      className="group relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
    >
      <span className="absolute inset-x-0 top-0 h-0.5 bg-emerald-500" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Converted opportunity</p>
          <p className="mt-2 truncate font-mono text-sm font-bold tracking-tight text-emerald-950">{opportunity.opportunityNumber}</p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 ring-1 ring-emerald-200"><Icon name="briefcase" className="h-4 w-4" /></span>
      </div>
      <p className="mt-3 truncate border-t border-emerald-200/70 pt-3 text-[11px] font-medium text-emerald-800/80">{opportunity.title}</p>
    </Link>
  );
}

function Icon({ name, className }: { name: "file" | "restore" | "pencil" | "trash" | "alert" | "wallet" | "clock" | "calendar" | "user" | "flag" | "briefcase" | "check" | "external"; className?: string }) {
  const paths: Record<typeof name, ReactNode> = {
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></>,
    restore: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><polyline points="3 3 3 8 8 8" /><path d="M12 7v5l3 2" /></>,
    pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
    alert: <><path d="m10.29 3.86-8.18 14.14A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    wallet: <><rect x="3" y="6" width="18" height="12" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    flag: <><path d="M4 22V4" /><path d="M4 5h13l-2 4 2 4H4" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 12h18" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    external: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

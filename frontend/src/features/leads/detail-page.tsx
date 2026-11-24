import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormField } from "@/components/forms/FormField.tsx";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useHasPermission, useSessionUser } from "@/hooks/useSession.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { ConvertLeadDialog } from "./convert-dialog.tsx";
import {
  LEAD_STATUS_TRANSITIONS,
  changeLeadStatus,
  deleteLead,
  formatMoney,
  getLead,
  leadPriorityLabel,
  leadSourceLabel,
  leadStatusLabel,
  listLeadAudit,
  restoreLead,
  updateLead,
  type Lead,
  type LeadStatus,
} from "./api.ts";

export default function LeadDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useSessionUser();
  const canUpdate = useHasPermission("leads:update");
  const canDelete = useHasPermission("leads:delete");
  const canRestore = useHasPermission("leads:restore");
  const canSeeDeleted = canDelete || canRestore;

  const [statusOpen, setStatusOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<LeadStatus | "">("");
  const [reason, setReason] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDueAt, setNextActionDueAt] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [auditCursors, setAuditCursors] = useState<Array<string | undefined>>([undefined]);

  const lead = useQuery({
    queryKey: ["leads", id, { includeDeleted: canSeeDeleted }],
    queryFn: () => getLead(id, canSeeDeleted),
    enabled: Boolean(id),
  });
  const audit = useQuery({
    queryKey: ["leads", id, "audit", auditCursors.at(-1), { includeDeleted: canSeeDeleted }],
    queryFn: () => listLeadAudit(id, { cursor: auditCursors.at(-1), includeDeleted: canSeeDeleted }),
    enabled: Boolean(id),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["leads"] });
  };

  const statusChange = useMutation({
    mutationFn: (payload: { status: LeadStatus; reason?: string; nextAction?: string; nextActionDueAt?: string }) =>
      changeLeadStatus(id, {
        status: payload.status,
        unqualifiedReason: payload.reason,
        nextAction: payload.nextAction,
        nextActionDueAt: payload.nextActionDueAt ? toIso(payload.nextActionDueAt) : undefined,
      }),
    onSuccess: async () => {
      setStatusOpen(false);
      setTargetStatus("");
      setReason("");
      setNextAction("");
      setNextActionDueAt("");
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  const quickContact = useMutation({
    mutationFn: () => changeLeadStatus(id, { status: "CONTACTED" }),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  const assign = useMutation({
    mutationFn: () => updateLead(id, { ownerUserId: user?.id ?? "" }),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => deleteLead(id),
    onSuccess: async () => {
      setDeleteOpen(false);
      await refresh();
    },
    onError: (error) => {
      setDeleteOpen(false);
      setActionError(getApiErrorMessage(error));
    },
  });

  const restore = useMutation({
    mutationFn: () => restoreLead(id),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  if (lead.isPending) {
    return (
      <section className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</div>
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  if (lead.isError || !lead.data) {
    return (
      <section className="mx-auto max-w-6xl">
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {lead.isError ? getApiErrorMessage(lead.error) : "Lead not found"}
          <div className="mt-3"><Link className="font-semibold underline" to="/leads">Back to leads</Link></div>
        </div>
      </section>
    );
  }

  const row = lead.data;
  const allowedStatuses = LEAD_STATUS_TRANSITIONS[row.status] ?? [];
  const canConvert = canUpdate && row.status === "QUALIFIED" && !row.deletedAt;
  const isMine = Boolean(user && row.ownerUserId === user.id);
  const auditRows = audit.data?.items ?? [];

  function openStatusModal() {
    setTargetStatus("");
    setReason("");
    setNextAction(row.nextAction ?? "");
    setNextActionDueAt(row.nextActionDueAt ? toLocalInput(row.nextActionDueAt) : "");
    setActionError(null);
    setStatusOpen(true);
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-sky-400" />
        <div className="p-5 sm:p-6">
          <p className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
            <Link className="hover:underline" to="/leads">CRM / Leads</Link>
            <span className="text-slate-300">/</span>
            <span className="font-mono text-slate-500">{row.leadNumber}</span>
          </p>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 sm:flex"><Icon name="target" className="h-6 w-6" /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-3xl font-bold tracking-tight text-slate-950">{row.displayName}</h1>
                  <StatusBadge status={row.status} deleted={Boolean(row.deletedAt)} />
                  <PriorityBadge priority={row.priority} />
                </div>
                <p className="mt-1.5 text-sm text-slate-600">
                  {[row.companyName, row.jobTitle].filter(Boolean).join(" · ") || "No company recorded"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">{leadSourceLabel(row.source)}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">Owner: {row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : "Unassigned"}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">Created {row.createdAt.slice(0, 10)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {row.deletedAt ? (
                canRestore ? <Button className="bg-emerald-700 hover:bg-emerald-800" disabled={restore.isPending} onClick={() => restore.mutate()}>{restore.isPending ? "Restoring…" : "Restore lead"}</Button> : null
              ) : (
                <>
                  {canUpdate ? <Link to={`/leads/${row.id}/edit`}><Button variant="secondary" className="gap-2"><Icon name="pencil" className="h-4 w-4" /> Edit</Button></Link> : null}
                  {canUpdate && row.status === "NEW" ? (
                    <Button variant="secondary" className="gap-2" disabled={quickContact.isPending} onClick={() => quickContact.mutate()}>
                      <Icon name="phone" className="h-4 w-4" /> {quickContact.isPending ? "Updating…" : "Mark contacted"}
                    </Button>
                  ) : null}
                  {canUpdate && allowedStatuses.length > 0 ? <Button variant="secondary" className="gap-2" onClick={openStatusModal}><Icon name="zap" className="h-4 w-4" /> Status / follow-up</Button> : null}
                  {canUpdate && !isMine && user ? (
                    <Button variant="secondary" className="gap-2" disabled={assign.isPending} onClick={() => assign.mutate()}>
                      <Icon name="userCheck" className="h-4 w-4" /> {assign.isPending ? "Assigning…" : "Assign to me"}
                    </Button>
                  ) : null}
                  {canConvert ? <Button className="gap-2 bg-brand-800 hover:bg-brand-900" onClick={() => setConvertOpen(true)}><Icon name="badgeCheck" className="h-4 w-4" /> Convert</Button> : null}
                  {canDelete ? <Button variant="ghost" className="gap-2 text-rose-700 hover:bg-rose-50" onClick={() => setDeleteOpen(true)}><Icon name="trash" className="h-4 w-4" /> Delete</Button> : null}
                </>
              )}
            </div>
          </div>
          {row.deletedAt ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">This lead was deleted on {row.deletedAt.slice(0, 10)}. Restore it to continue working with it.</p>
          ) : null}
          {actionError ? <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{actionError}</div> : null}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Estimated value" value={formatMoney(row.estimatedValue, row.currencyCode)} detail="Expected deal size" icon="target" tone="brand" />
        <Metric label="Source" value={leadSourceLabel(row.source)} detail="Acquisition channel" icon="building" tone="violet" />
        <Metric label="Priority" value={leadPriorityLabel(row.priority)} detail="Follow-up urgency" icon="flag" tone={row.priority === "URGENT" ? "amber" : "slate"} />
        <Metric label="Next action" value={row.nextAction ?? "Not scheduled"} detail={row.nextActionDueAt ? `Due ${row.nextActionDueAt.slice(0, 10)}` : "No due date"} icon="calendar" tone="emerald" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="flex flex-col gap-5">
          <Panel title="Contact & company" subtitle="Primary details captured for this enquiry">
            <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <Detail label="Email" value={row.email} />
              <Detail label="Phone" value={row.phone} />
              <Detail label="Website" value={row.website} />
              <Detail label="Country" value={row.countryCode} />
              <Detail label="Created" value={row.createdAt.slice(0, 10)} />
              <Detail label="Last updated" value={row.updatedAt.slice(0, 10)} />
            </dl>
          </Panel>

          <Panel title="Qualification" subtitle="Status history and follow-up plan">
            <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <Detail label="Status" value={leadStatusLabel(row.status)} />
              <Detail label="Next action" value={row.nextAction} />
              <Detail label="Next action due" value={row.nextActionDueAt ? row.nextActionDueAt.slice(0, 16).replace("T", " ") : null} />
              <Detail label="Qualified at" value={row.qualifiedAt ? row.qualifiedAt.slice(0, 10) : null} />
              <Detail label="Unqualified at" value={row.unqualifiedAt ? row.unqualifiedAt.slice(0, 10) : null} />
              <Detail label="Reason" value={row.unqualifiedReason} />
            </dl>
            {row.description ? <p className="mt-4 whitespace-pre-wrap border-t border-slate-100 pt-4 text-sm leading-6 text-slate-700">{row.description}</p> : null}
          </Panel>

          {row.convertedAt || row.opportunity ? (
            <Panel title="Conversion outcome" subtitle="Records created when this lead was qualified and converted">
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <Detail label="Converted at" value={row.convertedAt ? row.convertedAt.slice(0, 10) : null} />
                <div>
                  <dt className="text-xs text-slate-500">Customer</dt>
                  <dd className="mt-0.5">{row.convertedCustomer ? <Link className="font-medium text-brand-800 hover:underline" to={`/customers/${row.convertedCustomer.id}`}>{row.convertedCustomer.displayName} ({row.convertedCustomer.customerNumber})</Link> : <span className="text-slate-400">—</span>}</dd>
                </div>
                <Detail label="Contact" value={row.convertedContact?.displayName ?? null} />
                <div>
                  <dt className="text-xs text-slate-500">Opportunity</dt>
                  <dd className="mt-0.5">{row.opportunity ? <Link className="font-medium text-brand-800 hover:underline" to={`/opportunities/${row.opportunity.id}`}>{row.opportunity.title} ({row.opportunity.opportunityNumber})</Link> : <span className="text-slate-400">—</span>}</dd>
                </div>
                <Detail label="Won at" value={row.wonAt ? row.wonAt.slice(0, 10) : null} />
              </dl>
            </Panel>
          ) : null}

          {row.notes ? <Panel title="Internal notes" subtitle="Visible to your team only"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{row.notes}</p></Panel> : null}
        </div>

        <Panel title="Activity" subtitle="Audit trail for this lead" action={
          auditCursors.length > 1 ? <button type="button" className="text-[11px] font-semibold text-brand-800 hover:underline" onClick={() => setAuditCursors((current) => current.slice(0, -1))}>Newer</button> : null
        }>
          {audit.isPending ? <div className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-8 animate-pulse rounded bg-slate-100" />)}</div> : null}
          {audit.isError ? <p className="text-sm text-rose-700">{getApiErrorMessage(audit.error)}</p> : null}
          {!audit.isPending && !audit.isError && auditRows.length === 0 ? <p className="text-sm text-slate-500">No activity recorded yet.</p> : null}
          <ol className="flex flex-col gap-4">
            {auditRows.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                <div className="min-w-0">
                  <p className="text-sm font-medium capitalize text-slate-800">{formatActivityAction(event.action)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ol>
          {audit.data?.pageInfo.hasNextPage ? (
            <button type="button" className="mt-4 w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50" onClick={() => {
              const next = audit.data?.pageInfo.nextCursor;
              if (next) setAuditCursors((current) => [...current, next]);
            }}>
              Load older activity
            </button>
          ) : null}
        </Panel>
      </div>

      <Modal
        open={statusOpen}
        title="Update status & follow-up"
        onClose={statusChange.isPending ? () => undefined : () => setStatusOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusOpen(false)} disabled={statusChange.isPending}>Cancel</Button>
            <Button className="bg-brand-800 hover:bg-brand-900" onClick={() => {
              if (!targetStatus) return;
              if (nextActionDueAt && !Number.isFinite(new Date(nextActionDueAt).getTime())) {
                setActionError("Choose a valid next action due date.");
                return;
              }
              statusChange.mutate({
                status: targetStatus,
                reason: targetStatus === "UNQUALIFIED" ? reason.trim() || undefined : undefined,
                nextAction: nextAction.trim() || undefined,
                nextActionDueAt: nextActionDueAt || undefined,
              });
            }} disabled={statusChange.isPending || !targetStatus}>
              {statusChange.isPending ? "Updating…" : "Update lead"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="New status" htmlFor="targetStatus" required>
            <select id="targetStatus" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={targetStatus} onChange={(event) => setTargetStatus(event.target.value as LeadStatus | "")}>
              <option value="">Choose a status</option>
              {allowedStatuses.map((value) => <option key={value} value={value}>{leadStatusLabel(value)}</option>)}
            </select>
          </FormField>
          <FormField label="Next action" htmlFor="statusNextAction">
            <Input id="statusNextAction" placeholder="e.g. Send revised proposal" value={nextAction} onChange={(event) => setNextAction(event.target.value)} />
          </FormField>
          <FormField label="Next action due" htmlFor="statusDueAt">
            <Input id="statusDueAt" type="datetime-local" value={nextActionDueAt} onChange={(event) => setNextActionDueAt(event.target.value)} />
          </FormField>
          {targetStatus === "UNQUALIFIED" ? (
            <FormField label="Unqualified reason" htmlFor="statusReason">
              <Input id="statusReason" placeholder="Why is this lead not a fit?" value={reason} onChange={(event) => setReason(event.target.value)} />
            </FormField>
          ) : null}
          <p className="text-xs leading-5 text-slate-500">Converted and won statuses are set automatically by conversion and opportunity outcomes.</p>
        </div>
      </Modal>

      <ConvertLeadDialog
        lead={row}
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        onConverted={(updated) => {
          setConvertOpen(false);
          if (updated.opportunity) {
            navigate(`/opportunities/${updated.opportunity.id}`);
          }
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete lead"
        description={`Delete ${row.displayName} (${row.leadNumber})? The record can be restored later.`}
        confirmLabel="Delete lead"
        danger
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setDeleteOpen(false)}
      />
    </section>
  );
}

function Metric({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: IconName; tone: Tone }) {
  const tones: Record<Tone, string> = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    brand: "bg-brand-50 text-brand-700 ring-brand-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  };
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 truncate text-lg font-bold tabular-nums text-slate-950" title={value}>{value}</p>
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}><Icon name={icon} className="h-5 w-5" /></span>
      </div>
      <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-400">{detail}</p>
    </div>
  );
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/40 px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-0.5 break-words font-medium text-slate-800">{value ?? "—"}</dd></div>;
}

function StatusBadge({ status, deleted }: { status: Lead["status"]; deleted: boolean }) {
  if (deleted) return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Deleted</span>;
  const styles: Record<Lead["status"], string> = {
    NEW: "bg-slate-100 text-slate-700 ring-slate-200",
    CONTACTED: "bg-indigo-50 text-indigo-800 ring-indigo-200",
    QUALIFIED: "bg-sky-50 text-sky-800 ring-sky-200",
    UNQUALIFIED: "bg-amber-50 text-amber-800 ring-amber-200",
    CONVERTED: "bg-brand-50 text-brand-800 ring-brand-200",
    WON: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${styles[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" /> {leadStatusLabel(status)}</span>;
}

function PriorityBadge({ priority }: { priority: Lead["priority"] }) {
  const style = priority === "URGENT" ? "bg-rose-50 text-rose-800 ring-rose-200" : priority === "HIGH" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-brand-50 text-brand-800 ring-brand-100";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${style}`}><Icon name="flag" className="h-3 w-3" /> {leadPriorityLabel(priority)}</span>;
}

type Tone = "slate" | "brand" | "emerald" | "violet" | "amber";
type IconName = "target" | "pencil" | "phone" | "zap" | "userCheck" | "badgeCheck" | "trash" | "building" | "flag" | "calendar";

function Svg({ className, children }: { className?: string; children: ReactNode }) {
  return <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

function Icon({ name, className }: { name: IconName; className?: string }) {
  switch (name) {
    case "target": return <Svg className={className}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Svg>;
    case "pencil": return <Svg className={className}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" /></Svg>;
    case "phone": return <Svg className={className}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></Svg>;
    case "zap": return <Svg className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Svg>;
    case "userCheck": return <Svg className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></Svg>;
    case "badgeCheck": return <Svg className={className}><path d="M12 2l2.4 1.8 3 .1 1 2.8 2.4 1.8-1 2.8 1 2.8-2.4 1.8-1 2.8-3 .1L12 20l-2.4-1.8-3-.1-1-2.8L3.2 13.5l1-2.8-1-2.8 2.4-1.8 1-2.8 3-.1z" /><polyline points="9 12 11 14 15 10" /></Svg>;
    case "trash": return <Svg className={className}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></Svg>;
    case "building": return <Svg className={className}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></Svg>;
    case "flag": return <Svg className={className}><path d="M4 22V4M4 5h13l-2 4 2 4H4" /></Svg>;
    case "calendar": return <Svg className={className}><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="16" y1="3" x2="16" y2="7" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="3" y1="10" x2="21" y2="10" /></Svg>;
  }
}

function formatActivityAction(action: string): string {
  return action.replaceAll(".", " ").replaceAll("_", " ").trim();
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value: string): string | undefined {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

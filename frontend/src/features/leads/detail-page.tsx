import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { ConvertLeadDialog } from "./convert-dialog.tsx";
import {
  LEAD_STATUS_TRANSITIONS,
  changeLeadStatus,
  deleteLead,
  formatMoney,
  getLead,
  leadSourceLabel,
  leadStatusLabel,
  listLeadAudit,
  restoreLead,
  type LeadStatus,
} from "./api.ts";

export default function LeadDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission("leads:update");
  const canDelete = useHasPermission("leads:delete");
  const canRestore = useHasPermission("leads:restore");

  const [statusOpen, setStatusOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<LeadStatus | "">("");
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const lead = useQuery({ queryKey: ["leads", id], queryFn: () => getLead(id), enabled: Boolean(id) });
  const audit = useQuery({
    queryKey: ["leads", id, "audit"],
    queryFn: () => listLeadAudit(id),
    enabled: Boolean(id),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["leads"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
    ]);
  };

  const changeStatus = useMutation({
    mutationFn: () =>
      changeLeadStatus(id, {
        status: targetStatus as LeadStatus,
        unqualifiedReason: targetStatus === "UNQUALIFIED" ? reason.trim() || undefined : undefined,
      }),
    onSuccess: async () => {
      setStatusOpen(false);
      setTargetStatus("");
      setReason("");
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
      await refresh();
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  if (lead.isPending) {
    return <p className="text-sm text-slate-500">Loading lead…</p>;
  }
  if (lead.isError || !lead.data) {
    return <p className="text-sm text-red-700">{lead.isError ? getApiErrorMessage(lead.error) : "Lead not found"}</p>;
  }

  const row = lead.data;
  const allowedStatuses = LEAD_STATUS_TRANSITIONS[row.status] ?? [];
  const canConvert = canUpdate && row.status === "QUALIFIED" && !row.deletedAt;
  const auditRows = audit.data?.items ?? [];

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="border-b border-slate-200 pb-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          <Link className="hover:underline" to="/leads">
            CRM / Leads
          </Link>
          <span className="text-slate-400">/</span>
          <span className="font-mono text-slate-500">{row.leadNumber}</span>
        </p>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-950">{row.displayName}</h1>
              <StatusBadge status={row.status} deleted={Boolean(row.deletedAt)} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {[row.companyName, row.jobTitle].filter(Boolean).join(" · ") || "No company recorded"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.deletedAt ? (
              canRestore ? (
                <Button
                  className="bg-emerald-700 hover:bg-emerald-800"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate()}
                >
                  {restore.isPending ? "Restoring…" : "Restore lead"}
                </Button>
              ) : null
            ) : (
              <>
                {canUpdate ? (
                  <Link to={`/leads/${row.id}/edit`}>
                    <Button variant="secondary">Edit</Button>
                  </Link>
                ) : null}
                {canUpdate && allowedStatuses.length > 0 ? (
                  <Button variant="secondary" onClick={() => setStatusOpen(true)}>
                    Change status
                  </Button>
                ) : null}
                {canConvert ? (
                  <Button className="bg-brand-800 hover:bg-brand-900" onClick={() => setConvertOpen(true)}>
                    Convert to opportunity
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
                    Delete
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
        {row.deletedAt ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This lead was deleted on {row.deletedAt.slice(0, 10)}. Restore it to continue working with it.
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {actionError}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Estimated value" value={formatMoney(row.estimatedValue, row.currencyCode)} />
        <Metric label="Source" value={leadSourceLabel(row.source)} />
        <Metric label="Priority" value={row.priority[0] + row.priority.slice(1).toLowerCase()} />
        <Metric
          label="Owner"
          value={row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : "Unassigned"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="flex flex-col gap-4">
          <Panel title="Contact">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Detail label="Email" value={row.email} />
              <Detail label="Phone" value={row.phone} />
              <Detail label="Website" value={row.website} />
              <Detail label="Country" value={row.countryCode} />
              <Detail label="Created" value={row.createdAt.slice(0, 10)} />
              <Detail label="Last updated" value={row.updatedAt.slice(0, 10)} />
            </dl>
          </Panel>

          <Panel title="Qualification">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Detail label="Status" value={leadStatusLabel(row.status)} />
              <Detail label="Next action" value={row.nextAction} />
              <Detail
                label="Next action due"
                value={row.nextActionDueAt ? row.nextActionDueAt.slice(0, 16).replace("T", " ") : null}
              />
              <Detail label="Qualified at" value={row.qualifiedAt ? row.qualifiedAt.slice(0, 10) : null} />
              <Detail label="Unqualified at" value={row.unqualifiedAt ? row.unqualifiedAt.slice(0, 10) : null} />
              <Detail label="Reason" value={row.unqualifiedReason} />
            </dl>
            {row.description ? <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{row.description}</p> : null}
          </Panel>

          {row.convertedAt || row.opportunity ? (
            <Panel title="Conversion">
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Detail label="Converted at" value={row.convertedAt ? row.convertedAt.slice(0, 10) : null} />
                <div>
                  <dt className="text-xs text-slate-500">Customer</dt>
                  <dd className="mt-0.5">
                    {row.convertedCustomer ? (
                      <Link className="font-medium text-brand-800 hover:underline" to={`/customers/${row.convertedCustomer.id}`}>
                        {row.convertedCustomer.displayName} ({row.convertedCustomer.customerNumber})
                      </Link>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Contact</dt>
                  <dd className="mt-0.5 text-slate-700">{row.convertedContact?.displayName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Opportunity</dt>
                  <dd className="mt-0.5">
                    {row.opportunity ? (
                      <Link className="font-medium text-brand-800 hover:underline" to={`/opportunities/${row.opportunity.id}`}>
                        {row.opportunity.title} ({row.opportunity.opportunityNumber})
                      </Link>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </dd>
                </div>
                <Detail label="Won at" value={row.wonAt ? row.wonAt.slice(0, 10) : null} />
              </dl>
            </Panel>
          ) : null}

          {row.notes ? (
            <Panel title="Notes">
              <p className="whitespace-pre-wrap text-sm text-slate-700">{row.notes}</p>
            </Panel>
          ) : null}
        </div>

        <Panel title="Activity">
          {audit.isPending ? <p className="text-sm text-slate-500">Loading activity…</p> : null}
          {audit.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(audit.error)}</p> : null}
          {!audit.isPending && !audit.isError && auditRows.length === 0 ? (
            <p className="text-sm text-slate-500">No activity recorded yet.</p>
          ) : null}
          <ol className="flex flex-col gap-3">
            {auditRows.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{event.action.replaceAll(".", " ")}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Modal
        open={statusOpen}
        title="Change lead status"
        onClose={changeStatus.isPending ? () => undefined : () => setStatusOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusOpen(false)} disabled={changeStatus.isPending}>
              Cancel
            </Button>
            <Button
              className="bg-brand-800 hover:bg-brand-900"
              onClick={() => changeStatus.mutate()}
              disabled={changeStatus.isPending || !targetStatus}
            >
              {changeStatus.isPending ? "Updating…" : "Update status"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-slate-700" htmlFor="targetStatus">
            New status
          </label>
          <select
            id="targetStatus"
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={targetStatus}
            onChange={(event) => setTargetStatus(event.target.value as LeadStatus | "")}
          >
            <option value="">Choose a status</option>
            {allowedStatuses.map((value) => (
              <option key={value} value={value}>
                {leadStatusLabel(value)}
              </option>
            ))}
          </select>
          {targetStatus === "UNQUALIFIED" ? (
            <Input placeholder="Reason (optional)" value={reason} onChange={(event) => setReason(event.target.value)} />
          ) : null}
          <p className="text-xs text-slate-500">
            Converted and won statuses are set automatically by conversion and opportunity outcomes.
          </p>
        </div>
      </Modal>

      <ConvertLeadDialog
        lead={row}
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        onConverted={() => {
          setConvertOpen(false);
          void refresh();
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete lead"
        description={`Delete ${row.displayName} (${row.leadNumber})? The record can be restored later.`}
        confirmLabel="Delete lead"
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setDeleteOpen(false)}
      />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-slate-950" title={value}>
        {value}
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-slate-800">{value ?? "—"}</dd>
    </div>
  );
}

function StatusBadge({ status, deleted }: { status: LeadStatus; deleted: boolean }) {
  if (deleted) {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
        Deleted
      </span>
    );
  }
  const style =
    status === "WON"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : status === "CONVERTED"
        ? "bg-brand-50 text-brand-800 ring-brand-200"
        : status === "QUALIFIED"
          ? "bg-sky-50 text-sky-800 ring-sky-200"
          : status === "UNQUALIFIED"
            ? "bg-amber-50 text-amber-800 ring-amber-200"
            : status === "CONTACTED"
              ? "bg-indigo-50 text-indigo-800 ring-indigo-200"
              : "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style}`}>
      {leadStatusLabel(status)}
    </span>
  );
}

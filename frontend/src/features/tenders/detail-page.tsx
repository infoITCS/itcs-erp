import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  TENDER_STATUSES,
  deleteTender,
  getTender,
  listTenderAudit,
  restoreTender,
  updateTender,
  type TenderStatus,
} from "./api.ts";
import {
  TenderStatusBadge,
  formatDate,
  formatDateTime,
  formatMoney,
  isDeadlineOverdue,
  statusLabel,
} from "./shared.tsx";

export default function TenderDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = useHasPermission("tenders:update");
  const canDelete = useHasPermission("tenders:delete");
  const canRestore = useHasPermission("tenders:restore");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const tender = useQuery({ queryKey: ["tenders", id], queryFn: () => getTender(id) });
  const audit = useQuery({
    queryKey: ["tenders", id, "audit"],
    queryFn: () => listTenderAudit(id),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["tenders", id] });
    await queryClient.invalidateQueries({ queryKey: ["tenders", "list"] });
  };

  const remove = useMutation({
    mutationFn: () => deleteTender(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tenders", "list"] });
      navigate("/tenders");
    },
  });

  const restore = useMutation({
    mutationFn: () => restoreTender(id),
    onSuccess: refresh,
  });

  const changeStatus = useMutation({
    mutationFn: (status: TenderStatus) => updateTender(id, { status }),
    onSuccess: refresh,
  });

  const data = tender.data;
  const overdue = data ? isDeadlineOverdue(data.submissionDeadline, data.status) : false;

  return (
    <section className="flex flex-col gap-6">
      {tender.isPending ? <p className="text-sm text-slate-500">Loading tender…</p> : null}
      {tender.isError ? (
        <p className="text-sm text-red-700">{getApiErrorMessage(tender.error)}</p>
      ) : null}

      {data ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-teal-800">
                <span className="h-2 w-2 rounded-full bg-teal-600" />
                CRM / Tenders
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-xs text-slate-500">{data.tenderNumber}</p>
                <TenderStatusBadge status={data.status} deleted={Boolean(data.deletedAt)} />
              </div>
              <h1 className="mt-1 text-3xl font-semibold text-slate-950">{data.title}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {data.customer?.displayName ?? "No customer"} · {formatMoney(data.estimatedValue, data.currencyCode)}
                {data.referenceNumber ? ` · Ref ${data.referenceNumber}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.deletedAt ? (
                canRestore ? (
                  <Button variant="secondary" disabled={restore.isPending} onClick={() => restore.mutate()}>
                    {restore.isPending ? "Restoring…" : "Restore"}
                  </Button>
                ) : null
              ) : (
                <>
                  {canEdit ? (
                    <Link
                      to={`/tenders/${id}/edit`}
                      className="inline-flex h-10 items-center rounded-md border border-slate-300 px-3 text-sm"
                    >
                      Edit
                    </Link>
                  ) : null}
                  {canDelete ? (
                    <Button variant="secondary" className="h-10" onClick={() => setConfirmDeleteOpen(true)}>
                      Delete
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {restore.isError ? (
            <p className="text-sm text-red-700">{getApiErrorMessage(restore.error)}</p>
          ) : null}
          {remove.isError ? (
            <p className="text-sm text-red-700">{getApiErrorMessage(remove.error)}</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Estimated value"
              value={formatMoney(data.estimatedValue, data.currencyCode)}
              hint={
                data.estimatedValueBase
                  ? `${formatMoney(data.estimatedValueBase, data.baseCurrencyCode ?? "")} base`
                  : undefined
              }
            />
            <MetricCard
              label="Submission deadline"
              value={formatDateTime(data.submissionDeadline)}
              tone={overdue ? "amber" : "slate"}
              hint={overdue ? "Past due" : undefined}
            />
            <MetricCard label="Expected award" value={formatDate(data.expectedAwardDate)} />
            <MetricCard
              label="Owner"
              value={data.owner ? `${data.owner.firstName} ${data.owner.lastName}` : "Not assigned"}
              hint={data.owner?.email}
            />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Status</h2>
              <p className="text-xs text-slate-500">
                {canEdit && !data.deletedAt
                  ? "Select a status to update this tender."
                  : "Status changes require update permission."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {TENDER_STATUSES.map((status) => {
                const isCurrent = status === data.status;
                return (
                  <button
                    key={status}
                    type="button"
                    disabled={isCurrent || !canEdit || Boolean(data.deletedAt) || changeStatus.isPending}
                    onClick={() => changeStatus.mutate(status)}
                    className={`rounded-md border px-3 py-2 text-left transition ${
                      isCurrent
                        ? "border-teal-300 bg-teal-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/40 disabled:cursor-not-allowed disabled:opacity-60"
                    }`}
                  >
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {isCurrent ? "Current" : "Set status"}
                    </span>
                    <span className={`text-xs font-semibold ${isCurrent ? "text-slate-950" : "text-slate-700"}`}>
                      {statusLabel(status)}
                    </span>
                  </button>
                );
              })}
            </div>
            {changeStatus.isPending ? (
              <p className="mt-3 text-sm text-slate-500">Updating status…</p>
            ) : null}
            {changeStatus.isError ? (
              <p className="mt-3 text-sm text-red-700">{getApiErrorMessage(changeStatus.error)}</p>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Summary</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <Detail label="Customer">
                {data.customer ? (
                  <Link
                    className="font-medium text-teal-800 underline-offset-2 hover:underline"
                    to={`/customers/${data.customer.id}`}
                  >
                    {data.customer.displayName} ({data.customer.customerNumber})
                  </Link>
                ) : (
                  "Not set"
                )}
              </Detail>
              <Detail label="Contact">
                {data.contact
                  ? `${data.contact.displayName}${data.contact.email ? ` · ${data.contact.email}` : ""}`
                  : "No specific contact"}
              </Detail>
              <Detail label="Reference number">{data.referenceNumber ?? "—"}</Detail>
              <Detail label="Submission deadline">
                <span className={overdue ? "font-medium text-amber-800" : ""}>
                  {formatDateTime(data.submissionDeadline)}
                  {overdue ? " · Overdue" : ""}
                </span>
              </Detail>
              <Detail label="Expected award date">{formatDate(data.expectedAwardDate)}</Detail>
              <Detail label="Last updated">{formatDateTime(data.updatedAt)}</Detail>
            </dl>
            {data.description ? (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-500">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{data.description}</p>
              </div>
            ) : null}
            {data.notes ? (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-500">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{data.notes}</p>
              </div>
            ) : null}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Recent audit</h2>
            {audit.isPending ? <p className="text-sm text-slate-500">Loading audit…</p> : null}
            {audit.isError ? (
              <p className="text-sm text-red-700">{getApiErrorMessage(audit.error)}</p>
            ) : null}
            {(audit.data?.items ?? []).length === 0 && !audit.isPending ? (
              <p className="text-sm text-slate-500">No audit events yet.</p>
            ) : null}
            <ul className="flex flex-col gap-1 text-sm text-slate-700">
              {(audit.data?.items ?? []).map((event) => (
                <li key={event.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-slate-800">{statusLabel(event.action.replace(/\./g, "_"))}</span>
                  <span className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>

          <ConfirmDialog
            open={confirmDeleteOpen}
            title="Delete tender?"
            description={
              <p>
                Soft-delete <span className="font-medium text-slate-900">{data.title}</span>? You can
                restore it later with the right permission.
              </p>
            }
            confirmLabel="Delete tender"
            busy={remove.isPending}
            onCancel={() => setConfirmDeleteOpen(false)}
            onConfirm={() => remove.mutate()}
          />
        </>
      ) : null}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "slate" | "amber";
}) {
  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm transition hover:border-slate-300 ${
        tone === "amber" ? "border-amber-200" : "border-slate-200"
      }`}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={`mt-1 truncate text-lg font-semibold ${
          tone === "amber" ? "text-amber-900" : "text-slate-950"
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p className={`mt-1 text-xs ${tone === "amber" ? "text-amber-700" : "text-slate-500"}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

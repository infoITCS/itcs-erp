import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { PAYMENT_METHOD_LABELS, deletePayment, getPayment, listPaymentAudit } from "./api.ts";
import { Detail, Metric, Panel, StatusPill, formatDate, formatMoney } from "../sales/shared.tsx";

export default function PaymentDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission("payments:update");
  const canDelete = useHasPermission("payments:delete");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const payment = useQuery({ queryKey: ["payments", id], queryFn: () => getPayment(id), enabled: Boolean(id) });
  const audit = useQuery({
    queryKey: ["payments", id, "audit"],
    queryFn: () => listPaymentAudit(id),
    enabled: Boolean(id),
  });

  const remove = useMutation({
    mutationFn: () => deletePayment(id),
    onSuccess: async () => {
      setDeleteOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
      ]);
      navigate("/payments");
    },
    onError: (error) => {
      setDeleteOpen(false);
      setActionError(getApiErrorMessage(error));
    },
  });

  if (payment.isPending) {
    return <p className="text-sm text-slate-500">Loading payment…</p>;
  }
  if (payment.isError || !payment.data) {
    return <p className="text-sm text-red-700">{payment.isError ? getApiErrorMessage(payment.error) : "Payment not found"}</p>;
  }

  const row = payment.data;
  const auditRows = audit.data?.items ?? [];
  const invoice = row.invoice;
  const balance = invoice ? Number(invoice.total) - Number(invoice.amountPaid) : null;

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="border-b border-slate-200 pb-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
          <span className="h-2 w-2 rounded-full bg-teal-600" />
          <Link className="hover:underline" to="/payments">
            Sales / Payments
          </Link>
          <span className="text-slate-400">/</span>
          <span className="font-mono text-slate-500">{row.paymentNumber}</span>
        </p>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-950">{formatMoney(row.amount, row.currencyCode)}</h1>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                Received
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {row.customer?.displayName ?? "Customer"} · {PAYMENT_METHOD_LABELS[row.method]} ·{" "}
              {formatDate(row.receivedDate)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canUpdate ? (
              <Link to={`/payments/${row.id}/edit`}>
                <Button variant="secondary">Edit</Button>
              </Link>
            ) : null}
            {canDelete ? (
              <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            ) : null}
          </div>
        </div>
        {actionError ? (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {actionError}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Amount received" value={formatMoney(row.amount, row.currencyCode)} />
        <Metric label="Method" value={PAYMENT_METHOD_LABELS[row.method]} />
        <Metric label="Invoice total" value={invoice ? formatMoney(invoice.total, invoice.currencyCode) : "—"} />
        <Metric label="Invoice balance" value={balance === null ? "—" : formatMoney(balance, row.currencyCode)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="flex flex-col gap-4">
          <Panel title="Applied to invoice">
            {invoice ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Invoice</dt>
                  <dd className="mt-0.5">
                    <Link className="font-mono font-medium text-teal-800 hover:underline" to={`/invoices/${invoice.id}`}>
                      {invoice.invoiceNumber}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Invoice status</dt>
                  <dd className="mt-0.5">
                    <StatusPill status={invoice.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Issued</dt>
                  <dd className="mt-0.5 text-slate-800">{formatDate(invoice.issueDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Due</dt>
                  <dd className="mt-0.5 text-slate-800">{formatDate(invoice.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Paid to date</dt>
                  <dd className="mt-0.5 tabular-nums text-slate-800">
                    {formatMoney(invoice.amountPaid, invoice.currencyCode)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Outstanding</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
                    {formatMoney(Number(invoice.total) - Number(invoice.amountPaid), invoice.currencyCode)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">The linked invoice is not available.</p>
            )}
          </Panel>

          {row.notes ? (
            <Panel title="Notes">
              <p className="whitespace-pre-wrap text-sm text-slate-700">{row.notes}</p>
            </Panel>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Details">
            <dl className="grid gap-3 text-sm">
              <Detail label="Payment number" value={row.paymentNumber} />
              <Detail label="Customer" value={row.customer?.displayName} />
              <Detail label="Reference" value={row.reference} />
              <Detail label="Recorded by" value={row.createdBy ? `${row.createdBy.firstName} ${row.createdBy.lastName}` : null} />
              <Detail label="Created" value={formatDate(row.createdAt)} />
              <Detail label="Updated" value={formatDate(row.updatedAt)} />
            </dl>
          </Panel>

          <Panel title="Activity">
            {audit.isPending ? <p className="text-sm text-slate-500">Loading activity…</p> : null}
            {audit.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(audit.error)}</p> : null}
            {!audit.isPending && !audit.isError && auditRows.length === 0 ? (
              <p className="text-sm text-slate-500">No activity recorded yet.</p>
            ) : null}
            <ol className="flex flex-col gap-3">
              {auditRows.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{event.action.replaceAll(".", " ")}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete payment"
        description={`Delete ${row.paymentNumber}? The invoice paid amount and status will be recalculated.`}
        confirmLabel="Delete payment"
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setDeleteOpen(false)}
      />
    </section>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  INVOICE_STATUS_TRANSITIONS,
  changeInvoiceStatus,
  deleteInvoice,
  getInvoice,
  listInvoiceAudit,
  restoreInvoice,
  type InvoiceStatus,
} from "./api.ts";
import { Detail, Metric, Panel, StatusPill, formatDate, formatMoney, statusLabel } from "../sales/shared.tsx";
import { PAYMENT_METHOD_LABELS, listPayments } from "../payments/api.ts";

export default function InvoiceDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission("invoices:update");
  const canDelete = useHasPermission("invoices:delete");
  const canRestore = useHasPermission("invoices:restore");
  const canCreatePayment = useHasPermission("payments:create");

  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<InvoiceStatus | "">("");
  const [amountPaid, setAmountPaid] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const invoice = useQuery({ queryKey: ["invoices", id], queryFn: () => getInvoice(id), enabled: Boolean(id) });
  const audit = useQuery({
    queryKey: ["invoices", id, "audit"],
    queryFn: () => listInvoiceAudit(id),
    enabled: Boolean(id),
  });
  const payments = useQuery({
    queryKey: ["payments", { invoiceId: id }],
    queryFn: () => listPayments({ invoiceId: id, limit: 50 }),
    enabled: Boolean(id),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["payments"] }),
    ]);
  };

  const changeStatus = useMutation({
    mutationFn: () =>
      changeInvoiceStatus(id, {
        status: targetStatus as InvoiceStatus,
        amountPaid: amountPaid || undefined,
      }),
    onSuccess: async () => {
      setStatusOpen(false);
      setTargetStatus("");
      setAmountPaid("");
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => deleteInvoice(id),
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
    mutationFn: () => restoreInvoice(id),
    onSuccess: refresh,
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  if (invoice.isPending) {
    return <p className="text-sm text-slate-500">Loading invoice…</p>;
  }
  if (invoice.isError || !invoice.data) {
    return <p className="text-sm text-red-700">{invoice.isError ? getApiErrorMessage(invoice.error) : "Invoice not found"}</p>;
  }

  const row = invoice.data;
  const allowedStatuses = INVOICE_STATUS_TRANSITIONS[row.status] ?? [];
  const canEdit = canUpdate && row.status === "DRAFT" && !row.deletedAt;
  const lines = row.lines ?? [];
  const auditRows = audit.data?.items ?? [];
  const paymentRows = payments.data?.items ?? [];
  const balance = Number(row.total) - Number(row.amountPaid);
  const canReceivePayment = canCreatePayment && ["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(row.status);

  function openStatus(next: InvoiceStatus) {
    setTargetStatus(next);
    setAmountPaid(next === "PARTIALLY_PAID" ? Number(row.amountPaid) > 0 ? row.amountPaid : "" : "");
    setStatusOpen(true);
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="border-b border-slate-200 pb-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          <Link className="hover:underline" to="/invoices">
            Sales / Invoices
          </Link>
          <span className="text-slate-400">/</span>
          <span className="font-mono text-slate-500">{row.invoiceNumber}</span>
        </p>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-950">{row.customer?.displayName ?? "Invoice"}</h1>
              <StatusPill status={row.status} deleted={Boolean(row.deletedAt)} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Issued {formatDate(row.issueDate)} · Due {formatDate(row.dueDate)}
              {row.sourceSalesOrder ? (
                <>
                  {" · From "}
                  <Link className="font-medium text-brand-800 hover:underline" to={`/sales-orders/${row.sourceSalesOrder.id}`}>
                    {row.sourceSalesOrder.salesOrderNumber}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.deletedAt ? (
              canRestore ? (
                <Button className="bg-emerald-700 hover:bg-emerald-800" disabled={restore.isPending} onClick={() => restore.mutate()}>
                  {restore.isPending ? "Restoring…" : "Restore invoice"}
                </Button>
              ) : null
            ) : (
              <>
                {canEdit ? (
                  <Link to={`/invoices/${row.id}/edit`}>
                    <Button variant="secondary">Edit</Button>
                  </Link>
                ) : null}
                {canReceivePayment ? (
                  <Link to={`/payments/new?invoiceId=${row.id}`}>
                    <Button className="bg-brand-800 hover:bg-brand-900">Receive payment</Button>
                  </Link>
                ) : null}
                {canUpdate && allowedStatuses.length > 0 ? (
                  <Button variant="secondary" onClick={() => openStatus(allowedStatuses[0])}>
                    Update status
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
            This invoice was deleted on {row.deletedAt.slice(0, 10)}.
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {actionError}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Total" value={formatMoney(row.total, row.currencyCode)} />
        <Metric label="Paid" value={formatMoney(row.amountPaid, row.currencyCode)} />
        <Metric label="Balance" value={formatMoney(balance, row.currencyCode)} />
        <Metric label="Tax" value={formatMoney(row.taxTotal, row.currencyCode)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="flex flex-col gap-4">
          <Panel title="Lines">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 pr-3 text-right">Qty</th>
                    <th className="py-2 pr-3 text-right">Unit price</th>
                    <th className="py-2 pr-3 text-right">Tax</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id ?? line.sortOrder} className="border-b border-slate-100">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-slate-800">{line.productName}</p>
                        {line.description ? <p className="text-xs text-slate-500">{line.description}</p> : null}
                        <p className="font-mono text-[11px] text-slate-400">{line.productCode ?? "—"}</p>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{Number(line.quantity).toFixed(2)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(line.unitPrice, row.currencyCode)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(line.lineTax, row.currencyCode)}</td>
                      <td className="py-2 text-right font-medium tabular-nums">{formatMoney(line.lineTotal, row.currencyCode)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="pt-3 text-right text-slate-500">
                      Subtotal
                    </td>
                    <td className="pt-3 text-right tabular-nums">{formatMoney(row.subtotal, row.currencyCode)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="text-right text-slate-500">
                      Discount
                    </td>
                    <td className="text-right tabular-nums">{formatMoney(row.discountTotal, row.currencyCode)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="text-right text-slate-500">
                      Tax
                    </td>
                    <td className="text-right tabular-nums">{formatMoney(row.taxTotal, row.currencyCode)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="border-t border-slate-200 pt-2 text-right font-semibold text-slate-900">
                      Total
                    </td>
                    <td className="border-t border-slate-200 pt-2 text-right font-semibold tabular-nums text-slate-950">
                      {formatMoney(row.total, row.currencyCode)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>

          {row.notes || row.terms ? (
            <Panel title="Notes & terms">
              {row.notes ? <p className="whitespace-pre-wrap text-sm text-slate-700">{row.notes}</p> : null}
              {row.terms ? <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{row.terms}</p> : null}
            </Panel>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Details">
            <dl className="grid gap-3 text-sm">
              <Detail label="Status" value={statusLabel(row.status)} />
              <Detail label="Currency" value={row.currencyCode} />
              <Detail label="Payment term" value={row.paymentTerm ? `${row.paymentTerm.name} (${row.paymentTerm.dueDays} days)` : null} />
              <Detail label="Customer reference" value={row.customerReference} />
              <Detail label="Owner" value={row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : null} />
              <Detail label="Sent" value={formatDate(row.sentAt)} />
              <Detail label="Paid" value={formatDate(row.paidAt)} />
              <Detail label="Voided" value={formatDate(row.voidedAt)} />
              <Detail label="Created" value={formatDate(row.createdAt)} />
            </dl>
          </Panel>

          <Panel title={`Payments${paymentRows.length > 0 ? ` (${paymentRows.length})` : ""}`}>
            {payments.isPending ? <p className="text-sm text-slate-500">Loading payments…</p> : null}
            {payments.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(payments.error)}</p> : null}
            {!payments.isPending && !payments.isError && paymentRows.length === 0 ? (
              <p className="text-sm text-slate-500">No payments received yet.</p>
            ) : null}
            <ul className="flex flex-col divide-y divide-slate-100">
              {paymentRows.map((payment) => (
                <li key={payment.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link
                      className="font-mono text-xs font-medium text-brand-800 hover:underline"
                      to={`/payments/${payment.id}`}
                    >
                      {payment.paymentNumber}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {PAYMENT_METHOD_LABELS[payment.method]} · {formatDate(payment.receivedDate)}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-medium tabular-nums text-slate-800">
                    {formatMoney(payment.amount, payment.currencyCode)}
                  </span>
                </li>
              ))}
            </ul>
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
      </div>

      <Modal
        open={statusOpen}
        title="Update invoice status"
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
            onChange={(event) => setTargetStatus(event.target.value as InvoiceStatus | "")}
          >
            <option value="">Choose a status</option>
            {allowedStatuses.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
          {targetStatus === "PAID" || targetStatus === "PARTIALLY_PAID" ? (
            <>
              <label className="text-sm font-medium text-slate-700" htmlFor="amountPaid">
                Amount received
              </label>
              <Input
                id="amountPaid"
                inputMode="decimal"
                placeholder={targetStatus === "PAID" ? `Defaults to ${row.total}` : "Enter amount received"}
                value={amountPaid}
                onChange={(event) => setAmountPaid(event.target.value)}
              />
            </>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete invoice"
        description={`Delete ${row.invoiceNumber}? Only unpaid draft or void invoices can be deleted.`}
        confirmLabel="Delete invoice"
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setDeleteOpen(false)}
      />
    </section>
  );
}

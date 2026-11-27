import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PrintPreviewModal } from "@/components/documents/PrintPreviewModal.tsx";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { purchasingKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  PURCHASING_PERMISSIONS,
  approveVendorPayment,
  deleteVendorPayment,
  getVendorPayment,
  restoreVendorPayment,
} from "../api.ts";
import {
  Detail,
  ErrorState,
  LoadingState,
  MetricCard,
  MetricGrid,
  Panel,
  StatusPill,
  buildPrintableProps,
  docNumber,
  formatDate,
  formatMoney,
  paymentAllocated,
  statusLabel,
} from "../shared.tsx";

export default function VendorPaymentDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission(PURCHASING_PERMISSIONS.update);
  const canApprove = useHasPermission("purchasing:approve");
  const canDelete = useHasPermission(PURCHASING_PERMISSIONS.delete);
  const canRestore = useHasPermission(PURCHASING_PERMISSIONS.restore);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const payment = useQuery({ queryKey: purchasingKeys.payments.detail(id), queryFn: () => getVendorPayment(id), enabled: Boolean(id) });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: purchasingKeys.payments.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.bills.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
    ]);
  };

  const approve = useMutation({
    mutationFn: () => approveVendorPayment(id),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => deleteVendorPayment(id),
    onSuccess: async () => {
      setDeleteOpen(false);
      await navigate("/purchasing/payments");
    },
    onError: (error) => {
      setDeleteOpen(false);
      setActionError(getApiErrorMessage(error));
    },
  });

  const restore = useMutation({
    mutationFn: () => restoreVendorPayment(id),
    onSuccess: refresh,
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  if (payment.isPending) {
    return <LoadingState label="Loading vendor payment…" />;
  }
  if (payment.isError || !payment.data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <ErrorState
          message={payment.isError ? getApiErrorMessage(payment.error) : "Vendor payment not found"}
          onRetry={() => payment.refetch()}
          backTo="/purchasing/payments"
          backLabel="Back to payments"
        />
      </div>
    );
  }

  const row = payment.data;
  const allocations = row.allocations ?? [];
  const printProps = buildPrintableProps({
    type: "VENDOR PAYMENT",
    documentNumber: docNumber(row),
    date: formatDate(row.paidDate),
    paymentTerms: "",
    partyName: row.vendor?.displayName ?? row.vendor?.name ?? "Vendor",
    partyAddress: row.vendor?.email ?? undefined,
    taxId: row.vendor?.legalName ?? undefined,
    lines: allocations.map((line) => ({
      id: line.id ?? line.billId,
      name: line.bill?.billNumber ?? `Bill ${line.billId.slice(0, 8)}`,
      description: "Payment allocation",
      quantity: "1",
      unitPrice: line.amount,
      lineTotal: line.amount,
    })),
    subtotal: paymentAllocated(row),
    taxAmount: "0",
    total: row.amount,
    notes: row.notes ?? row.reference ?? undefined,
    currencyCode: row.currencyCode,
  });

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="border-b border-slate-200 pb-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          <Link className="hover:underline" to="/purchasing/payments">Purchasing / Payments</Link>
          <span className="text-slate-400">/</span>
          <span className="font-mono text-slate-500">{docNumber(row)}</span>
        </p>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-950">{docNumber(row)}</h1>
              <StatusPill status={row.status} deleted={Boolean(row.deletedAt)} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {row.vendor?.displayName ?? row.vendor?.name ?? "Vendor"} · Paid {formatDate(row.paidDate)} · {statusLabel(row.method)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.deletedAt ? (
              canRestore ? (
                <Button className="bg-emerald-700 hover:bg-emerald-800" disabled={restore.isPending} onClick={() => restore.mutate()}>
                  {restore.isPending ? "Restoring…" : "Restore payment"}
                </Button>
              ) : null
            ) : (
              <>
                {canUpdate && row.status === "DRAFT" ? (
                  <Link to={`/purchasing/payments/${id}/edit`}>
                    <Button variant="secondary">Edit</Button>
                  </Link>
                ) : null}
                {canApprove && row.status === "DRAFT" ? (
                  <Button className="bg-brand-800 hover:bg-brand-900" disabled={approve.isPending} onClick={() => approve.mutate()}>
                    {approve.isPending ? "Approving…" : "Approve payment"}
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => setPrintOpen(true)}>Print preview</Button>
                {canDelete && row.status === "DRAFT" ? (
                  <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>Delete</Button>
                ) : null}
              </>
            )}
          </div>
        </div>
        {row.status === "PAID" ? (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            This payment is approved and allocated to the bills shown below.
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {actionError}
          </p>
        ) : null}
      </div>

      <MetricGrid>
        <MetricCard label="Amount" value={formatMoney(row.amount, row.currencyCode)} hint="Payment total" />
        <MetricCard label="Allocated" value={formatMoney(paymentAllocated(row), row.currencyCode)} hint="Applied to bills" />
        <MetricCard label="Bills" value={String(allocations.length)} hint="Linked allocations" />
        <MetricCard label="Status" value={statusLabel(row.status)} hint="Workflow state" />
      </MetricGrid>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <Panel title="Bill allocations">
          {allocations.length === 0 ? (
            <p className="text-sm text-slate-500">No bills are linked to this payment.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Bill</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((line, index) => (
                  <tr key={line.id ?? line.billId ?? index} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      <Link className="font-medium text-brand-800 hover:underline" to={`/purchasing/bills/${line.billId}`}>
                        {line.bill?.billNumber ?? line.billId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">{formatMoney(line.amount, row.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {row.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{row.notes}</p> : null}
        </Panel>

        <Panel title="Details">
          <dl className="grid gap-3 text-sm">
            <Detail label="Payment number" value={docNumber(row)} />
            <Detail label="Vendor" value={row.vendor?.displayName ?? row.vendor?.name ?? null} />
            <Detail label="Status" value={statusLabel(row.status)} />
            <Detail label="Paid date" value={formatDate(row.paidDate)} />
            <Detail label="Method" value={statusLabel(row.method)} />
            <Detail label="Currency" value={row.currencyCode} />
            <Detail label="Reference" value={row.reference} />
            <Detail label="Bank account" value={row.bankAccount} />
            <Detail label="Approved" value={formatDate(row.approvedAt)} />
            <Detail label="Created" value={formatDate(row.createdAt)} />
          </dl>
        </Panel>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete vendor payment"
        description={`Delete ${docNumber(row)}? This payment can be restored later with the right permission.`}
        confirmLabel="Delete payment"
        danger
        busy={remove.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
      />

      <PrintPreviewModal isOpen={printOpen} onClose={() => setPrintOpen(false)} docProps={printProps} />
    </section>
  );
}

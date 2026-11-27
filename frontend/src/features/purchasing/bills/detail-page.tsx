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
  approveVendorBill,
  deleteVendorBill,
  getVendorBill,
  restoreVendorBill,
  voidVendorBill,
} from "../api.ts";
import {
  Detail,
  ErrorState,
  LoadingState,
  MetricCard,
  MetricGrid,
  Panel,
  StatusPill,
  billBalance,
  buildPrintableProps,
  docNumber,
  formatDate,
  formatMoney,
  formatQuantity,
  numberValue,
  statusLabel,
} from "../shared.tsx";

export default function VendorBillDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission(PURCHASING_PERMISSIONS.update);
  const canApprove = useHasPermission("purchasing:approve");
  const canCreate = useHasPermission(PURCHASING_PERMISSIONS.create);
  const canDelete = useHasPermission(PURCHASING_PERMISSIONS.delete);
  const canRestore = useHasPermission(PURCHASING_PERMISSIONS.restore);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const bill = useQuery({ queryKey: purchasingKeys.bills.detail(id), queryFn: () => getVendorBill(id), enabled: Boolean(id) });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: purchasingKeys.bills.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.payments.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.orders.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
    ]);
  };

  const approve = useMutation({
    mutationFn: () => approveVendorBill(id),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  const voidBill = useMutation({
    mutationFn: () => voidVendorBill(id),
    onSuccess: async () => {
      setVoidOpen(false);
      await refresh();
    },
    onError: (error) => {
      setVoidOpen(false);
      setActionError(getApiErrorMessage(error));
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteVendorBill(id),
    onSuccess: async () => {
      setDeleteOpen(false);
      await navigate("/purchasing/bills");
    },
    onError: (error) => {
      setDeleteOpen(false);
      setActionError(getApiErrorMessage(error));
    },
  });

  const restore = useMutation({
    mutationFn: () => restoreVendorBill(id),
    onSuccess: refresh,
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  if (bill.isPending) {
    return <LoadingState label="Loading vendor bill…" />;
  }
  if (bill.isError || !bill.data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <ErrorState
          message={bill.isError ? getApiErrorMessage(bill.error) : "Vendor bill not found"}
          onRetry={() => bill.refetch()}
          backTo="/purchasing/bills"
          backLabel="Back to bills"
        />
      </div>
    );
  }

  const row = bill.data;
  const lines = row.lines ?? [];
  const payments = row.payments ?? [];
  const balance = billBalance(row);
  const printProps = buildPrintableProps({
    type: "VENDOR BILL",
    documentNumber: docNumber(row),
    date: formatDate(row.billDate),
    dueDate: formatDate(row.dueDate),
    paymentTerms: row.paymentTerm ? `${row.paymentTerm.name} (${row.paymentTerm.dueDays} days)` : undefined,
    partyName: row.vendor?.displayName ?? row.vendor?.name ?? "Vendor",
    partyAddress: row.vendor?.email ?? undefined,
    taxId: row.vendor?.legalName ?? undefined,
    lines: lines.map((line) => ({
      id: line.id,
      name: line.productName ?? line.description ?? "Item",
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxAmount: line.lineTax,
      lineTotal: line.lineTotal,
    })),
    subtotal: row.subtotal,
    taxAmount: row.taxTotal,
    total: row.total,
    notes: row.notes ?? undefined,
    currencyCode: row.currencyCode,
  });

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="border-b border-slate-200 pb-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          <Link className="hover:underline" to="/purchasing/bills">Purchasing / Bills</Link>
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
              {row.vendor?.displayName ?? row.vendor?.name ?? "Vendor"} · Billed {formatDate(row.billDate)} · Due {formatDate(row.dueDate)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.deletedAt ? (
              canRestore ? (
                <Button className="bg-emerald-700 hover:bg-emerald-800" disabled={restore.isPending} onClick={() => restore.mutate()}>
                  {restore.isPending ? "Restoring…" : "Restore bill"}
                </Button>
              ) : null
            ) : (
              <>
                {canUpdate && row.status === "DRAFT" ? (
                  <Link to={`/purchasing/bills/${id}/edit`}>
                    <Button variant="secondary">Edit</Button>
                  </Link>
                ) : null}
                {canApprove && row.status === "DRAFT" ? (
                  <Button className="bg-brand-800 hover:bg-brand-900" disabled={approve.isPending} onClick={() => approve.mutate()}>
                    {approve.isPending ? "Approving…" : "Approve bill"}
                  </Button>
                ) : null}
                {canCreate && balance > 0 && (row.status === "APPROVED" || row.status === "PARTIALLY_PAID") && !row.deletedAt ? (
                  <Link to={`/purchasing/payments/new?vendorId=${row.vendorId}&billId=${row.id}`}>
                    <Button variant="secondary">Record payment</Button>
                  </Link>
                ) : null}
                {canApprove && (row.status === "APPROVED" || row.status === "PARTIALLY_PAID") ? (
                  <Button variant="ghost" className="text-amber-800 hover:bg-amber-50" onClick={() => setVoidOpen(true)}>Void</Button>
                ) : null}
                <Button variant="secondary" onClick={() => setPrintOpen(true)}>Print preview</Button>
                {canDelete && row.status === "DRAFT" ? (
                  <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>Delete</Button>
                ) : null}
              </>
            )}
          </div>
        </div>
        {actionError ? (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {actionError}
          </p>
        ) : null}
      </div>

      <MetricGrid>
        <MetricCard label="Total" value={formatMoney(row.total, row.currencyCode)} hint="Gross bill value" />
        <MetricCard label="Amount paid" value={formatMoney(row.amountPaid ?? "0", row.currencyCode)} hint="Allocated payments" />
        <MetricCard label="Balance" value={formatMoney(balance, row.currencyCode)} hint="Still payable" />
        <MetricCard label="Lines" value={String(lines.length)} hint="Billed items" />
      </MetricGrid>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="flex flex-col gap-4">
          <Panel title="Bill lines">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3 text-right">Qty</th>
                    <th className="py-2 pr-3 text-right">Unit price</th>
                    <th className="py-2 pr-3 text-right">Tax</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.id ?? index} className="border-b border-slate-100">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-slate-800">{line.productName ?? line.description ?? "Item"}</p>
                        {line.description ? <p className="text-xs text-slate-500">{line.description}</p> : null}
                        <p className="font-mono text-[11px] text-slate-400">{line.productCode ?? "—"}</p>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatQuantity(line.quantity)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(line.unitPrice, row.currencyCode)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(line.lineTax, row.currencyCode)}</td>
                      <td className="py-2 text-right font-medium tabular-nums">{formatMoney(line.lineTotal, row.currencyCode)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="pt-3 text-right font-semibold text-slate-900">Bill total</td>
                    <td className="pt-3 text-right font-semibold tabular-nums text-slate-950">{formatMoney(numberValue(row.total), row.currencyCode)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>

          <Panel title="Linked payments">
            {payments.length === 0 ? (
              <p className="text-sm text-slate-500">No payments have been allocated to this bill.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2">
                    <Link className="font-medium text-brand-800 hover:underline" to={`/purchasing/payments/${payment.id}`}>
                      {payment.paymentNumber ?? payment.id.slice(0, 8)}
                    </Link>
                    <span className="text-xs text-slate-500">{formatDate(payment.paidDate)}</span>
                    <span className="tabular-nums text-slate-800">{formatMoney(payment.amount, row.currencyCode)}</span>
                  </li>
                ))}
              </ul>
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
              <Detail label="Bill number" value={docNumber(row)} />
              <Detail label="Vendor" value={row.vendor?.displayName ?? row.vendor?.name ?? null} />
              <Detail label="Purchase order" value={row.purchaseOrder ? docNumber(row.purchaseOrder) : "Standalone"} />
              <Detail label="Status" value={statusLabel(row.status)} />
              <Detail label="Currency" value={row.currencyCode} />
              <Detail label="Payment term" value={row.paymentTerm ? `${row.paymentTerm.name} (${row.paymentTerm.dueDays} days)` : null} />
              <Detail label="Vendor reference" value={row.vendorReference} />
              <Detail label="Expense account" value={row.expenseAccount} />
              <Detail label="Liability account" value={row.liabilityAccount} />
              <Detail label="Approved" value={formatDate(row.approvedAt)} />
              <Detail label="Voided" value={formatDate(row.voidedAt)} />
              <Detail label="Created" value={formatDate(row.createdAt)} />
            </dl>
            {row.purchaseOrderId ? (
              <Link className="mt-4 inline-flex text-sm font-medium text-brand-800 hover:underline" to={`/purchasing/orders/${row.purchaseOrderId}`}>
                View purchase order
              </Link>
            ) : null}
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={voidOpen}
        title="Void vendor bill"
        description={`Void ${docNumber(row)}? This removes the bill from payable balances.`}
        confirmLabel="Void bill"
        danger
        busy={voidBill.isPending}
        onCancel={() => setVoidOpen(false)}
        onConfirm={() => voidBill.mutate()}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete vendor bill"
        description={`Delete ${docNumber(row)}? This bill can be restored later with the right permission.`}
        confirmLabel="Delete bill"
        danger
        busy={remove.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
      />

      <PrintPreviewModal isOpen={printOpen} onClose={() => setPrintOpen(false)} docProps={printProps} />
    </section>
  );
}

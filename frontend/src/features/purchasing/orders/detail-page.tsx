import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { PrintPreviewModal } from "@/components/documents/PrintPreviewModal.tsx";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { purchasingKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  PURCHASE_ORDER_STATUS_TRANSITIONS,
  PURCHASING_PERMISSIONS,
  changePurchaseOrderStatus,
  deletePurchaseOrder,
  getPurchaseOrder,
  restorePurchaseOrder,
  type PurchaseOrderStatus,
} from "../api.ts";
import {
  Detail,
  ErrorState,
  LoadingState,
  MetricCard,
  MetricGrid,
  Panel,
  PURCHASE_ORDER_MANUAL_STATUSES,
  PURCHASING_APPROVE_PERMISSION,
  StatusPill,
  buildPrintableProps,
  docNumber,
  formatDate,
  formatMoney,
  formatQuantity,
  remainingQuantity,
  statusLabel,
} from "../shared.tsx";

export default function PurchaseOrderDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission(PURCHASING_PERMISSIONS.update);
  const canApprove = useHasPermission(PURCHASING_APPROVE_PERMISSION);
  const canDelete = useHasPermission(PURCHASING_PERMISSIONS.delete);
  const canRestore = useHasPermission(PURCHASING_PERMISSIONS.restore);
  const canCreate = useHasPermission(PURCHASING_PERMISSIONS.create);

  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<PurchaseOrderStatus | "">("");
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const order = useQuery({ queryKey: purchasingKeys.orders.detail(id), queryFn: () => getPurchaseOrder(id), enabled: Boolean(id) });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: purchasingKeys.orders.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.bills.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.receipts.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
    ]);
  };

  const changeStatus = useMutation({
    mutationFn: () => changePurchaseOrderStatus(id, targetStatus as PurchaseOrderStatus, reason),
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
    mutationFn: () => deletePurchaseOrder(id),
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
    mutationFn: () => restorePurchaseOrder(id),
    onSuccess: refresh,
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  if (order.isPending) {
    return <LoadingState label="Loading purchase order…" />;
  }
  if (order.isError || !order.data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <ErrorState
          message={order.isError ? getApiErrorMessage(order.error) : "Purchase order not found"}
          onRetry={() => order.refetch()}
          backTo="/purchasing/orders"
          backLabel="Back to orders"
        />
      </div>
    );
  }

  const row = order.data;
  const lines = row.lines ?? [];
  const transitions = (PURCHASE_ORDER_STATUS_TRANSITIONS[row.status] ?? []).filter((status) =>
    PURCHASE_ORDER_MANUAL_STATUSES.includes(status as (typeof PURCHASE_ORDER_MANUAL_STATUSES)[number]),
  );
  const canChangeStatus = (status: PurchaseOrderStatus) =>
    status === "APPROVED" || status === "SENT" ? canApprove : canUpdate;
  const allowedTransitions = transitions.filter(canChangeStatus);
  const canEdit = canUpdate && row.status === "DRAFT" && !row.deletedAt;
  const canReceive = canCreate && !row.deletedAt && ["APPROVED", "SENT", "PARTIALLY_RECEIVED"].includes(row.status);
  const canBill = canCreate && !row.deletedAt && ["RECEIVED", "PARTIALLY_RECEIVED", "SENT"].includes(row.status);
  const printProps = buildPrintableProps({
    type: "PURCHASE ORDER",
    documentNumber: docNumber(row),
    date: formatDate(row.orderDate ?? row.issueDate),
    dueDate: formatDate(row.expectedDeliveryDate),
    paymentTerms: row.paymentTerm ? `${row.paymentTerm.name} (${row.paymentTerm.dueDays} days)` : undefined,
    partyName: row.vendor?.displayName ?? row.vendor?.name ?? "Vendor",
    partyAddress: row.vendor?.email ?? undefined,
    taxId: row.vendor?.legalName ?? undefined,
    lines: lines.map((line) => ({
      id: line.id,
      name: line.productName,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxAmount: line.lineTax,
      lineTotal: line.lineTotal,
    })),
    subtotal: row.subtotal,
    taxAmount: row.taxTotal,
    total: row.total,
    notes: row.notes ?? row.terms ?? undefined,
    currencyCode: row.currencyCode,
  });

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="border-b border-slate-200 pb-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          <Link className="hover:underline" to="/purchasing/orders">Purchasing / Orders</Link>
          <span className="text-slate-400">/</span>
          <span className="font-mono text-slate-500">{docNumber(row)}</span>
        </p>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-950">{row.vendor?.displayName ?? row.vendor?.name ?? "Vendor"}</h1>
              <StatusPill status={row.status} deleted={Boolean(row.deletedAt)} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Issued {formatDate(row.orderDate ?? row.issueDate)} · Expected {formatDate(row.expectedDeliveryDate)} · {row.currencyCode}
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
                  {restore.isPending ? "Restoring…" : "Restore order"}
                </Button>
              ) : null
            ) : (
              <>
                {canEdit ? (
                  <Link to={`/purchasing/orders/${id}/edit`}>
                    <Button variant="secondary">Edit</Button>
                  </Link>
                ) : null}
                {allowedTransitions.length > 0 && !row.deletedAt ? (
                  <Button variant="secondary" onClick={() => setStatusOpen(true)}>Change status</Button>
                ) : null}
                {canReceive ? (
                  <Link to={`/purchasing/receipts/new?purchaseOrderId=${id}`}>
                    <Button variant="secondary">Receive goods</Button>
                  </Link>
                ) : null}
                {canBill ? (
                  <Link to={`/purchasing/bills/new?purchaseOrderId=${id}`}>
                    <Button className="bg-brand-800 hover:bg-brand-900">Create bill</Button>
                  </Link>
                ) : null}
                <Button variant="secondary" onClick={() => setPrintOpen(true)}>Print preview</Button>
                {canDelete ? (
                  <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>Delete</Button>
                ) : null}
              </>
            )}
          </div>
        </div>
        {row.deletedAt ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This purchase order was deleted on {formatDate(row.deletedAt)}.
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {actionError}
          </p>
        ) : null}
      </div>

      <MetricGrid>
        <MetricCard label="Total" value={formatMoney(row.total, row.currencyCode)} hint="Order value" />
        <MetricCard label="Subtotal" value={formatMoney(row.subtotal ?? "0", row.currencyCode)} hint="Before tax" />
        <MetricCard label="Tax" value={formatMoney(row.taxTotal ?? "0", row.currencyCode)} hint="Assessed tax" />
        <MetricCard label="Lines" value={String(lines.length)} hint="Items ordered" />
      </MetricGrid>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="flex flex-col gap-4">
          <Panel title="Order lines">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3 text-right">Ordered</th>
                    <th className="py-2 pr-3 text-right">Received</th>
                    <th className="py-2 pr-3 text-right">Unit price</th>
                    <th className="py-2 pr-3 text-right">Tax</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.id ?? line.purchaseOrderLineId ?? index} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-slate-800">{line.productName}</p>
                        {line.description ? <p className="text-xs text-slate-500">{line.description}</p> : null}
                        <p className="font-mono text-[11px] text-slate-400">{line.productCode ?? "—"}</p>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatQuantity(line.quantity)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatQuantity(line.receivedQuantity ?? "0")}
                        {remainingQuantity(line) > 0 ? (
                          <span className="mt-0.5 block text-[11px] text-amber-700">{formatQuantity(remainingQuantity(line))} open</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(line.unitPrice, row.currencyCode)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(line.lineTax, row.currencyCode)}</td>
                      <td className="py-2 text-right font-medium tabular-nums">{formatMoney(line.lineTotal, row.currencyCode)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} className="pt-3 text-right font-semibold text-slate-900">Order total</td>
                    <td className="pt-3 text-right font-semibold tabular-nums text-slate-950">{formatMoney(row.total, row.currencyCode)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>

          <Panel title="Goods receipts">
            {(row.receipts ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No receipts recorded against this order.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {row.receipts?.map((receipt) => (
                  <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-2">
                    <Link className="font-medium text-brand-800 hover:underline" to={`/purchasing/receipts/${receipt.id}`}>
                      {receipt.receiptNumber ?? receipt.id.slice(0, 8)}
                    </Link>
                    <StatusPill status={receipt.status} />
                    <span className="text-xs text-slate-500">{formatDate(receipt.receiptDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Vendor bills">
            {(row.bills ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No bills linked to this order.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {row.bills?.map((bill) => (
                  <li key={bill.id} className="flex flex-wrap items-center justify-between gap-2">
                    <Link className="font-medium text-brand-800 hover:underline" to={`/purchasing/bills/${bill.id}`}>
                      {bill.billNumber ?? bill.id.slice(0, 8)}
                    </Link>
                    <StatusPill status={bill.status} />
                    <span className="tabular-nums text-slate-800">{formatMoney(bill.total, row.currencyCode)}</span>
                  </li>
                ))}
              </ul>
            )}
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
              <Detail label="Order number" value={docNumber(row)} />
              <Detail label="Vendor" value={row.vendor?.displayName ?? row.vendor?.name ?? null} />
              <Detail label="Status" value={statusLabel(row.status)} />
              <Detail label="Currency" value={row.currencyCode} />
              <Detail label="Payment term" value={row.paymentTerm ? `${row.paymentTerm.name} (${row.paymentTerm.dueDays} days)` : null} />
              <Detail label="Vendor reference" value={row.vendorReference} />
              <Detail label="Approved" value={formatDate(row.approvedAt)} />
              <Detail label="Sent" value={formatDate(row.sentAt)} />
              <Detail label="Received" value={formatDate(row.receivedAt)} />
              <Detail label="Billed" value={formatDate(row.billedAt)} />
              <Detail label="Created" value={formatDate(row.createdAt)} />
            </dl>
          </Panel>
          <Panel title="Status workflow">
            <ol className="flex flex-col gap-2 text-sm">
              {(["DRAFT", "APPROVED", "SENT", "PARTIALLY_RECEIVED", "RECEIVED", "BILLED", "CLOSED"] as PurchaseOrderStatus[]).map((status) => (
                <li key={status} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${row.status === status ? "bg-brand-600" : "bg-slate-300"}`} />
                  <span className={row.status === status ? "font-medium text-slate-900" : "text-slate-500"}>{statusLabel(status)}</span>
                </li>
              ))}
            </ol>
            {allowedTransitions.length > 0 && !row.deletedAt ? (
              <Button className="mt-4 w-full" variant="secondary" onClick={() => setStatusOpen(true)}>
                Move to next status
              </Button>
            ) : null}
          </Panel>
        </div>
      </div>

      <Modal
        open={statusOpen}
        title="Change purchase order status"
        onClose={changeStatus.isPending ? () => undefined : () => setStatusOpen(false)}
        footer={
          <>
            <Button variant="secondary" disabled={changeStatus.isPending} onClick={() => setStatusOpen(false)}>Cancel</Button>
            <Button disabled={changeStatus.isPending || !targetStatus} onClick={() => changeStatus.mutate()}>
              {changeStatus.isPending ? "Updating…" : "Update status"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <FormLabel label="New status" htmlFor="target-status">
            <select
              id="target-status"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={targetStatus}
              onChange={(event) => setTargetStatus(event.target.value as PurchaseOrderStatus | "")}
            >
              <option value="">Choose a status</option>
              {allowedTransitions.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
          </FormLabel>
          <FormLabel label="Reason (optional)" htmlFor="status-reason">
            <Input id="status-reason" value={reason} placeholder="Add context for the audit trail" onChange={(event) => setReason(event.target.value)} />
          </FormLabel>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete purchase order"
        description={`Delete ${docNumber(row)}? Orders with receipts or bills may not be deletable.`}
        confirmLabel="Delete order"
        danger
        busy={remove.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
      />

      <PrintPreviewModal isOpen={printOpen} onClose={() => setPrintOpen(false)} docProps={printProps} />
    </section>
  );
}

function FormLabel({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700" htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

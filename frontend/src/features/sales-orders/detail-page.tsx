import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PrintPreviewModal } from "@/components/documents/PrintPreviewModal.tsx";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { getCustomer } from "@/features/customers/api.ts";
import {
  SALES_ORDER_STATUS_TRANSITIONS,
  changeSalesOrderStatus,
  convertSalesOrderToInvoice,
  deleteSalesOrder,
  getSalesOrder,
  restoreSalesOrder,
  type SalesOrderStatus,
} from "./api.ts";
import { Detail, Metric, Panel, StatusPill, formatDate, formatMoney, statusLabel } from "../sales/shared.tsx";

export default function SalesOrderDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission("sales-orders:update");
  const canDelete = useHasPermission("sales-orders:delete");
  const canRestore = useHasPermission("sales-orders:restore");
  const canInvoice = useHasPermission("invoices:create");

  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<SalesOrderStatus | "">("");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const order = useQuery({ queryKey: ["sales-orders", id], queryFn: () => getSalesOrder(id), enabled: Boolean(id) });
  // Fetch full customer detail for billing/shipping address + tax number on print
  const orderCustomerId = order.data?.customerId;
  const customerDetail = useQuery({
    queryKey: ["customers", orderCustomerId],
    queryFn: () => getCustomer(orderCustomerId as string),
    enabled: Boolean(orderCustomerId),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["invoices"] }),
    ]);
  };

  const changeStatus = useMutation({
    mutationFn: () => changeSalesOrderStatus(id, targetStatus as SalesOrderStatus),
    onSuccess: async () => {
      setStatusOpen(false);
      setTargetStatus("");
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => deleteSalesOrder(id),
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
    mutationFn: () => restoreSalesOrder(id),
    onSuccess: refresh,
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  const invoice = useMutation({
    mutationFn: () =>
      convertSalesOrderToInvoice(id, {
        issueDate: issueDate || undefined,
        dueDate: dueDate || undefined,
      }),
    onSuccess: async (result) => {
      setInvoiceOpen(false);
      setActionError(null);
      await refresh();
      navigate(`/invoices/${result.invoice.id}`);
    },
    onError: (error) => {
      setInvoiceOpen(false);
      setActionError(getApiErrorMessage(error));
    },
  });

  if (order.isPending) {
    return <p className="text-sm text-slate-500">Loading sales order…</p>;
  }
  if (order.isError || !order.data) {
    return (
      <p className="text-sm text-red-700">
        {order.isError ? getApiErrorMessage(order.error) : "Sales order not found"}
      </p>
    );
  }

  const row = order.data;
  const allowedStatuses = SALES_ORDER_STATUS_TRANSITIONS[row.status] ?? [];
  const canEdit = canUpdate && row.status === "DRAFT" && !row.deletedAt;
  const canInvoiceNow = canInvoice && !row.deletedAt && ["CONFIRMED", "PROCESSING", "FULFILLED"].includes(row.status);
  const lines = row.lines ?? [];

  function openInvoice() {
    setIssueDate(today());
    setDueDate("");
    setInvoiceOpen(true);
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="border-b border-slate-200 pb-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          <Link className="hover:underline" to="/sales-orders">
            Sales / Sales orders
          </Link>
          <span className="text-slate-400">/</span>
          <span className="font-mono text-slate-500">{row.salesOrderNumber}</span>
        </p>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-950">{row.customer?.displayName ?? "Sales order"}</h1>
              <StatusPill status={row.status} deleted={Boolean(row.deletedAt)} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Ordered {formatDate(row.orderDate)} · Delivery {formatDate(row.expectedDeliveryDate)}
              {row.sourceQuote ? (
                <>
                  {" · From "}
                  <Link className="font-medium text-brand-800 hover:underline" to={`/quotes/${row.sourceQuote.id}`}>
                    {row.sourceQuote.quoteNumber}
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
                  <Link to={`/sales-orders/${row.id}/edit`}>
                    <Button variant="secondary">Edit</Button>
                  </Link>
                ) : null}
                {canUpdate && allowedStatuses.length > 0 ? (
                  <Button variant="secondary" onClick={() => setStatusOpen(true)}>
                    Change status
                  </Button>
                ) : null}
                {canInvoiceNow ? (
                  <Button className="bg-brand-800 hover:bg-brand-900" onClick={openInvoice}>
                    Create invoice
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => setPrintOpen(true)} className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print / PDF
                </Button>
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
            This sales order was deleted on {row.deletedAt.slice(0, 10)}.
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
        <Metric label="Subtotal" value={formatMoney(row.subtotal, row.currencyCode)} />
        <Metric label="Tax" value={formatMoney(row.taxTotal, row.currencyCode)} />
        <Metric label="Invoices" value={String(row._count?.invoices ?? 0)} />
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

          {row.invoices && row.invoices.length > 0 ? (
            <Panel title="Invoices">
              <ul className="flex flex-col gap-2 text-sm">
                {row.invoices.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                    <Link className="font-medium text-brand-800 hover:underline" to={`/invoices/${item.id}`}>
                      {item.invoiceNumber}
                    </Link>
                    <StatusPill status={item.status} />
                    <span className="text-xs text-slate-500">Due {formatDate(item.dueDate)}</span>
                    <span className="tabular-nums text-slate-800">{formatMoney(item.total, row.currencyCode)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

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
              <Detail label="Confirmed" value={formatDate(row.confirmedAt)} />
              <Detail label="Fulfilled" value={formatDate(row.fulfilledAt)} />
              <Detail label="Created" value={formatDate(row.createdAt)} />
            </dl>
          </Panel>
        </div>
      </div>

      <Modal
        open={statusOpen}
        title="Change sales order status"
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
            onChange={(event) => setTargetStatus(event.target.value as SalesOrderStatus | "")}
          >
            <option value="">Choose a status</option>
            {allowedStatuses.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </div>
      </Modal>

      <Modal
        open={invoiceOpen}
        title="Create invoice"
        onClose={invoice.isPending ? () => undefined : () => setInvoiceOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setInvoiceOpen(false)} disabled={invoice.isPending}>
              Cancel
            </Button>
            <Button className="bg-brand-800 hover:bg-brand-900" onClick={() => invoice.mutate()} disabled={invoice.isPending}>
              {invoice.isPending ? "Creating…" : "Create invoice"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-slate-700" htmlFor="invoiceIssueDate">
            Issue date
          </label>
          <Input id="invoiceIssueDate" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
          <label className="text-sm font-medium text-slate-700" htmlFor="invoiceDueDate">
            Due date
          </label>
          <Input id="invoiceDueDate" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <p className="text-xs text-slate-500">
            Leave the due date empty to use the payment term or 30 days by default.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete sales order"
        description={`Delete ${row.salesOrderNumber}? Orders with invoices cannot be deleted.`}
        confirmLabel="Delete order"
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setDeleteOpen(false)}
      />

      <PrintPreviewModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        docProps={{
          type: "SALES ORDER",
          documentNumber: row.salesOrderNumber,
          date: formatDate(row.orderDate),
          validUntilOrDueDate: row.expectedDeliveryDate ? formatDate(row.expectedDeliveryDate) : undefined,
          paymentTerms: row.paymentTerm?.name ?? "Due on receipt",
          customer: (() => {
            const cd = customerDetail.data;
            const billing = cd?.addresses?.find((a) => a.purpose === "BILLING" && a.isPrimary)
              ?? cd?.addresses?.find((a) => a.purpose === "BILLING")
              ?? cd?.addresses?.[0];
            const shipping = cd?.addresses?.find((a) => a.purpose === "SHIPPING" && a.isPrimary)
              ?? cd?.addresses?.find((a) => a.purpose === "SHIPPING");
            return {
              name: row.customer?.displayName ?? "Valued Customer",
              taxpayerId: cd?.taxNumber ?? row.customerReference ?? undefined,
              ntn: cd?.taxNumber ?? row.customerReference ?? undefined,
              billingAddress: billing ? {
                street: [billing.line1, billing.line2].filter(Boolean).join(", "),
                city: billing.city,
                postalCode: billing.postalCode ?? undefined,
                country: billing.countryCode,
              } : undefined,
              shippingAddress: shipping ? {
                street: [shipping.line1, shipping.line2].filter(Boolean).join(", "),
                city: shipping.city,
                postalCode: shipping.postalCode ?? undefined,
                country: shipping.countryCode,
              } : undefined,
            };
          })(),
          lines: (row.lines ?? []).map((l) => ({
            id: l.id,
            name: l.productName || l.productCode || "Item",
            description: l.description ?? undefined,
            taxable: Number(l.taxRate || 0) > 0 || Number(l.lineTax || 0) > 0,
            qty: Number(l.quantity || 1),
            unit: l.unitOfMeasure ? `/${l.unitOfMeasure.toLowerCase()}` : undefined,
            unitPrice: Number(l.unitPrice || 0),
            taxAmount: Number(l.lineTax || 0),
            amount: Number(l.lineSubtotal || l.lineTotal || 0),
          })),
          subtotal: Number(row.subtotal || 0),
          taxRate: row.lines && row.lines.length > 0 && row.lines[0].taxRate ? Number(row.lines[0].taxRate) : undefined,
          taxAmount: Number(row.taxTotal || 0),
          total: Number(row.total || 0),
          notes: row.notes ?? undefined,
          currencyCode: row.currencyCode || "PKR",
        }}
      />
    </section>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

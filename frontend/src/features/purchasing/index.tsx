import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { StatusPill, formatDate, formatMoney, statusLabel } from "../sales/shared.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import {
  PURCHASE_ORDER_STATUSES,
  PURCHASING_PERMISSIONS,
  listPurchaseOrders,
  listVendorBills,
  listGoodsReceipts,
  listVendorPayments,
} from "./api.ts";
import { MetricCard, PageHeader, WorkflowSteps, billBalance, docNumber, numberValue } from "./shared.tsx";

const PAGE_SIZE = 100;

export default function PurchasingDashboardPage() {
  const canRead = useHasPermission(PURCHASING_PERMISSIONS.read);
  const canCreateOrder = useHasPermission(PURCHASING_PERMISSIONS.create);
  const canCreateReceipt = useHasPermission(PURCHASING_PERMISSIONS.create);
  const canCreateBill = useHasPermission(PURCHASING_PERMISSIONS.create);
  const canCreatePayment = useHasPermission(PURCHASING_PERMISSIONS.create);

  const orders = useQuery({ queryKey: ["purchasing", "orders", "hub"], queryFn: () => listPurchaseOrders({ limit: PAGE_SIZE }), enabled: canRead });
  const receipts = useQuery({ queryKey: ["purchasing", "receipts", "hub"], queryFn: () => listGoodsReceipts({ limit: PAGE_SIZE }), enabled: canRead });
  const bills = useQuery({ queryKey: ["purchasing", "bills", "hub"], queryFn: () => listVendorBills({ limit: PAGE_SIZE }), enabled: canRead });
  const payments = useQuery({ queryKey: ["purchasing", "payments", "hub"], queryFn: () => listVendorPayments({ limit: PAGE_SIZE }), enabled: canRead });

  const orderRows = orders.data?.items ?? [];
  const receiptRows = receipts.data?.items ?? [];
  const billRows = bills.data?.items ?? [];
  const paymentRows = payments.data?.items ?? [];
  const currency = orderRows[0]?.currencyCode ?? billRows[0]?.currencyCode ?? paymentRows[0]?.currencyCode ?? "PKR";

  const openOrders = orderRows.filter((order) => ["APPROVED", "SENT", "PARTIALLY_RECEIVED"].includes(order.status) && !order.deletedAt);
  const awaitingApproval = orderRows.filter((order) => order.status === "DRAFT" && !order.deletedAt);
  const receivedNotBilled = orderRows.filter((order) => (order.status === "RECEIVED" || order.status === "PARTIALLY_RECEIVED") && (order.bills?.length ?? 0) === 0);
  const activeBills = billRows.filter((bill) => !bill.deletedAt && bill.status !== "VOID" && bill.status !== "DRAFT");
  const today = new Date().toISOString().slice(0, 10);
  const overdueBills = activeBills.filter((bill) => bill.dueDate && bill.dueDate < today && billBalance(bill) > 0);

  const metrics = [
    {
      label: "Open PO value",
      value: formatMoney(openOrders.reduce((sum, order) => sum + numberValue(order.total), 0), currency),
      hint: `${openOrders.length} approved, sent or partially received`,
      href: "/purchasing/orders",
    },
    {
      label: "Awaiting approval",
      value: String(awaitingApproval.length),
      hint: "Draft purchase orders ready for review",
      href: "/purchasing/orders?status=DRAFT",
    },
    {
      label: "Received not billed",
      value: formatMoney(receivedNotBilled.reduce((sum, order) => sum + numberValue(order.total), 0), currency),
      hint: `${receivedNotBilled.length} orders awaiting a vendor bill`,
      href: "/purchasing/bills",
    },
    {
      label: "Bills payable",
      value: formatMoney(activeBills.reduce((sum, bill) => sum + billBalance(bill), 0), currency),
      hint: `${activeBills.length} approved or partially paid bills`,
      href: "/purchasing/bills",
    },
    {
      label: "Overdue bills",
      value: formatMoney(overdueBills.reduce((sum, bill) => sum + billBalance(bill), 0), currency),
      hint: `${overdueBills.length} bills past their due date`,
      href: "/purchasing/bills?status=APPROVED",
    },
  ];

  const links = [
    { label: "Orders", href: "/purchasing/orders", note: `${orderRows.length} on file`, action: canCreateOrder ? "/purchasing/orders/new" : null },
    { label: "Receipts", href: "/purchasing/receipts", note: `${receiptRows.length} recorded`, action: canCreateReceipt ? "/purchasing/receipts/new" : null },
    { label: "Bills", href: "/purchasing/bills", note: `${billRows.length} on file`, action: canCreateBill ? "/purchasing/bills/new" : null },
    { label: "Payments", href: "/purchasing/payments", note: `${paymentRows.length} recorded`, action: canCreatePayment ? "/purchasing/payments/new" : null },
  ];

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <PageHeader
        section="Supply / Purchasing"
        title="Purchasing workspace"
        description="Approve orders, receive goods, match vendor bills and release payments from one place."
        actions={
          <>
            {canCreateOrder ? (
              <Link className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm text-slate-700 hover:bg-slate-50" to="/purchasing/receipts/new">
                Receive goods
              </Link>
            ) : null}
            {canCreateOrder ? (
              <Link className="inline-flex h-10 items-center rounded-md bg-brand-800 px-4 text-sm font-medium text-white hover:bg-brand-900" to="/purchasing/orders/new">
                New purchase order
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <WorkflowSteps
        steps={[
          { label: "Raise an order", description: "Choose a vendor and line items", href: "/purchasing/orders" },
          { label: "Approve & send", description: "Move drafts through status workflow", href: "/purchasing/orders" },
          { label: "Receive goods", description: "Record quantities against order lines", href: "/purchasing/receipts" },
          { label: "Match bills", description: "Capture vendor invoices and tax", href: "/purchasing/bills" },
          { label: "Pay vendors", description: "Allocate payments to open bills", href: "/purchasing/payments" },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((link) => (
          <div key={link.href} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link to={link.href} className="text-sm font-semibold text-slate-900 hover:text-brand-800 hover:underline">
                  {link.label}
                </Link>
                <p className="mt-1 text-xs text-slate-500">{link.note}</p>
              </div>
              {link.action ? (
                <Link to={link.action} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-brand-800 hover:bg-brand-50">
                  New
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Recent purchase orders</h2>
            <Link className="text-xs font-medium text-brand-800 hover:underline" to="/purchasing/orders">View all</Link>
          </div>
          <div className="p-4">
            {orders.isPending ? <p className="text-sm text-slate-500">Loading orders…</p> : null}
            {orders.isError ? <p className="text-sm text-red-700">{orderRows.length === 0 ? "Orders could not be loaded." : ""}</p> : null}
            {!orders.isPending && orderRows.length === 0 ? <p className="text-sm text-slate-500">No purchase orders yet.</p> : null}
            <ul className="flex flex-col divide-y divide-slate-100">
              {orderRows.slice(0, 6).map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link className="font-mono text-xs text-slate-500 hover:underline" to={`/purchasing/orders/${order.id}`}>
                      {docNumber(order)}
                    </Link>
                    <p className="truncate text-sm font-medium text-slate-800">{order.vendor?.displayName ?? order.vendor?.name ?? "Vendor"}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusPill status={order.status} />
                    <span className="text-xs tabular-nums text-slate-600">{formatMoney(order.total, order.currencyCode)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Bills due soon</h2>
            <Link className="text-xs font-medium text-brand-800 hover:underline" to="/purchasing/bills">View all</Link>
          </div>
          <div className="p-4">
            {bills.isPending ? <p className="text-sm text-slate-500">Loading bills…</p> : null}
            {!bills.isPending && billRows.length === 0 ? <p className="text-sm text-slate-500">No vendor bills yet.</p> : null}
            <ul className="flex flex-col divide-y divide-slate-100">
              {[...billRows]
                .sort((left, right) => (left.dueDate ?? "9999").localeCompare(right.dueDate ?? "9999"))
                .slice(0, 6)
                .map((bill) => (
                  <li key={bill.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link className="font-mono text-xs text-slate-500 hover:underline" to={`/purchasing/bills/${bill.id}`}>
                        {docNumber(bill)}
                      </Link>
                      <p className="truncate text-sm font-medium text-slate-800">{bill.vendor?.displayName ?? bill.vendor?.name ?? "Vendor"}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusPill status={bill.status} deleted={Boolean(bill.deletedAt)} />
                      <span className="text-xs tabular-nums text-slate-600">{formatMoney(billBalance(bill), bill.currencyCode)}</span>
                      <span className="text-[11px] text-slate-500">Due {formatDate(bill.dueDate)}</span>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Order status guide</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {PURCHASE_ORDER_STATUSES.map((status) => (
            <span key={status} className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
              {statusLabel(status)}
            </span>
          ))}
        </div>
      </section>
    </section>
  );
}

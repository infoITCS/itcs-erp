import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listInvoices } from "@/features/invoices/api.ts";
import { listPayments } from "@/features/payments/api.ts";
import { listQuotes } from "@/features/quotes/api.ts";
import { listSalesOrders } from "@/features/sales-orders/api.ts";
import { StatusPill, formatDate, formatMoney } from "@/features/sales/shared.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";

export default function SalesDashboardPage() {
  const canCreatePayment = useHasPermission("payments:create");
  const quotes = useQuery({
    queryKey: ["quotes", "list", { recent: true }],
    queryFn: () => listQuotes({ limit: 5 }),
  });
  const orders = useQuery({
    queryKey: ["sales-orders", "list", { recent: true }],
    queryFn: () => listSalesOrders({ limit: 5 }),
  });
  const invoices = useQuery({
    queryKey: ["invoices", "list", { recent: true }],
    queryFn: () => listInvoices({ limit: 5 }),
  });
  const payments = useQuery({
    queryKey: ["payments", "list", { recent: true }],
    queryFn: () => listPayments({ limit: 5 }),
  });

  const quoteRows = quotes.data?.items ?? [];
  const orderRows = orders.data?.items ?? [];
  const invoiceRows = invoices.data?.items ?? [];
  const paymentRows = payments.data?.items ?? [];
  const outstanding = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.total) - Number(invoice.amountPaid), 0);
  const received = paymentRows.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const currency =
    paymentRows[0]?.currencyCode ??
    invoiceRows[0]?.currencyCode ??
    orderRows[0]?.currencyCode ??
    quoteRows[0]?.currencyCode ??
    "PKR";

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col items-start justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-teal-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal-600" />
            Sales / Overview
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">Sales workspace</h1>
          <p className="mt-1 text-sm text-slate-600">
            Move deals from quote to order to invoice without leaving the sales workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm text-slate-700 transition hover:bg-slate-50" to="/quotes/new">
            New quote
          </Link>
          {canCreatePayment ? (
            <Link className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm text-slate-700 transition hover:bg-slate-50" to="/payments/new">
              Record payment
            </Link>
          ) : null}
          <Link className="inline-flex h-10 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white transition hover:bg-teal-900" to="/sales-orders/new">
            New order
          </Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Recent quotes" value={String(quoteRows.length)} href="/quotes" note="Latest quotations in the pipeline" />
        <SummaryCard label="Recent orders" value={String(orderRows.length)} href="/sales-orders" note="Newest confirmed and draft orders" />
        <SummaryCard label="Recent invoices" value={String(invoiceRows.length)} href="/invoices" note="Latest invoices issued" />
        <SummaryCard
          label="Outstanding (recent)"
          value={formatMoney(outstanding, currency)}
          href="/invoices"
          note="Balance across the five most recent invoices"
        />
        <SummaryCard
          label="Received (recent)"
          value={formatMoney(received, currency)}
          href="/payments"
          note="Value across the five most recent receipts"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RecentPanel
          title="Quotes"
          href="/quotes"
          loading={quotes.isPending}
          empty="No quotes yet."
          rows={quoteRows.map((quote) => ({
            id: quote.id,
            href: `/quotes/${quote.id}`,
            number: quote.quoteNumber,
            name: quote.customer?.displayName ?? "—",
            status: quote.status,
            date: quote.issueDate,
            total: formatMoney(quote.total, quote.currencyCode),
          }))}
        />
        <RecentPanel
          title="Sales orders"
          href="/sales-orders"
          loading={orders.isPending}
          empty="No sales orders yet."
          rows={orderRows.map((order) => ({
            id: order.id,
            href: `/sales-orders/${order.id}`,
            number: order.salesOrderNumber,
            name: order.customer?.displayName ?? "—",
            status: order.status,
            date: order.orderDate,
            total: formatMoney(order.total, order.currencyCode),
          }))}
        />
        <RecentPanel
          title="Invoices"
          href="/invoices"
          loading={invoices.isPending}
          empty="No invoices yet."
          rows={invoiceRows.map((invoice) => ({
            id: invoice.id,
            href: `/invoices/${invoice.id}`,
            number: invoice.invoiceNumber,
            name: invoice.customer?.displayName ?? "—",
            status: invoice.status,
            date: invoice.issueDate,
            total: formatMoney(invoice.total, invoice.currencyCode),
          }))}
        />
        <RecentPanel
          title="Payments"
          href="/payments"
          loading={payments.isPending}
          empty="No payments recorded yet."
          rows={paymentRows.map((payment) => ({
            id: payment.id,
            href: `/payments/${payment.id}`,
            number: payment.paymentNumber,
            name: payment.customer?.displayName ?? "—",
            status: "RECEIVED",
            date: payment.receivedDate,
            total: formatMoney(payment.amount, payment.currencyCode),
          }))}
        />
      </div>
    </section>
  );
}

function SummaryCard({ label, value, href, note }: { label: string; value: string; href: string; note: string }) {
  return (
    <Link
      to={href}
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300 hover:shadow"
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-slate-950" title={value}>
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </Link>
  );
}

function RecentPanel({
  title,
  href,
  loading,
  empty,
  rows,
}: {
  title: string;
  href: string;
  loading: boolean;
  empty: string;
  rows: Array<{ id: string; href: string; number: string; name: string; status: string; date: string; total: string }>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <Link className="text-xs font-medium text-teal-800 hover:underline" to={href}>
          View all
        </Link>
      </div>
      <div className="p-4">
        {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
        {!loading && rows.length === 0 ? <p className="text-sm text-slate-500">{empty}</p> : null}
        <ul className="flex flex-col divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <Link className="font-mono text-xs text-slate-500 hover:underline" to={row.href}>
                  {row.number}
                </Link>
                <StatusPill status={row.status} />
              </div>
              <p className="mt-1 truncate text-sm font-medium text-slate-800">{row.name}</p>
              <div className="mt-0.5 flex items-center justify-between text-xs text-slate-500">
                <span>{formatDate(row.date)}</span>
                <span className="tabular-nums text-slate-700">{row.total}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

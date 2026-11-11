import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable, type DataTableColumn } from "@/components/tables/DataTable.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { useHasPermission } from "@/hooks/useSession.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  listPayments,
  type Payment,
  type PaymentMethod,
} from "./api.ts";
import { formatDate, formatMoney } from "../sales/shared.tsx";

const PAGE_SIZE = 50;

export default function PaymentsPage() {
  const navigate = useNavigate();
  const canCreate = useHasPermission("payments:create");
  const [q, setQ] = useState("");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);

  const params = {
    q: debouncedQ || undefined,
    method: method || undefined,
    from: from || undefined,
    to: to || undefined,
    cursor,
    limit: PAGE_SIZE,
  };

  const payments = useQuery({ queryKey: queryKeys.list("payments", params), queryFn: () => listPayments(params) });

  const rows = payments.data?.items ?? [];
  const filtersActive = Boolean(q || method || from || to);
  const error = payments.isError ? getApiErrorMessage(payments.error) : null;
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const currency = rows[0]?.currencyCode ?? "PKR";

  function resetPage() {
    setCursors([undefined]);
  }

  function clearFilters() {
    setQ("");
    setMethod("");
    setFrom("");
    setTo("");
    resetPage();
  }

  const columns: DataTableColumn<Payment>[] = [
    {
      id: "payment",
      header: "Payment",
      cell: (row) => (
        <div className="min-w-[170px]">
          <p className="font-mono text-xs text-slate-500">{row.paymentNumber}</p>
          <Link
            className="mt-0.5 block font-semibold text-slate-950 transition hover:text-teal-800"
            to={`/payments/${row.id}`}
          >
            {row.customer?.displayName ?? "Customer"}
          </Link>
          {row.reference ? <p className="mt-0.5 truncate text-xs text-slate-500">{row.reference}</p> : null}
        </div>
      ),
    },
    {
      id: "invoice",
      header: "Invoice",
      cell: (row) =>
        row.invoice ? (
          <Link className="font-mono text-xs text-teal-800 hover:underline" to={`/invoices/${row.invoice.id}`}>
            {row.invoice.invoiceNumber}
          </Link>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      id: "received",
      header: "Received",
      cell: (row) => <span className="whitespace-nowrap text-xs text-slate-600">{formatDate(row.receivedDate)}</span>,
    },
    {
      id: "method",
      header: "Method",
      cell: (row) => <span className="whitespace-nowrap text-xs text-slate-700">{PAYMENT_METHOD_LABELS[row.method]}</span>,
    },
    {
      id: "amount",
      header: "Amount",
      cell: (row) => (
        <span className="whitespace-nowrap text-right font-medium tabular-nums text-slate-800">
          {formatMoney(row.amount, row.currencyCode)}
        </span>
      ),
    },
    {
      id: "recorded",
      header: "Recorded by",
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-slate-600">
          {row.createdBy ? `${row.createdBy.firstName} ${row.createdBy.lastName}` : "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex justify-end gap-1 whitespace-nowrap text-xs font-medium">
          <button
            type="button"
            className="rounded px-2 py-1.5 text-slate-700 transition hover:bg-slate-100"
            onClick={() => navigate(`/payments/${row.id}`)}
          >
            View
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col items-start justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-teal-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal-600" />
            Sales / Receivables
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">Payments</h1>
          <p className="mt-1 text-sm text-slate-600">
            Customer receipts allocated to invoices, with invoice balances updated automatically.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {canCreate ? (
            <Link to="/payments/new">
              <Button className="h-10 bg-teal-800 px-4 transition hover:bg-teal-900">Record Payment</Button>
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 lg:grid-cols-4 lg:divide-y-0">
        {[
          { label: "Receipts shown", value: String(rows.length) },
          { label: "Value shown", value: formatMoney(total, currency) },
          { label: "Cash", value: formatMoney(rows.filter((row) => row.method === "CASH").reduce((sum, row) => sum + Number(row.amount), 0), currency) },
          { label: "Bank / card", value: formatMoney(rows.filter((row) => row.method === "BANK_TRANSFER" || row.method === "CARD").reduce((sum, row) => sum + Number(row.amount), 0), currency) },
        ].map((item) => (
          <div key={item.label} className="flex min-h-[76px] flex-col justify-center px-4 py-3 first:pl-0 sm:pl-5">
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-slate-950">{item.value}</p>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_190px_160px_160px]">
          <Input
            className="h-10"
            type="search"
            aria-label="Search payments"
            value={q}
            placeholder="Search payment number, invoice, customer or reference"
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
          />
          <select
            aria-label="Filter by method"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={method}
            onChange={(event) => {
              setMethod(event.target.value);
              resetPage();
            }}
          >
            <option value="">All methods</option>
            {PAYMENT_METHODS.map((value) => (
              <option key={value} value={value}>
                {PAYMENT_METHOD_LABELS[value as PaymentMethod]}
              </option>
            ))}
          </select>
          <Input
            className="h-10"
            type="date"
            aria-label="Received from"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              resetPage();
            }}
          />
          <Input
            className="h-10"
            type="date"
            aria-label="Received to"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              resetPage();
            }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-500">Received date range</span>
          {filtersActive ? (
            <button
              type="button"
              className="text-xs font-medium text-teal-800 underline-offset-2 hover:underline"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={payments.isPending}
        error={error}
        emptyMessage={filtersActive ? "No payments match these filters." : "No payments recorded yet."}
        hasNextPage={payments.data?.pageInfo.hasNextPage ?? false}
        hasPreviousPage={cursors.length > 1}
        onNext={() => {
          const next = payments.data?.pageInfo.nextCursor;
          if (next) {
            setCursors((current) => [...current, next]);
          }
        }}
        onPrevious={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
      />

      <p className="text-xs text-slate-500">
        Page {cursors.length} · {rows.length} payment{rows.length === 1 ? "" : "s"} shown
      </p>
    </section>
  );
}

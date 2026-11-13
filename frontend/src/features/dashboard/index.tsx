import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { NavIcon } from "@/components/layouts/NavIcon.tsx";
import { formatMoney, StatusPill } from "@/features/sales/shared.tsx";
import { getUserStats, type UserStats } from "@/features/users/api.ts";
import { useHasPermission, useSessionUser } from "@/hooks/useSession.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { fetchHealth } from "@/services/health.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  getDashboardSummary,
  type DashboardOpportunitySummary,
  type DashboardRecentInvoice,
  type DashboardRecentLead,
  type DashboardRecentPayment,
  type DashboardSummary,
} from "./api.ts";

type Tone = "brand" | "emerald" | "amber" | "indigo" | "sky" | "rose";

interface Kpi {
  label: string;
  value: string;
  detail: string;
  path: string;
  iconPath: string;
  tone: Tone;
  alert?: string;
}

const toneStyles: Record<Tone, { icon: string; glow: string; text: string; bar: string }> = {
  brand: {
    icon: "bg-brand-50 text-brand-700 ring-brand-100",
    glow: "from-brand-500/10",
    text: "text-brand-800",
    bar: "bg-brand-500",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    glow: "from-emerald-500/10",
    text: "text-emerald-800",
    bar: "bg-emerald-500",
  },
  amber: {
    icon: "bg-amber-50 text-amber-700 ring-amber-100",
    glow: "from-amber-500/10",
    text: "text-amber-800",
    bar: "bg-amber-500",
  },
  indigo: {
    icon: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    glow: "from-indigo-500/10",
    text: "text-indigo-800",
    bar: "bg-indigo-500",
  },
  sky: {
    icon: "bg-sky-50 text-sky-700 ring-sky-100",
    glow: "from-sky-500/10",
    text: "text-sky-800",
    bar: "bg-sky-500",
  },
  rose: {
    icon: "bg-rose-50 text-rose-700 ring-rose-100",
    glow: "from-rose-500/10",
    text: "text-rose-800",
    bar: "bg-rose-500",
  },
};

const workspaceAreas = [
  {
    label: "Customers",
    path: "/customers",
    group: "CRM",
    blurb: "Accounts, contacts and balances",
    permission: "customers:read",
  },
  {
    label: "Leads",
    path: "/leads",
    group: "CRM",
    blurb: "Prospects and qualification",
    permission: "leads:read",
  },
  {
    label: "Opportunities",
    path: "/opportunities",
    group: "CRM",
    blurb: "Pipeline and deal progression",
    permission: "opportunities:read",
  },
  {
    label: "Quotes",
    path: "/quotes",
    group: "Sales",
    blurb: "Pricing and customer proposals",
    permission: "quotes:read",
  },
  {
    label: "Sales orders",
    path: "/sales-orders",
    group: "Sales",
    blurb: "Confirmed orders and fulfilment",
    permission: "sales-orders:read",
  },
  {
    label: "Invoices",
    path: "/invoices",
    group: "Sales",
    blurb: "Billing and receivables",
    permission: "invoices:read",
  },
  {
    label: "Payments",
    path: "/payments",
    group: "Sales",
    blurb: "Receipts and collections",
    permission: "payments:read",
  },
  {
    label: "Products",
    path: "/products",
    group: "Supply",
    blurb: "Catalog and price management",
    permission: "products:read",
  },
];

const quickActions = [
  {
    label: "New quote",
    path: "/quotes/new",
    iconPath: "/quotes",
    permission: "quotes:create",
    tone: "brand" as Tone,
  },
  {
    label: "New invoice",
    path: "/invoices/new",
    iconPath: "/invoices",
    permission: "invoices:create",
    tone: "amber" as Tone,
  },
  {
    label: "Record payment",
    path: "/payments/new",
    iconPath: "/payments",
    permission: "payments:create",
    tone: "emerald" as Tone,
  },
  {
    label: "Add lead",
    path: "/leads/new",
    iconPath: "/leads",
    permission: "leads:create",
    tone: "indigo" as Tone,
  },
  {
    label: "Add customer",
    path: "/customers/new",
    iconPath: "/customers",
    permission: "customers:create",
    tone: "sky" as Tone,
  },
  {
    label: "New opportunity",
    path: "/opportunities/new",
    iconPath: "/opportunities",
    permission: "opportunities:create",
    tone: "rose" as Tone,
  },
];

function money(value: string | number, currency: string): string {
  return formatMoney(value, currency);
}

function dateOnly(value: string | null | undefined): string {
  if (!value) {
    return "Not set";
  }
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) {
    return value.slice(0, 10);
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function humanize(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
        </svg>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function ViewAll({ path, label = "View all" }: { path: string; label?: string }) {
  return (
    <Link
      to={path}
      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
    >
      {label}
    </Link>
  );
}

function KpiCard({
  label,
  value,
  detail,
  path,
  iconPath,
  tone,
  alert,
}: {
  label: string;
  value: string;
  detail: string;
  path: string;
  iconPath: string;
  tone: Tone;
  alert?: string;
}) {
  const styles = toneStyles[tone];
  return (
    <Link
      to={path}
      className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${styles.glow} to-transparent blur-2xl`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <span className={`rounded-xl p-2.5 ring-1 ring-inset ${styles.icon}`}>
          <NavIcon to={iconPath} className="h-5 w-5" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 transition group-hover:text-slate-600">
          Open
        </span>
      </div>
      <p className="relative mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="relative mt-1 truncate text-2xl font-semibold tracking-tight text-slate-950 tabular-nums">
        {value}
      </p>
      <p className={`relative mt-2 text-xs font-medium ${styles.text}`}>{detail}</p>
      {alert ? <p className="relative mt-1 text-xs font-medium text-rose-700">{alert}</p> : null}
    </Link>
  );
}

function AdminSnapshot({ users }: { users: UserStats }) {
  const items = [
    { label: "Users", value: users.total },
    { label: "Active", value: users.active },
    { label: "Locked", value: users.locked },
    { label: "Roles", value: users.roles },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {item.label}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function RecentInvoicesPanel({
  invoices,
  currency,
  canCreate,
}: {
  invoices: DashboardRecentInvoice[];
  currency: string;
  canCreate: boolean;
}) {
  return (
    <Panel
      title="Recent invoices"
      description="Latest customer billing activity"
      action={<ViewAll path="/invoices" />}
    >
      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Invoices you issue will appear here with their current status and balance."
          action={
            canCreate ? (
              <Link
                to="/invoices/new"
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Create invoice
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <th className="px-5 py-2.5">Invoice</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Due</th>
                <th className="px-5 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((invoice) => {
                const balance = Math.max(
                  Number(invoice.total) - Number(invoice.amountPaid),
                  0,
                );
                return (
                  <tr key={invoice.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <Link
                        to={`/invoices/${invoice.id}`}
                        className="font-semibold text-slate-900 hover:text-brand-800"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Issued {dateOnly(invoice.issueDate)}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="max-w-[190px] truncate text-slate-700">
                        {invoice.customer?.displayName ?? "No customer"}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={invoice.status} />
                    </td>
                    <td className="px-3 py-3">
                      <p
                        className={
                          invoice.status === "OVERDUE"
                            ? "font-medium text-rose-700"
                            : "text-slate-600"
                        }
                      >
                        {dateOnly(invoice.dueDate)}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <p className="font-semibold tabular-nums text-slate-900">
                        {money(invoice.total, invoice.currencyCode || currency)}
                      </p>
                      {balance > 0 ? (
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {money(balance, invoice.currencyCode || currency)} due
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[11px] text-emerald-700">Settled</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function RecentPaymentsPanel({
  payments,
  currency,
  canCreate,
}: {
  payments: DashboardRecentPayment[];
  currency: string;
  canCreate: boolean;
}) {
  return (
    <Panel
      title="Recent payments"
      description="Latest receipts posted against invoices"
      action={<ViewAll path="/payments" />}
    >
      {payments.length === 0 ? (
        <EmptyState
          title="No payments recorded"
          description="Receipts appear here as soon as they are applied to an invoice."
          action={
            canCreate ? (
              <Link
                to="/payments/new"
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Record payment
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {payments.map((payment) => (
            <li key={payment.id} className="flex items-start gap-3 px-5 py-3.5">
              <span className="mt-0.5 rounded-lg bg-emerald-50 p-2 text-emerald-700 ring-1 ring-inset ring-emerald-100">
                <NavIcon to="/payments" className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {payment.customer?.displayName ?? "Customer"}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {payment.paymentNumber}
                  {payment.invoice ? ` · ${payment.invoice.invoiceNumber}` : ""} ·{" "}
                  {dateOnly(payment.receivedDate)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-slate-900">
                  {money(payment.amount, payment.currencyCode || currency)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">{humanize(payment.method)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function RecentLeadsPanel({
  leads,
  canCreate,
}: {
  leads: DashboardRecentLead[];
  canCreate: boolean;
}) {
  return (
    <Panel
      title="Recent leads"
      description="Newest prospects entering the pipeline"
      action={<ViewAll path="/leads" />}
    >
      {leads.length === 0 ? (
        <EmptyState
          title="No leads yet"
          description="Capture a prospect to start qualification and conversion."
          action={
            canCreate ? (
              <Link
                to="/leads/new"
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Add lead
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {leads.map((lead) => (
            <li key={lead.id} className="flex items-start gap-3 px-5 py-3.5">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
                {lead.displayName.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/leads/${lead.id}`}
                  className="truncate text-sm font-medium text-slate-900 hover:text-indigo-800"
                >
                  {lead.displayName}
                </Link>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {lead.companyName ?? lead.leadNumber} · {dateTime(lead.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <StatusPill status={lead.status} />
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  {humanize(lead.priority)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function PipelinePanel({
  opportunities,
  currency,
}: {
  opportunities: DashboardOpportunitySummary;
  currency: string;
}) {
  const maxCount = Math.max(...opportunities.stageBreakdown.map((row) => row.count), 1);
  return (
    <Panel
      title="Pipeline health"
      description="Open opportunity value by stage"
      action={<ViewAll path="/opportunities" />}
    >
      <div className="grid grid-cols-2 gap-3 p-5 pb-0">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Open pipeline
          </p>
          <p className="mt-1 truncate text-lg font-semibold tabular-nums text-slate-950">
            {money(opportunities.pipelineValueBase, currency)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {opportunities.openCount} open opportunities
          </p>
        </div>
        <div className="rounded-xl bg-indigo-50/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
            Weighted
          </p>
          <p className="mt-1 truncate text-lg font-semibold tabular-nums text-indigo-950">
            {money(opportunities.weightedPipelineBase, currency)}
          </p>
          <p className="mt-0.5 text-[11px] text-indigo-700/80">Probability adjusted</p>
        </div>
      </div>

      <div className="space-y-3 p-5">
        {opportunities.stageBreakdown.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
            No open opportunities in the pipeline.
          </p>
        ) : (
          opportunities.stageBreakdown.map((row) => (
            <div key={row.stage}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-slate-700">{humanize(row.stage)}</span>
                <span className="tabular-nums text-slate-500">
                  {row.count} · {money(row.valueBase, currency)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${Math.max((row.count / maxCount) * 100, 8)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mx-5 mb-5 flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 ring-1 ring-inset ring-emerald-100">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            Won this month
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-950">
            {money(opportunities.wonThisMonthBase, currency)}
          </p>
        </div>
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          {opportunities.wonThisMonthCount} deals
        </span>
      </div>
    </Panel>
  );
}

function SalesExecutionPanel({
  summary,
  currency,
}: {
  summary: DashboardSummary["sales"];
  currency: string;
}) {
  const rows = [
    summary?.quotes
      ? {
          label: "Open quotes",
          count: summary.quotes.openCount,
          value: summary.quotes.openValueBase,
          path: "/quotes",
          iconPath: "/quotes",
          tone: "brand" as Tone,
        }
      : null,
    summary?.orders
      ? {
          label: "Open sales orders",
          count: summary.orders.openCount,
          value: summary.orders.openValueBase,
          path: "/sales-orders",
          iconPath: "/sales-orders",
          tone: "sky" as Tone,
        }
      : null,
  ].filter((row) => row !== null);

  if (rows.length === 0) {
    return null;
  }

  return (
    <Panel title="Sales execution" description="Documents moving through quote-to-cash">
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.label}>
            <Link
              to={row.path}
              className="flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50/70"
            >
              <span className={`rounded-lg p-2 ring-1 ring-inset ${toneStyles[row.tone].icon}`}>
                <NavIcon to={row.iconPath} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{row.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {row.count} document{row.count === 1 ? "" : "s"} in progress
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-slate-900">
                {money(row.value, currency)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function QuickActionsPanel() {
  const user = useSessionUser();
  const actions = quickActions.filter((action) => user?.permissions.includes(action.permission));

  return (
    <Panel title="Quick actions" description="Start the next step without leaving the dashboard">
      {actions.length === 0 ? (
        <p className="px-5 py-6 text-center text-xs leading-5 text-slate-500">
          Your role has view-only access. Ask an administrator if you need to create records.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 p-4">
          {actions.map((action) => (
            <Link
              key={action.path}
              to={action.path}
              className="group rounded-xl border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <span
                className={`inline-flex rounded-lg p-2 ring-1 ring-inset ${toneStyles[action.tone].icon}`}
              >
                <NavIcon to={action.iconPath} className="h-4 w-4" />
              </span>
              <span className="mt-2 block text-xs font-semibold text-slate-800 group-hover:text-slate-950">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

function AccessPanel({ users }: { users?: UserStats }) {
  const user = useSessionUser();
  const role = user?.roles.includes("admin") ? "Administrator" : user?.roles[0] ?? "Member";

  return (
    <Panel title="Team & access" description="Your current workspace permissions">
      {users ? <AdminSnapshot users={users} /> : null}
      <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Signed in as</dt>
          <dd className="max-w-[190px] truncate font-medium text-slate-800">{user?.email}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Role</dt>
          <dd className="font-medium capitalize text-slate-800">{role}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Permissions</dt>
          <dd className="font-medium text-slate-800">{user?.permissions.length ?? 0}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/settings"
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Account settings
        </Link>
        {user?.permissions.includes("users:read") ? (
          <Link
            to="/users"
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Manage users
          </Link>
        ) : null}
      </div>
    </Panel>
  );
}

function WorkspacePanel({ embedded = false }: { embedded?: boolean }) {
  const user = useSessionUser();
  const areas = workspaceAreas.filter((area) => user?.permissions.includes(area.permission));
  if (areas.length === 0) {
    return null;
  }

  return (
    <section>
      {!embedded ? (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Workspace modules</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Jump directly into the areas your role can access.
            </p>
          </div>
        </div>
      ) : null}
      <div className={`grid gap-3 sm:grid-cols-2 ${embedded ? "" : "lg:grid-cols-4"}`}>
        {areas.map((area) => (
          <Link
            key={area.path}
            to={area.path}
            className="group flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
          >
            <span className="rounded-lg bg-slate-50 p-2 text-slate-600 ring-1 ring-inset ring-slate-100 transition group-hover:bg-brand-50 group-hover:text-brand-700 group-hover:ring-brand-100">
              <NavIcon to={area.path} className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {area.group}
              </span>
              <span className="mt-0.5 block text-sm font-semibold text-slate-900">{area.label}</span>
              <span className="mt-0.5 block truncate text-[11px] text-slate-500">{area.blurb}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-40 animate-pulse rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
        >
          <div className="h-9 w-9 rounded-xl bg-slate-100" />
          <div className="mt-5 h-2.5 w-24 rounded bg-slate-100" />
          <div className="mt-3 h-7 w-32 rounded bg-slate-100" />
          <div className="mt-3 h-2.5 w-28 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const user = useSessionUser();
  const canReadUsers = useHasPermission("users:read");
  const canCreateInvoice = useHasPermission("invoices:create");
  const canCreatePayment = useHasPermission("payments:create");
  const canCreateLead = useHasPermission("leads:create");
  const summary = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: getDashboardSummary,
    staleTime: 60_000,
  });
  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: fetchHealth,
  });
  const userStats = useQuery({
    queryKey: ["users", "stats"],
    queryFn: getUserStats,
    enabled: canReadUsers,
  });

  const role = user?.roles.includes("admin") ? "Administrator" : user?.roles[0] ?? "Member";
  const today = new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date());
  const data = summary.data;
  const currency = data?.baseCurrencyCode ?? "USD";
  const sales = data?.sales;
  const crm = data?.crm;
  const hasRecentActivity = Boolean(sales?.invoices || sales?.payments || crm?.leads);
  const availableActions = quickActions.filter((action) =>
    user?.permissions.includes(action.permission),
  );

  const kpis: Kpi[] = [];
  const addKpi = (kpi: Kpi) => {
    if (kpis.length < 4 && !kpis.some((item) => item.path === kpi.path)) {
      kpis.push(kpi);
    }
  };

  if (sales?.invoices) {
    addKpi({
      label: "Outstanding receivables",
      value: money(sales.invoices.outstandingBase, currency),
      detail: `${sales.invoices.openCount} open invoice${sales.invoices.openCount === 1 ? "" : "s"}`,
      path: "/invoices",
      iconPath: "/invoices",
      tone: Number(sales.invoices.overdueBase) > 0 ? "rose" : "amber",
      alert:
        Number(sales.invoices.overdueBase) > 0
          ? `${money(sales.invoices.overdueBase, currency)} overdue`
          : undefined,
    });
  }

  if (sales?.payments) {
    addKpi({
      label: "Collected this month",
      value: money(sales.payments.receivedThisMonthBase, currency),
      detail: `${sales.payments.countThisMonth} payment${sales.payments.countThisMonth === 1 ? "" : "s"} received`,
      path: "/payments",
      iconPath: "/payments",
      tone: "emerald",
    });
  }

  if (crm?.opportunities) {
    addKpi({
      label: "Open pipeline",
      value: money(crm.opportunities.pipelineValueBase, currency),
      detail: `${crm.opportunities.openCount} active opportunit${crm.opportunities.openCount === 1 ? "y" : "ies"}`,
      path: "/opportunities",
      iconPath: "/opportunities",
      tone: "indigo",
    });
  }

  if (crm?.leads) {
    addKpi({
      label: "Active leads",
      value: String(crm.leads.openCount),
      detail: `${crm.leads.newCount} new · ${crm.leads.qualifiedCount} qualified`,
      path: "/leads",
      iconPath: "/leads",
      tone: "brand",
    });
  }

  if (sales?.orders) {
    addKpi({
      label: "Open sales orders",
      value: String(sales.orders.openCount),
      detail: `${money(sales.orders.openValueBase, currency)} in progress`,
      path: "/sales-orders",
      iconPath: "/sales-orders",
      tone: "sky",
    });
  }

  if (sales?.quotes) {
    addKpi({
      label: "Open quotes",
      value: String(sales.quotes.openCount),
      detail: `${money(sales.quotes.openValueBase, currency)} quoted`,
      path: "/quotes",
      iconPath: "/quotes",
      tone: "brand",
    });
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-100/60 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-800">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
              Operations overview
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
              {user ? `Welcome back, ${user.firstName}` : "Dashboard"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Sales, receivables and pipeline activity across your organization.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                {today}
              </span>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold capitalize text-brand-800 ring-1 ring-inset ring-brand-100">
                {role}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                Base currency · {currency}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  health.isError
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    health.isError ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                />
                {health.isPending
                  ? "Checking API"
                  : health.isError
                    ? "API unavailable"
                    : "API operational"}
              </span>
              <button
                type="button"
                onClick={() => void summary.refetch()}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                disabled={summary.isFetching}
              >
                {summary.isFetching ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            {availableActions.length > 0 ? (
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {availableActions.slice(0, 2).map((action, index) => (
                  <Link
                    key={action.path}
                    to={action.path}
                    className={
                      index === 0
                        ? "rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                        : "rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    }
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
            {data ? (
              <p className="text-[11px] text-slate-400">
                Snapshot updated {dateTime(data.generatedAt)}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {summary.isPending ? <DashboardSkeleton /> : null}

      {summary.isError ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-6">
          <h2 className="text-sm font-semibold text-rose-900">Dashboard could not load</h2>
          <p className="mt-1 max-w-2xl text-sm text-rose-800">
            {getApiErrorMessage(summary.error)}
          </p>
          <button
            type="button"
            onClick={() => void summary.refetch()}
            className="mt-3 rounded-lg bg-rose-900 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800"
          >
            Try again
          </button>
        </section>
      ) : null}

      {data && kpis.length > 0 ? (
        <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.slice(0, 4).map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </section>
      ) : null}

      {data ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            {sales?.invoices ? (
              <RecentInvoicesPanel
                invoices={data.recent.invoices}
                currency={currency}
                canCreate={canCreateInvoice}
              />
            ) : null}
            <div className="grid gap-5 lg:grid-cols-2">
              {sales?.payments ? (
                <RecentPaymentsPanel
                  payments={data.recent.payments}
                  currency={currency}
                  canCreate={canCreatePayment}
                />
              ) : null}
              {crm?.leads ? (
                <RecentLeadsPanel leads={data.recent.leads} canCreate={canCreateLead} />
              ) : null}
            </div>
            {!hasRecentActivity ? (
              <Panel title="Your workspace" description="Modules available to your role">
                <div className="p-5">
                  <WorkspacePanel embedded />
                </div>
              </Panel>
            ) : null}
          </div>

          <aside className="flex min-w-0 flex-col gap-5">
            {crm?.opportunities ? (
              <PipelinePanel opportunities={crm.opportunities} currency={currency} />
            ) : null}
            <SalesExecutionPanel summary={sales ?? null} currency={currency} />
            <QuickActionsPanel />
            <AccessPanel users={canReadUsers ? userStats.data : undefined} />
          </aside>
        </div>
      ) : null}

      {data && hasRecentActivity ? <WorkspacePanel /> : null}
    </section>
  );
}

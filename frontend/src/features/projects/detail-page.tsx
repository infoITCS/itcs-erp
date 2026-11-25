import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  deleteProject,
  getProject,
  getProjectActivity,
  getProjectFinancials,
  listProjectAudit,
  PROJECT_ACTIVITY_KINDS,
  type ProjectActivity,
  type ProjectActivityGroup,
  type ProjectActivityItem,
  type ProjectActivityKind,
  type ProjectFinancials,
} from "./api.ts";
import {
  formatDate,
  formatDateTime,
  formatPercent,
  formatRupees,
  projectActionLabel,
  ProjectStatusBadge,
  statusLabel,
} from "./shared.tsx";

type Tab = "overview" | "workspace" | "activity";

type IconName = "folder" | "pencil" | "trash" | "alert" | "wallet" | "trend" | "users" | "task" | "call" | "invoice" | "receipt" | "credit" | "expense" | "bill" | "vendor";

export default function ProjectDetailPage() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = useHasPermission("projects:update");
  const canDelete = useHasPermission("projects:delete");
  const canCreateQuote = useHasPermission("quotes:create");
  const canCreateSalesOrder = useHasPermission("sales-orders:create");
  const canCreateInvoice = useHasPermission("invoices:create");
  const canCreatePayment = useHasPermission("payments:create");
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(requestedTab === "workspace" || requestedTab === "activity" ? requestedTab : "overview");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<ProjectActivityKind | "all">("all");
  const [showAllTimeline, setShowAllTimeline] = useState(false);

  const project = useQuery({ queryKey: ["projects", id], queryFn: () => getProject(id) });
  const activity = useQuery({ queryKey: ["projects", id, "activity"], queryFn: () => getProjectActivity(id), enabled: Boolean(id) });
  const liveFinancials = useQuery({ queryKey: ["projects", id, "financials"], queryFn: () => getProjectFinancials(id), enabled: Boolean(id) });
  const audit = useQuery({
    queryKey: ["projects", id, "audit"],
    queryFn: () => listProjectAudit(id),
    enabled: tab === "activity",
  });

  const remove = useMutation({
    mutationFn: () => deleteProject(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate("/projects");
    },
  });

  const data = project.data;
  const actionError = remove.isError ? getApiErrorMessage(remove.error) : null;

  function selectTab(next: Tab) {
    setTab(next);
    setSearchParams(next === "overview" ? {} : { tab: next }, { replace: true });
  }

  function showPlaceholder(label: string) {
    setPendingAction(`${label} is not available yet. This action will be enabled when its module is released.`);
  }

  if (project.isPending) {
    return (
      <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}</div>
      </section>
    );
  }

  if (project.isError || !data) {
    return (
      <section className="mx-auto w-full max-w-3xl">
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {getApiErrorMessage(project.error)}
        </p>
        <Link to="/projects" className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline">Back to projects</Link>
      </section>
    );
  }

  const financials = liveFinancials.data;
  const customer = activity.data?.customer;
  const customerName = customer?.displayName || data.customerContactName || "No customer";
  const customerId = customer?.id ?? data.customerId;
  const supplierName = data.supplierCompany || "No supplier";
  const money = (value: string) => (financials ? formatRupees(value, financials.currencyCode) : "—");

  return (
    <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-sky-400" />
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 sm:flex">
              <Icon name="folder" className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-xs text-slate-500">{data.projectNumber}</p>
                <ProjectStatusBadge status={data.status} deleted={Boolean(data.deletedAt)} />
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{data.name}</h1>
              <p className="mt-1.5 text-sm text-slate-600">{customerName} · {supplierName} · {formatDate(data.dueDate)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && !data.deletedAt ? (
              <Link to={`/projects/${id}/edit`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50">
                <Icon name="pencil" className="h-4 w-4" /> Edit project
              </Link>
            ) : null}
            {canDelete && !data.deletedAt ? (
              <Button variant="secondary" className="h-11 rounded-xl text-rose-700" onClick={() => setConfirmDeleteOpen(true)}>
                <Icon name="trash" className="h-4 w-4" /> Delete
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {actionError ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> {actionError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Live profit" value={financials ? `${money(financials.profit)} (${formatPercent(financials.marginPercent)})` : "—"} hint={liveFinancials.isPending ? "Calculating from customer documents…" : "Income minus live cost"} tone="emerald" icon="trend" />
        <MetricCard label="Live income" value={financials ? money(financials.income) : "—"} hint={financials ? `${financials.breakdown.invoiceCount} invoices · excluding void` : "From customer invoices"} tone="brand" icon="wallet" />
        <MetricCard label="Live cost" value={financials ? money(financials.cost) : "—"} hint={financials ? "Expenses/bills feed this automatically" : "Expenses and bills when available"} tone="slate" icon="wallet" />
      </div>
      {liveFinancials.isError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>Live figures could not be loaded. {getApiErrorMessage(liveFinancials.error)}</span>
          <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => liveFinancials.refetch()}>Retry</Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/60 px-3 pt-3 sm:px-5">
          <TabButton label="Info" active={tab === "overview"} onClick={() => selectTab("overview")} />
          <TabButton label="Workspace" active={tab === "workspace"} onClick={() => selectTab("workspace")} />
          <TabButton label="Activity" active={tab === "activity"} onClick={() => selectTab("activity")} />
        </div>

        <div className="p-5 sm:p-6">
          {tab === "overview" ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid gap-5">
                <Panel title="Project info" description="Core details, ownership, and planning dates.">
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Detail label="Project number">{data.projectNumber}</Detail>
                    <Detail label="Status">{data.status.replaceAll("_", " ")}</Detail>
                    <Detail label="Customer contact">{customerName}</Detail>
                    <Detail label="Customer email">{data.customerContactEmail || "—"}</Detail>
                    <Detail label="Customer phone">{data.customerContactPhone || "—"}</Detail>
                    <Detail label="Supplier">{supplierName}</Detail>
                    <Detail label="Supplier contact">{data.supplierContactName || "—"}</Detail>
                    <Detail label="Supplier email">{data.supplierContactEmail || "—"}</Detail>
                    <Detail label="Supplier phone">{data.supplierContactPhone || "—"}</Detail>
                    <Detail label="Start date">{formatDate(data.startDate)}</Detail>
                    <Detail label="Due date">{formatDate(data.dueDate)}</Detail>
                    <Detail label="Last updated">{formatDateTime(data.updatedAt)}</Detail>
                  </dl>
                </Panel>
                {data.description ? <Panel title="Description" description="Scope and delivery brief."><p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{data.description}</p></Panel> : null}
                {data.notes ? <Panel title="Internal notes" description="Visible to the delivery team only."><p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{data.notes}</p></Panel> : null}
              </div>

              <aside className="h-fit rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/70 via-white to-sky-50/60 p-5 shadow-inner ring-1 ring-brand-50">
                <LiveFinancialPanel
                  financials={financials}
                  loading={liveFinancials.isPending}
                  hasCustomer={Boolean(customerId)}
                  money={money}
                  onRetry={() => liveFinancials.refetch()}
                />
                <div className="mt-5 border-t border-brand-100 pt-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">Project actions</p>
                  <p className="mt-2 text-xs leading-5 text-slate-600">Create project work and related documents from one place.</p>
                </div>

                {pendingAction ? (
                  <div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
                    <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> {pendingAction}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-2">
                  <ActionTile label="New Task for Project" description="Task workspace" icon="task" onClick={() => { selectTab("workspace"); showPlaceholder("New Task for Project"); }} />
                  <ActionTile label="New Call" description="Call logger" icon="call" onClick={() => showPlaceholder("New Call")} />
                  <ActionTile
                    label="New Quote"
                    description={customerId ? "Opens quote form with customer" : "Link a customer first"}
                    icon="invoice"
                    href={canCreateQuote && customerId ? `/quotes/new?projectId=${id}&customerId=${customerId}` : undefined}
                    onClick={customerId && !canCreateQuote ? () => showPlaceholder("New Quote") : customerId ? undefined : () => showPlaceholder("New Quote")}
                  />
                  <ActionTile
                    label="New Sales Order"
                    description={customerId ? "Opens order form with customer" : "Link a customer first"}
                    icon="bill"
                    href={canCreateSalesOrder && customerId ? `/sales-orders/new?projectId=${id}&customerId=${customerId}` : undefined}
                    onClick={customerId && !canCreateSalesOrder ? () => showPlaceholder("New Sales Order") : customerId ? undefined : () => showPlaceholder("New Sales Order")}
                  />
                  <ActionTile
                    label="New Invoice"
                    description={customerId ? "Opens invoice form with customer" : "Link a customer first"}
                    icon="invoice"
                    href={canCreateInvoice && customerId ? `/invoices/new?projectId=${id}&customerId=${customerId}` : undefined}
                    onClick={customerId && !canCreateInvoice ? () => showPlaceholder("New Invoice") : customerId ? undefined : () => showPlaceholder("New Invoice")}
                  />
                  <ActionTile
                    label="New Sales Receipt"
                    description="Record a payment receipt"
                    icon="receipt"
                    href={canCreatePayment ? `/payments/new?projectId=${id}${customerId ? `&customerId=${customerId}` : ""}` : undefined}
                    onClick={!canCreatePayment ? () => showPlaceholder("New Sales Receipt") : undefined}
                  />
                  <ActionTile label="New Credit Memo" description="Coming soon" icon="credit" onClick={() => showPlaceholder("New Credit Memo")} />
                  <ActionTile label="New Expense" description="Coming soon" icon="expense" onClick={() => showPlaceholder("New Expense")} />
                  <ActionTile label="New Bill" description="Coming soon" icon="bill" onClick={() => showPlaceholder("New Bill")} />
                  <ActionTile label="New Vendor Credit Memo" description="Coming soon" icon="vendor" onClick={() => showPlaceholder("New Vendor Credit Memo")} />
                </div>
              </aside>
            </div>
          ) : null}

          {tab === "workspace" ? (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
              <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm ring-1 ring-slate-200">
                <Icon name="task" className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-base font-bold text-slate-950">Project task workspace</h2>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-600">
                Task management is not released in this workspace yet. The action is ready and will connect here automatically.
              </p>
              <Button variant="secondary" className="mt-5" onClick={() => showPlaceholder("New Task for Project")}>New Task for Project</Button>
            </section>
          ) : null}

          {tab === "activity" ? (
            <div className="space-y-5">
              <CustomerActivityPanel
                activity={activity.data}
                loading={activity.isPending}
                error={activity.isError ? getApiErrorMessage(activity.error) : null}
                onRetry={() => activity.refetch()}
                projectId={id}
                customerId={customerId}
                canEdit={canEdit}
                canCreateQuote={canCreateQuote}
                canCreateSalesOrder={canCreateSalesOrder}
                canCreateInvoice={canCreateInvoice}
                canCreatePayment={canCreatePayment}
                timelineFilter={timelineFilter}
                onTimelineFilter={setTimelineFilter}
                showAllTimeline={showAllTimeline}
                onToggleTimeline={() => setShowAllTimeline((current) => !current)}
              />

              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-sm font-bold text-slate-950">Audit trail</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Latest events recorded for this project.</p>
                {audit.isPending ? <div className="mt-5 space-y-3">{[0, 1, 2].map((index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div> : null}
                {audit.isError ? <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{getApiErrorMessage(audit.error)}</p> : null}
                {!audit.isPending && !audit.isError && (audit.data?.items ?? []).length === 0 ? (
                  <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">No audit events yet.</div>
                ) : null}
                <ol className="mt-5 space-y-4">
                  {(audit.data?.items ?? []).map((event) => (
                    <li key={event.id} className="relative flex gap-3 border-l border-slate-200 pl-5">
                      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-brand-50" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{projectActionLabel(event.action)}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(event.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete project?"
        description={<p>Soft-delete <span className="font-medium text-slate-900">{data.name}</span>?</p>}
        confirmLabel="Delete project"
        danger
        busy={remove.isPending}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
      />
    </section>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`relative px-4 py-3 text-sm font-semibold transition ${active ? "text-brand-800" : "text-slate-500 hover:text-slate-800"}`}>
      {label}
      {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-600" /> : null}
    </button>
  );
}

function LiveFinancialPanel({
  financials,
  loading,
  hasCustomer,
  money,
  onRetry,
}: {
  financials?: ProjectFinancials;
  loading: boolean;
  hasCustomer: boolean;
  money: (value: string) => string;
  onRetry: () => void;
}) {
  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-white/70" />;
  }
  if (!financials) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
        <p className="font-bold">Live financials unavailable</p>
        <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">Retry</button>
      </div>
    );
  }
  if (!hasCustomer) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-xs leading-5 text-slate-600">
        <p className="font-bold text-slate-900">Live financials</p>
        <p className="mt-1">Link a customer to calculate income, payments, outstanding, and profit from ERP documents.</p>
      </div>
    );
  }
  const rows: Array<[string, string, string]> = [
    ["Invoiced", money(financials.breakdown.invoiceTotal), "text-brand-800"],
    ["Received", money(financials.breakdown.paymentsReceived), "text-emerald-700"],
    ["Outstanding", money(financials.breakdown.outstanding), "text-amber-700"],
    ["Quote value", money(financials.breakdown.quoteTotal), "text-slate-700"],
    ["Sales orders", money(financials.breakdown.salesOrderTotal), "text-slate-700"],
    ["Expenses / bills", money(financials.breakdown.expenseTotal), "text-slate-700"],
  ];
  return (
    <div className="rounded-xl border border-white bg-white/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">Live financials</p>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">Auto</span>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">Calculated from this customer's documents. No manual income or cost.</p>
      <dl className="mt-3 divide-y divide-slate-100">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-1.5">
            <dt className="text-[11px] text-slate-500">{label}</dt>
            <dd className={`truncate text-xs font-bold tabular-nums ${tone}`} title={value}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] leading-4 text-slate-400">
        {financials.breakdown.invoiceCount} invoices · {financials.breakdown.paymentCount} receipts · expenses/bills appear when released.
      </p>
    </div>
  );
}

function WorkflowStrip({ activity, money }: { activity: ProjectActivity; money: (value: string) => string }) {
  const steps: Array<{ kind: ProjectActivityKind; title: string; hint: string }> = [
    { kind: "quote", title: "Quote", hint: "Price agreed" },
    { kind: "salesOrder", title: "Sales order", hint: "Order confirmed" },
    { kind: "invoice", title: "Invoice", hint: "Billed to customer" },
    { kind: "payment", title: "Payment", hint: "Cash received" },
  ];
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">Workflow path</p>
          <h2 className="mt-1 text-sm font-bold text-slate-950">From enquiry to cash, in one view</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Follow the customer's documents in order; each step links to its full list.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">Live counts</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const group = activity.groups[step.kind];
          return (
            <a key={step.kind} href={`#activity-${step.kind}`} className="relative rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition hover:border-brand-300 hover:bg-brand-50/40">
              {index < steps.length - 1 ? <span className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[10px] font-bold text-brand-600 shadow ring-1 ring-slate-200 md:flex">→</span> : null}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-900">{step.title}</p>
                <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-600 ring-1 ring-slate-200">{group.count}</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">{step.hint}</p>
              <p className="mt-2 truncate text-sm font-bold tabular-nums text-slate-950" title={group.available ? money(group.total) : "Restricted"}>
                {group.available ? money(group.total) : "Restricted"}
              </p>
            </a>
          );
        })}
      </div>
    </section>
  );
}

interface CustomerActivityPanelProps {
  activity?: ProjectActivity;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  projectId: string;
  customerId: string | null;
  canEdit: boolean;
  canCreateQuote: boolean;
  canCreateSalesOrder: boolean;
  canCreateInvoice: boolean;
  canCreatePayment: boolean;
  timelineFilter: ProjectActivityKind | "all";
  onTimelineFilter: (kind: ProjectActivityKind | "all") => void;
  showAllTimeline: boolean;
  onToggleTimeline: () => void;
}

function CustomerActivityPanel({
  activity,
  loading,
  error,
  onRetry,
  projectId,
  customerId,
  canEdit,
  canCreateQuote,
  canCreateSalesOrder,
  canCreateInvoice,
  canCreatePayment,
  timelineFilter,
  onTimelineFilter,
  showAllTimeline,
  onToggleTimeline,
}: CustomerActivityPanelProps) {
  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-5 grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div>
        <div className="mt-5 h-64 animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  if (error || !activity) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm sm:p-6">
        <p role="alert" className="text-sm text-rose-800">{error ?? "Customer activity is unavailable."}</p>
        <Button variant="secondary" className="mt-4" onClick={onRetry}>Retry</Button>
      </section>
    );
  }

  const currencyCode = activity.currencyCode;
  const query = new URLSearchParams({ projectId });
  if (customerId) {
    query.set("customerId", customerId);
  }
  const createLinks: Partial<Record<ProjectActivityKind, string | null>> = {
    quote: canCreateQuote && customerId ? `/quotes/new?${query}` : null,
    salesOrder: canCreateSalesOrder && customerId ? `/sales-orders/new?${query}` : null,
    invoice: canCreateInvoice && customerId ? `/invoices/new?${query}` : null,
    payment: canCreatePayment && customerId ? `/payments/new?${query}` : null,
  };
  const filteredTimeline =
    timelineFilter === "all" ? activity.timeline : activity.timeline.filter((entry) => entry.kind === timelineFilter);
  const visibleTimeline = showAllTimeline ? filteredTimeline : filteredTimeline.slice(0, 12);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 via-white to-sky-50/60 p-5 shadow-sm ring-1 ring-brand-50 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">Customer activity</p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
              {activity.customer ? `${activity.customer.displayName} in ERP` : "No customer linked"}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
              Leads, opportunities, tenders, quotes, sales orders, invoices, and receipts are collected here so the whole customer workflow is visible from this project.
            </p>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">Reading tip: a <span className="font-semibold text-brand-700">Direct link</span> badge means the record was created from this project.</p>
            {activity.customer ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="font-medium text-slate-700">{activity.customer.customerNumber}</span>
                {activity.customer.email ? <span>{activity.customer.email}</span> : null}
                <Link to={`/customers/${activity.customer.id}`} className="font-semibold text-brand-700 hover:underline">View customer</Link>
              </div>
            ) : canEdit ? (
              <Link to={`/projects/${projectId}/edit`} className="mt-3 inline-flex text-sm font-semibold text-brand-700 hover:underline">Link a customer</Link>
            ) : null}
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-[420px]">
            <ActionTile label="New Quote" description="Prefilled for this customer" icon="invoice" href={createLinks.quote ?? undefined} />
            <ActionTile label="New Sales Order" description="Prefilled for this customer" icon="bill" href={createLinks.salesOrder ?? undefined} />
            <ActionTile label="New Invoice" description="Links back to this project" icon="invoice" href={createLinks.invoice ?? undefined} />
            <ActionTile label="New Sales Receipt" description="Record a customer payment" icon="receipt" href={createLinks.payment ?? undefined} />
          </div>
        </div>
      </section>

      <WorkflowStrip activity={activity} money={(value) => formatRupees(value, currencyCode)} />

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-bold text-slate-950">Customer pipeline</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Counts and values across every customer record connected to this project.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROJECT_ACTIVITY_KINDS.map((kind) => {
            const group = activity.groups[kind];
            return (
              <a key={kind} href={`#activity-${kind}`} className="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{group.label}</p>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-600">{group.count}</span>
                </div>
                <p className="mt-2 truncate text-sm font-bold tabular-nums text-slate-950" title={formatRupees(group.total, group.currencyCode)}>
                  {group.available ? formatRupees(group.total, group.currencyCode) : "Restricted"}
                </p>
              </a>
            );
          })}
          {activity.upcomingModules.map((module) => (
            <div key={module.kind} className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{module.label}</p>
                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Soon</span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-400">Will appear here automatically</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-950">Invoice and payment status</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Draft, sent, unpaid, paid, and overdue invoices for this customer.</p>
          </div>
          <Link to="/invoices" className="text-xs font-semibold text-brand-700 hover:underline">Open all invoices</Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MiniMetric label="All invoices" value={String(activity.invoiceSummary.count)} tone="slate" />
          <MiniMetric label="Paid" value={String(activity.invoiceSummary.paidCount)} tone="emerald" />
          <MiniMetric label="Open / unpaid" value={String(activity.invoiceSummary.open)} tone="amber" />
          <MiniMetric label="Draft" value={String(activity.invoiceSummary.draft)} tone="slate" />
          <MiniMetric label="Overdue" value={String(activity.invoiceSummary.overdue)} tone="rose" />
          <MiniMetric label="Outstanding" value={formatRupees(activity.invoiceSummary.balance, currencyCode)} tone="brand" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1.5"><StatusPill status="DRAFT" /> Not sent yet</span>
          <span className="inline-flex items-center gap-1.5"><StatusPill status="SENT" /> Awaiting payment</span>
          <span className="inline-flex items-center gap-1.5"><StatusPill status="PARTIALLY_PAID" /> Partially received</span>
          <span className="inline-flex items-center gap-1.5"><StatusPill status="PAID" /> Fully received</span>
          <span className="inline-flex items-center gap-1.5"><StatusPill status="OVERDUE" /> Past due date</span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-950">Customer activity timeline</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Newest customer documents first. Directly linked project records are marked.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <TimelineFilterButton label="All" active={timelineFilter === "all"} onClick={() => onTimelineFilter("all")} />
            {PROJECT_ACTIVITY_KINDS.filter((kind) => kind !== "contact").map((kind) => (
              <TimelineFilterButton key={kind} label={activityKindLabel(kind)} active={timelineFilter === kind} onClick={() => onTimelineFilter(kind)} />
            ))}
          </div>
        </div>
        {filteredTimeline.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">No activity in this section yet.</div>
        ) : (
          <div className="mt-5 space-y-2">
            {visibleTimeline.map((entry) => <ActivityRow key={`${entry.kind}-${entry.id}`} item={entry} fallbackCurrency={currencyCode} />)}
          </div>
        )}
        {filteredTimeline.length > 12 ? (
          <button type="button" onClick={onToggleTimeline} className="mt-4 text-xs font-semibold text-brand-700 hover:underline">
            {showAllTimeline ? "Show fewer" : `Show all ${filteredTimeline.length} entries`}
          </button>
        ) : null}
      </section>

      <div className="space-y-4">
        {PROJECT_ACTIVITY_KINDS.map((kind) => (
          <ActivityGroupSection key={kind} group={activity.groups[kind]} createHref={createLinks[kind] ?? null} />
        ))}
      </div>
    </div>
  );
}

function TimelineFilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${active ? "bg-brand-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
      {label}
    </button>
  );
}

function ActivityGroupSection({ group, createHref }: { group: ProjectActivityGroup; createHref: string | null }) {
  return (
    <section id={`activity-${group.kind}`} className="scroll-mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-slate-950">{group.label}</h2>
            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{group.count}</span>
            {!group.available ? <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Restricted</span> : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {group.available ? `Total ${formatRupees(group.total, group.currencyCode)}` : `Requires ${group.permission}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={group.listHref} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">View all</Link>
          {createHref ? <Link to={createHref} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700">New</Link> : null}
        </div>
      </div>

      {!group.available ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center text-sm text-slate-500">You do not have permission to view this module.</div>
      ) : group.items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center text-sm text-slate-500">No {group.label.toLowerCase()} for this customer yet.</div>
      ) : (
        <div className="mt-4 space-y-2">
          {group.items.map((entry) => <ActivityRow key={`${group.kind}-${entry.id}`} item={entry} fallbackCurrency={group.currencyCode} />)}
        </div>
      )}
    </section>
  );
}

function ActivityRow({ item, fallbackCurrency }: { item: ProjectActivityItem; fallbackCurrency: string }) {
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-brand-700">{item.number}</span>
          <StatusPill status={item.status} />
          {item.linkedToProject ? <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">Direct link</span> : null}
        </span>
        <span className="mt-1 block truncate text-sm font-semibold text-slate-900">{item.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-slate-500">{activityKindLabel(item.kind)} · {formatDate(item.date)} · {item.meta}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-bold tabular-nums text-slate-950" title={formatRupees(item.amount, item.currencyCode || fallbackCurrency)}>
          {item.kind === "contact" ? "—" : formatRupees(item.amount, item.currencyCode || fallbackCurrency)}
        </span>
        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{item.kind === "contact" ? "Contact" : statusLabel(item.status)}</span>
      </span>
    </>
  );
  const classes = "flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:bg-brand-50/30";
  if (item.href) {
    return <Link to={item.href} className={classes}>{content}</Link>;
  }
  return <div className={classes}>{content}</div>;
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: "slate" | "brand" | "emerald" | "amber" | "rose" }) {
  const accents = {
    slate: "bg-slate-400",
    brand: "bg-brand-600",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${accents[tone]}`} />
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1.5 truncate text-sm font-bold tabular-nums text-slate-950" title={value}>{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = activityStatusTone(status);
  const styles = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    brand: "bg-brand-50 text-brand-800 ring-brand-200",
    emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    rose: "bg-rose-50 text-rose-800 ring-rose-200",
  };
  return (
    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ring-1 ${styles[tone]}`}>
      {statusLabel(status)}
    </span>
  );
}

function activityKindLabel(kind: ProjectActivityKind): string {
  return statusLabel(kind === "salesOrder" ? "sales_order" : kind);
}

function activityStatusTone(status: string): "slate" | "brand" | "emerald" | "amber" | "rose" {
  const value = status.toUpperCase();
  if (["PAID", "RECEIVED", "WON", "CONVERTED", "COMPLETED", "FULFILLED", "ACCEPTED", "ACTIVE", "QUALIFIED"].includes(value)) {
    return "emerald";
  }
  if (["OVERDUE", "VOID", "CANCELLED", "LOST", "UNQUALIFIED", "REJECTED"].includes(value)) {
    return "rose";
  }
  if (["DRAFT", "NEW", "PLANNED", "CONTACTED"].includes(value)) {
    return "slate";
  }
  if (["SENT", "PARTIALLY_PAID", "CONFIRMED", "IN_PROGRESS", "PARTIALLY_FULFILLED"].includes(value)) {
    return "amber";
  }
  return "brand";
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-950">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function MetricCard({ label, value, hint, tone, icon }: { label: string; value: string; hint?: string; tone: "brand" | "emerald" | "slate"; icon: "wallet" | "trend" }) {
  const accents = { brand: "bg-brand-500", emerald: "bg-emerald-500", slate: "bg-slate-400" };
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${accents[tone]}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 truncate text-lg font-bold tracking-tight tabular-nums text-slate-950" title={value}>{value}</p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200">
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      {hint ? <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-400">{hint}</p> : null}
    </div>
  );
}

function ActionTile({ label, description, icon, href, onClick }: { label: string; description: string; icon: IconName; href?: string; onClick?: () => void }) {
  const content = (
    <>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm ring-1 ring-slate-200">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block truncate text-xs font-bold text-slate-900">{label}</span>
        <span className="mt-0.5 block truncate text-[10px] text-slate-500">{description}</span>
      </span>
    </>
  );
  const classes = "flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition enabled:hover:-translate-y-0.5 enabled:hover:border-brand-300 enabled:hover:bg-brand-50/40 enabled:hover:shadow-md";

  if (href) {
    return <Link to={href} className={classes}>{content}</Link>;
  }
  return <button type="button" onClick={onClick} className={classes}>{content}</button>;
}

function Icon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></>,
    pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    alert: <><path d="m10.29 3.86-8.18 14.14A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4M12 17h.01" /></>,
    wallet: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>,
    trend: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>,
    task: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="m8 12 3 3 5-6" /></>,
    call: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.8a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2Z" /></>,
    invoice: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    receipt: <><path d="M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2Z" /><path d="M9 7h6M9 11h6" /></>,
    credit: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></>,
    expense: <><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
    bill: <><path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" /><path d="M9 8h6M9 12h6" /></>,
    vendor: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 21v-4h6v4M8 7h.01M12 7h.01M16 7h.01" /></>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export const ACTIVITY_KINDS = [
  "lead",
  "opportunity",
  "tender",
  "quote",
  "salesOrder",
  "invoice",
  "payment",
  "contact",
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ProjectActivityItem {
  id: string;
  kind: ActivityKind;
  number: string;
  title: string;
  status: string;
  date: string;
  amount: string;
  currencyCode: string;
  href: string | null;
  meta: string;
  linkedToProject: boolean;
}

export interface ProjectActivityGroup {
  kind: ActivityKind;
  label: string;
  permission: string;
  available: boolean;
  count: number;
  total: string;
  currencyCode: string;
  listHref: string;
  items: ProjectActivityItem[];
}

export interface ProjectInvoiceSummary {
  total: string;
  paid: string;
  balance: string;
  count: number;
  draft: number;
  sent: number;
  partiallyPaid: number;
  paidCount: number;
  overdue: number;
  void: number;
  open: number;
}

export interface ProjectLiveFinancials {
  income: string;
  cost: string;
  profit: string;
  marginPercent: string;
  currencyCode: string;
  source: "live";
  breakdown: {
    invoiceTotal: string;
    paymentsReceived: string;
    outstanding: string;
    quoteTotal: string;
    salesOrderTotal: string;
    expenseTotal: string;
    billTotal: string;
    invoiceCount: number;
    paymentCount: number;
  };
}

export interface ProjectActivitySummary {
  customer: {
    id: string;
    customerNumber: string;
    displayName: string;
    email: string | null;
    currencyCode: string;
  } | null;
  generatedAt: string;
  currencyCode: string;
  groups: Record<ActivityKind, ProjectActivityGroup>;
  timeline: ProjectActivityItem[];
  invoiceSummary: ProjectInvoiceSummary;
  financials: ProjectLiveFinancials;
  upcomingModules: { kind: string; label: string; available: boolean }[];
}

type MonetaryValue = string | number | { toString(): string } | null | undefined;
type DateValue = Date | string | null | undefined;

interface ActivityRowBase {
  id: string;
  status?: string;
  currencyCode: string;
  createdAt: DateValue;
}

interface LeadRow extends ActivityRowBase {
  leadNumber: string;
  displayName: string;
  companyName: string | null;
  status: string;
  estimatedValue: MonetaryValue;
  convertedCustomerId: string | null;
}

interface OpportunityRow extends ActivityRowBase {
  opportunityNumber: string;
  title: string;
  stage: string;
  estimatedValue: MonetaryValue;
  expectedCloseDate: DateValue;
  leadId: string | null;
}

interface TenderRow extends ActivityRowBase {
  tenderNumber: string;
  title: string;
  status: string;
  estimatedValue: MonetaryValue;
  submissionDeadline: DateValue;
}

interface QuoteRow extends ActivityRowBase {
  quoteNumber: string;
  status: string;
  total: MonetaryValue;
  issueDate: DateValue;
  customerReference: string | null;
}

interface SalesOrderRow extends ActivityRowBase {
  salesOrderNumber: string;
  status: string;
  total: MonetaryValue;
  orderDate: DateValue;
  customerReference: string | null;
  sourceQuoteId: string | null;
}

interface InvoiceRow extends ActivityRowBase {
  invoiceNumber: string;
  status: string;
  total: MonetaryValue;
  amountPaid: MonetaryValue;
  issueDate: DateValue;
  dueDate: DateValue;
  customerReference: string | null;
  sourceSalesOrderId: string | null;
}

interface PaymentRow extends ActivityRowBase {
  paymentNumber: string;
  amount: MonetaryValue;
  receivedDate: DateValue;
  invoiceId: string;
  method: string;
  reference: string | null;
}

interface ContactRow {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: DateValue;
}

export interface CustomerActivityRows {
  customer: ProjectActivitySummary["customer"];
  leads: LeadRow[];
  opportunities: OpportunityRow[];
  tenders: TenderRow[];
  quotes: QuoteRow[];
  salesOrders: SalesOrderRow[];
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  contacts: ContactRow[];
}

export interface ProjectActivityLinks {
  leadId: string | null;
  opportunityId: string | null;
  quoteId: string | null;
  salesOrderId: string | null;
  invoiceId: string | null;
  contactId: string | null;
}

export function emptyCustomerActivityRows(): CustomerActivityRows {
  return {
    customer: null,
    leads: [],
    opportunities: [],
    tenders: [],
    quotes: [],
    salesOrders: [],
    invoices: [],
    payments: [],
    contacts: [],
  };
}

const groupMeta: Record<ActivityKind, { label: string; permission: string; listHref: string }> = {
  lead: { label: "Leads", permission: "leads:read", listHref: "/leads" },
  opportunity: { label: "Opportunities", permission: "opportunities:read", listHref: "/opportunities" },
  tender: { label: "Tenders", permission: "tenders:read", listHref: "/tenders" },
  quote: { label: "Quotes", permission: "quotes:read", listHref: "/quotes" },
  salesOrder: { label: "Sales orders", permission: "sales-orders:read", listHref: "/sales-orders" },
  invoice: { label: "Invoices", permission: "invoices:read", listHref: "/invoices" },
  payment: { label: "Payments", permission: "payments:read", listHref: "/payments" },
  contact: { label: "Contacts", permission: "customers:read", listHref: "/contacts" },
};

export function buildProjectActivity(
  rows: CustomerActivityRows,
  links: ProjectActivityLinks,
  access: { permissions: string[]; roles: string[] },
): ProjectActivitySummary {
  const currencyCode = rows.customer?.currencyCode ?? "PKR";
  const can = (permission: string) =>
    access.roles.includes("admin") || access.permissions.includes("*") || access.permissions.includes(permission);

  const leadItems = rows.leads.map((row) =>
    item({
      id: row.id,
      kind: "lead",
      number: row.leadNumber,
      title: row.displayName,
      status: row.status,
      date: row.createdAt,
      amount: row.estimatedValue,
      currencyCode: row.currencyCode,
      href: `/leads/${row.id}`,
      meta: row.companyName ?? "Lead",
      linkedToProject: links.leadId === row.id,
    }),
  );

  const opportunityItems = rows.opportunities.map((row) =>
    item({
      id: row.id,
      kind: "opportunity",
      number: row.opportunityNumber,
      title: row.title,
      status: row.stage,
      date: row.expectedCloseDate ?? row.createdAt,
      amount: row.estimatedValue,
      currencyCode: row.currencyCode,
      href: `/opportunities/${row.id}`,
      meta: "Opportunity",
      linkedToProject:
        (links.opportunityId !== null && links.opportunityId === row.id) ||
        (links.leadId !== null && links.leadId === row.leadId),
    }),
  );

  const tenderItems = rows.tenders.map((row) =>
    item({
      id: row.id,
      kind: "tender",
      number: row.tenderNumber,
      title: row.title,
      status: row.status,
      date: row.submissionDeadline ?? row.createdAt,
      amount: row.estimatedValue,
      currencyCode: row.currencyCode,
      href: `/tenders/${row.id}`,
      meta: "Tender",
      linkedToProject: false,
    }),
  );

  const quoteItems = rows.quotes.map((row) =>
    item({
      id: row.id,
      kind: "quote",
      number: row.quoteNumber,
      title: row.customerReference ?? "Quote",
      status: row.status,
      date: row.issueDate,
      amount: row.total,
      currencyCode: row.currencyCode,
      href: `/quotes/${row.id}`,
      meta: "Quote",
      linkedToProject: links.quoteId === row.id,
    }),
  );

  const salesOrderItems = rows.salesOrders.map((row) =>
    item({
      id: row.id,
      kind: "salesOrder",
      number: row.salesOrderNumber,
      title: row.customerReference ?? "Sales order",
      status: row.status,
      date: row.orderDate,
      amount: row.total,
      currencyCode: row.currencyCode,
      href: `/sales-orders/${row.id}`,
      meta: row.sourceQuoteId ? "From quote" : "Sales order",
      linkedToProject: links.salesOrderId === row.id,
    }),
  );

  const invoiceItems = rows.invoices.map((row) =>
    item({
      id: row.id,
      kind: "invoice",
      number: row.invoiceNumber,
      title: row.customerReference ?? "Invoice",
      status: row.status,
      date: row.issueDate,
      amount: row.total,
      currencyCode: row.currencyCode,
      href: `/invoices/${row.id}`,
      meta: `Due ${formatDate(row.dueDate)} · Paid ${money(row.amountPaid)}`,
      linkedToProject:
        (links.invoiceId !== null && links.invoiceId === row.id) ||
        (links.salesOrderId !== null && links.salesOrderId === row.sourceSalesOrderId),
    }),
  );

  const paymentItems = rows.payments.map((row) =>
    item({
      id: row.id,
      kind: "payment",
      number: row.paymentNumber,
      title: row.reference ?? "Payment received",
      status: "RECEIVED",
      date: row.receivedDate,
      amount: row.amount,
      currencyCode: row.currencyCode,
      href: `/payments/${row.id}`,
      meta: `Via ${row.method.replaceAll("_", " ")}`,
      linkedToProject: links.invoiceId !== null && links.invoiceId === row.invoiceId,
    }),
  );

  const contactItems = rows.contacts.map((row) =>
    item({
      id: row.id,
      kind: "contact",
      number: "CONTACT",
      title: row.displayName,
      status: row.status,
      date: row.createdAt,
      amount: "0.00",
      currencyCode,
      href: null,
      meta: row.email ?? row.phone ?? "Customer contact",
      linkedToProject: links.contactId === row.id,
    }),
  );

  const grouped: Record<ActivityKind, ProjectActivityItem[]> = {
    lead: leadItems,
    opportunity: opportunityItems,
    tender: tenderItems,
    quote: quoteItems,
    salesOrder: salesOrderItems,
    invoice: invoiceItems,
    payment: paymentItems,
    contact: contactItems,
  };

  const groups = {} as Record<ActivityKind, ProjectActivityGroup>;
  for (const kind of ACTIVITY_KINDS) {
    const meta = groupMeta[kind];
    const items = can(meta.permission) ? grouped[kind] : [];
    groups[kind] = {
      kind,
      label: meta.label,
      permission: meta.permission,
      available: can(meta.permission),
      count: items.length,
      total: total(items),
      currencyCode,
      listHref: meta.listHref,
      items,
    };
  }

  const timeline = ACTIVITY_KINDS.filter((kind) => kind !== "contact")
    .flatMap((kind) => groups[kind].items)
    .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));

  const invoiceStatusCounts = {
    DRAFT: 0,
    SENT: 0,
    PARTIALLY_PAID: 0,
    PAID: 0,
    OVERDUE: 0,
    VOID: 0,
  } as Record<string, number>;
  for (const row of rows.invoices) {
    const status = row.status in invoiceStatusCounts ? row.status : "DRAFT";
    invoiceStatusCounts[status] += 1;
  }
  const billedInvoices = rows.invoices.filter((row) => row.status !== "VOID");
  const invoiceTotal = billedInvoices.reduce((sum, row) => sum + numeric(row.total), 0);
  const invoicePaid = billedInvoices.reduce((sum, row) => sum + numeric(row.amountPaid), 0);
  const paymentsReceived = rows.payments.reduce((sum, row) => sum + numeric(row.amount), 0);
  const quoteTotal = rows.quotes.reduce((sum, row) => sum + numeric(row.total), 0);
  const salesOrderTotal = rows.salesOrders.reduce((sum, row) => sum + numeric(row.total), 0);
  const expenseTotal = 0;
  const billTotal = 0;
  const cost = expenseTotal + billTotal;
  const profit = invoiceTotal - cost;
  const marginPercent = invoiceTotal > 0 ? (profit / invoiceTotal) * 100 : 0;

  return {
    customer: rows.customer,
    generatedAt: new Date().toISOString(),
    currencyCode,
    groups,
    timeline,
    invoiceSummary: {
      total: fixed(invoiceTotal),
      paid: fixed(invoicePaid),
      balance: fixed(invoiceTotal - invoicePaid),
      count: rows.invoices.length,
      draft: invoiceStatusCounts.DRAFT,
      sent: invoiceStatusCounts.SENT,
      partiallyPaid: invoiceStatusCounts.PARTIALLY_PAID,
      paidCount: invoiceStatusCounts.PAID,
      overdue: invoiceStatusCounts.OVERDUE,
      void: invoiceStatusCounts.VOID,
      open:
        invoiceStatusCounts.DRAFT +
        invoiceStatusCounts.SENT +
        invoiceStatusCounts.PARTIALLY_PAID +
        invoiceStatusCounts.OVERDUE,
    },
    financials: {
      income: fixed(invoiceTotal),
      cost: fixed(cost),
      profit: fixed(profit),
      marginPercent: marginPercent.toFixed(2),
      currencyCode,
      source: "live",
      breakdown: {
        invoiceTotal: fixed(invoiceTotal),
        paymentsReceived: fixed(paymentsReceived),
        outstanding: fixed(invoiceTotal - invoicePaid),
        quoteTotal: fixed(quoteTotal),
        salesOrderTotal: fixed(salesOrderTotal),
        expenseTotal: fixed(expenseTotal),
        billTotal: fixed(billTotal),
        invoiceCount: billedInvoices.length,
        paymentCount: rows.payments.length,
      },
    },
    upcomingModules: [
      { kind: "expense", label: "Expenses", available: false },
      { kind: "bill", label: "Bills", available: false },
    ],
  };
}

function item(input: Omit<ProjectActivityItem, "amount" | "date"> & { amount: MonetaryValue; date: DateValue }): ProjectActivityItem {
  return {
    id: input.id,
    kind: input.kind,
    number: input.number,
    title: input.title,
    status: input.status,
    date: formatDate(input.date),
    amount: money(input.amount),
    currencyCode: input.currencyCode,
    href: input.href,
    meta: input.meta,
    linkedToProject: input.linkedToProject,
  };
}

function numeric(value: MonetaryValue): number {
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = Number(typeof value === "object" ? value.toString() : value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: MonetaryValue): string {
  return fixed(numeric(value));
}

function fixed(value: number): string {
  return value.toFixed(2);
}

function total(items: ProjectActivityItem[]): string {
  return fixed(items.reduce((sum, current) => sum + numeric(current.amount), 0));
}

function formatDate(value: DateValue): string {
  if (!value) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

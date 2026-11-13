import { Prisma } from "@prisma/client";

export const OPEN_INVOICE_STATUSES = ["SENT", "PARTIALLY_PAID", "OVERDUE"] as const;
export const OPEN_QUOTE_STATUSES = ["DRAFT", "SENT"] as const;
export const OPEN_ORDER_STATUSES = ["DRAFT", "CONFIRMED", "PROCESSING"] as const;
export const OPEN_LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED"] as const;
export const OPEN_OPPORTUNITY_STAGES = [
  "NEW",
  "QUALIFICATION",
  "NEEDS_ANALYSIS",
  "PROPOSAL",
  "NEGOTIATION",
] as const;

export const AGING_BUCKETS = ["Current", "1-30", "31-60", "61-90", "90+"] as const;
export type AgingBucketLabel = (typeof AGING_BUCKETS)[number];

export const TREND_MONTHS = 6;

const ZERO = new Prisma.Decimal(0);
const MS_PER_DAY = 86_400_000;

function decimal(
  value: Prisma.Decimal | string | number | null | undefined,
  fallback = "0",
): Prisma.Decimal {
  return new Prisma.Decimal(value?.toString() ?? fallback);
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function deltaPercent(
  current: Prisma.Decimal,
  previous: Prisma.Decimal,
): number | null {
  if (previous.isZero()) {
    return current.isZero() ? 0 : null;
  }
  return Number(current.sub(previous).div(previous).mul(100).toFixed(1));
}

export interface InvoiceBalanceRow {
  status: string;
  dueDate?: Date | string | null;
  totalBase: Prisma.Decimal | null;
  amountPaid: Prisma.Decimal;
  exchangeRateToBase: Prisma.Decimal | null;
}

function invoiceBalance(row: InvoiceBalanceRow): Prisma.Decimal {
  const totalBase = decimal(row.totalBase);
  const paidBase = decimal(row.amountPaid).mul(decimal(row.exchangeRateToBase, "1"));
  const balance = totalBase.sub(paidBase);
  return balance.isNegative() ? ZERO : balance;
}

export function buildOutstanding(rows: InvoiceBalanceRow[]) {
  let outstanding = ZERO;
  let overdue = ZERO;
  let overdueCount = 0;

  for (const row of rows) {
    const balance = invoiceBalance(row);
    outstanding = outstanding.add(balance);
    if (row.status === "OVERDUE") {
      overdueCount += 1;
      overdue = overdue.add(balance);
    }
  }

  return {
    openCount: rows.length,
    overdueCount,
    outstandingBase: outstanding.toFixed(4),
    overdueBase: overdue.toFixed(4),
  };
}

export function buildAging(rows: InvoiceBalanceRow[], now = new Date()) {
  const totals = new Map<AgingBucketLabel, { count: number; valueBase: Prisma.Decimal }>(
    AGING_BUCKETS.map((bucket) => [bucket, { count: 0, valueBase: ZERO }]),
  );

  for (const row of rows) {
    const balance = invoiceBalance(row);
    let label: AgingBucketLabel = "Current";

    if (row.dueDate) {
      const overdueDays = Math.floor(
        (now.getTime() - toDate(row.dueDate).getTime()) / MS_PER_DAY,
      );
      if (overdueDays > 90) label = "90+";
      else if (overdueDays > 60) label = "61-90";
      else if (overdueDays > 30) label = "31-60";
      else if (overdueDays > 0) label = "1-30";
    }

    const entry = totals.get(label)!;
    entry.count += 1;
    entry.valueBase = entry.valueBase.add(balance);
  }

  return AGING_BUCKETS.map((bucket) => {
    const entry = totals.get(bucket)!;
    return { bucket, count: entry.count, valueBase: entry.valueBase.toFixed(4) };
  });
}

export interface TrendInvoiceRow {
  issueDate: Date | string;
  totalBase: Prisma.Decimal | null;
}

export interface TrendPaymentRow {
  receivedDate: Date | string;
  amount: Prisma.Decimal;
  exchangeRateToBase: Prisma.Decimal | null;
}

export function buildTrend(
  invoiceRows: TrendInvoiceRow[],
  paymentRows: TrendPaymentRow[],
  months = TREND_MONTHS,
  now = new Date(),
) {
  const buckets: { period: string; invoiced: Prisma.Decimal; collected: Prisma.Decimal }[] = [];
  const index = new Map<string, number>();

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const key = monthKey(date);
    index.set(key, buckets.length);
    buckets.push({ period: key, invoiced: ZERO, collected: ZERO });
  }

  for (const row of invoiceRows) {
    const position = index.get(monthKey(toDate(row.issueDate)));
    if (position !== undefined) {
      buckets[position].invoiced = buckets[position].invoiced.add(decimal(row.totalBase));
    }
  }

  for (const row of paymentRows) {
    const position = index.get(monthKey(toDate(row.receivedDate)));
    if (position !== undefined) {
      const amountBase = decimal(row.amount).mul(decimal(row.exchangeRateToBase, "1"));
      buckets[position].collected = buckets[position].collected.add(amountBase);
    }
  }

  return buckets.map((bucket) => ({
    period: bucket.period,
    invoicedBase: bucket.invoiced.toFixed(4),
    collectedBase: bucket.collected.toFixed(4),
  }));
}

export interface OpportunityValueRow {
  stage: string;
  estimatedValueBase: Prisma.Decimal | null;
  probabilityPercent: number;
}

export function buildPipeline(rows: OpportunityValueRow[]) {
  let pipelineValueBase = ZERO;
  let weightedPipelineBase = ZERO;
  const stages = new Map<string, { count: number; valueBase: Prisma.Decimal }>();

  for (const row of rows) {
    const valueBase = decimal(row.estimatedValueBase);
    pipelineValueBase = pipelineValueBase.add(valueBase);
    weightedPipelineBase = weightedPipelineBase.add(
      valueBase.mul(row.probabilityPercent).div(100),
    );

    const current = stages.get(row.stage) ?? { count: 0, valueBase: ZERO };
    stages.set(row.stage, {
      count: current.count + 1,
      valueBase: current.valueBase.add(valueBase),
    });
  }

  return {
    openCount: rows.length,
    pipelineValueBase: pipelineValueBase.toFixed(4),
    weightedPipelineBase: weightedPipelineBase.toFixed(4),
    byStage: OPEN_OPPORTUNITY_STAGES.flatMap((stage) => {
      const entry = stages.get(stage);
      return entry
        ? [{ stage, count: entry.count, valueBase: entry.valueBase.toFixed(4) }]
        : [];
    }),
  };
}

export interface AggregateTotals {
  _count: { _all: number };
  _sum?: { estimatedValueBase: Prisma.Decimal | null };
}

export function buildWinRate(won: AggregateTotals, lost: AggregateTotals) {
  const wonCount = won._count._all;
  const lostCount = lost._count._all;
  const decided = wonCount + lostCount;
  const winRatePercent = decided === 0 ? 0 : Number(((wonCount / decided) * 100).toFixed(1));

  return {
    wonCount,
    lostCount,
    wonValueBase: decimal(won._sum?.estimatedValueBase).toFixed(4),
    winRatePercent,
  };
}

export interface LeadStatusRow {
  status: string;
  _count: { _all: number };
}

export function buildLeadMetrics(rows: LeadStatusRow[]) {
  const counts = new Map(rows.map((row) => [row.status, row._count._all]));
  const total = rows.reduce((sum, row) => sum + row._count._all, 0);
  const convertedCount = (counts.get("CONVERTED") ?? 0) + (counts.get("WON") ?? 0);

  return {
    total,
    open: OPEN_LEAD_STATUSES.reduce((sum, status) => sum + (counts.get(status) ?? 0), 0),
    newCount: counts.get("NEW") ?? 0,
    qualifiedCount: counts.get("QUALIFIED") ?? 0,
    convertedCount,
    conversionRatePercent:
      total === 0 ? 0 : Number(((convertedCount / total) * 100).toFixed(1)),
  };
}

export interface LeadSourceRow {
  source: string | null;
  status: string;
  _count: { _all: number };
}

export function buildSourceRows(rows: LeadSourceRow[]) {
  const sources = new Map<string, { total: number; qualified: number; converted: number }>();

  for (const row of rows) {
    const source = row.source ?? "OTHER";
    const entry = sources.get(source) ?? { total: 0, qualified: 0, converted: 0 };
    entry.total += row._count._all;
    if (row.status === "QUALIFIED") entry.qualified += row._count._all;
    if (row.status === "CONVERTED" || row.status === "WON") entry.converted += row._count._all;
    sources.set(source, entry);
  }

  return [...sources.entries()]
    .map(([source, entry]) => ({ source, ...entry }))
    .sort((a, b) => b.total - a.total);
}

export interface TopCustomerRow {
  customerId: string | null;
  totalBase: Prisma.Decimal | null;
  customer: { displayName: string } | null;
}

export function buildTopCustomers(rows: TopCustomerRow[], limit = 5) {
  const totals = new Map<string, { name: string; valueBase: Prisma.Decimal; count: number }>();

  for (const row of rows) {
    if (!row.customerId) continue;
    const entry = totals.get(row.customerId) ?? {
      name: row.customer?.displayName ?? "Unknown",
      valueBase: ZERO,
      count: 0,
    };
    entry.valueBase = entry.valueBase.add(decimal(row.totalBase));
    entry.count += 1;
    totals.set(row.customerId, entry);
  }

  return [...totals.entries()]
    .map(([id, entry]) => ({
      id,
      name: entry.name,
      invoicedBase: entry.valueBase.toFixed(4),
      invoiceCount: entry.count,
    }))
    .sort((a, b) => Number(b.invoicedBase) - Number(a.invoicedBase))
    .slice(0, limit);
}

export interface StatusCountRow {
  status: string;
  _count: { _all: number };
}

export function buildStatusCounts(rows: StatusCountRow[]) {
  return rows
    .map((row) => ({ status: row.status, count: row._count._all }))
    .sort((a, b) => b.count - a.count);
}

export function buildFunnel(
  leads: { total: number; qualifiedCount: number; convertedCount: number },
  pipeline: { openCount: number },
  winRate: { wonCount: number },
) {
  return [
    { key: "leads", label: "Leads captured", count: leads.total },
    { key: "qualified", label: "Qualified", count: leads.qualifiedCount },
    { key: "opportunities", label: "Open pipeline", count: pipeline.openCount },
    { key: "won", label: "Won", count: winRate.wonCount },
  ];
}

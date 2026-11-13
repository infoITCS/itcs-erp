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

const ZERO = new Prisma.Decimal(0);

function decimal(
  value: Prisma.Decimal | string | number | null | undefined,
  fallback = "0",
): Prisma.Decimal {
  return new Prisma.Decimal(value?.toString() ?? fallback);
}

export interface InvoiceBalanceRow {
  status: string;
  totalBase: Prisma.Decimal | null;
  amountPaid: Prisma.Decimal;
  exchangeRateToBase: Prisma.Decimal | null;
}

export function buildInvoiceMetrics(rows: InvoiceBalanceRow[]) {
  let outstanding = ZERO;
  let overdue = ZERO;
  let overdueCount = 0;

  for (const row of rows) {
    const totalBase = decimal(row.totalBase);
    const paidBase = decimal(row.amountPaid).mul(decimal(row.exchangeRateToBase, "1"));
    let balance = totalBase.sub(paidBase);
    if (balance.isNegative()) {
      balance = ZERO;
    }

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

export interface PaymentBaseRow {
  amount: Prisma.Decimal;
  exchangeRateToBase: Prisma.Decimal | null;
}

export function buildPaymentMetrics(rows: PaymentBaseRow[]) {
  const receivedBase = rows.reduce(
    (sum, row) => sum.add(decimal(row.amount).mul(decimal(row.exchangeRateToBase, "1"))),
    ZERO,
  );

  return {
    countThisMonth: rows.length,
    receivedThisMonthBase: receivedBase.toFixed(4),
  };
}

export interface StatusTotalRow {
  status: string;
  _count: { _all: number };
  _sum: { totalBase: Prisma.Decimal | null };
}

export function buildStatusValueMetrics(rows: StatusTotalRow[], openStatuses: readonly string[]) {
  const openRows = rows.filter((row) => openStatuses.includes(row.status));
  const openValueBase = openRows.reduce(
    (sum, row) => sum.add(decimal(row._sum.totalBase)),
    ZERO,
  );

  return {
    openCount: openRows.reduce((sum, row) => sum + row._count._all, 0),
    openValueBase: openValueBase.toFixed(4),
  };
}

export interface LeadStatusRow {
  status: string;
  _count: { _all: number };
}

export function buildLeadMetrics(rows: LeadStatusRow[]) {
  const counts = new Map(rows.map((row) => [row.status, row._count._all]));
  const totalCount = rows.reduce((sum, row) => sum + row._count._all, 0);

  return {
    totalCount,
    openCount: OPEN_LEAD_STATUSES.reduce((sum, status) => sum + (counts.get(status) ?? 0), 0),
    newCount: counts.get("NEW") ?? 0,
    qualifiedCount: counts.get("QUALIFIED") ?? 0,
  };
}

export interface OpportunityValueRow {
  stage: string;
  estimatedValueBase: Prisma.Decimal | null;
  probabilityPercent: number;
}

export interface WonOpportunityTotals {
  _count: { _all: number };
  _sum: { estimatedValueBase: Prisma.Decimal | null };
}

export function buildOpportunityMetrics(
  rows: OpportunityValueRow[],
  won: WonOpportunityTotals,
) {
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
    wonThisMonthCount: won._count._all,
    wonThisMonthBase: decimal(won._sum.estimatedValueBase).toFixed(4),
    stageBreakdown: OPEN_OPPORTUNITY_STAGES.flatMap((stage) => {
      const entry = stages.get(stage);
      return entry
        ? [
            {
              stage,
              count: entry.count,
              valueBase: entry.valueBase.toFixed(4),
            },
          ]
        : [];
    }),
  };
}

export function monthWindow(now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { from, to };
}

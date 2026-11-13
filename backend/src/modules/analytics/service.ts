import { Prisma } from "@prisma/client";
import { NotFoundError } from "../../common/errors/app-error";
import type { AnalyticsRepository } from "./repository";
import {
  buildAging,
  buildFunnel,
  buildLeadMetrics,
  buildOutstanding,
  buildPipeline,
  buildSourceRows,
  buildStatusCounts,
  buildTopCustomers,
  buildTrend,
  buildWinRate,
  deltaPercent,
  TREND_MONTHS,
} from "./summary";

export type AnalyticsRange = "30d" | "90d" | "12m" | "all";

const RANGE_DAYS: Record<Exclude<AnalyticsRange, "all">, number> = {
  "30d": 30,
  "90d": 90,
  "12m": 365,
};

const ZERO = new Prisma.Decimal(0);
const MS_PER_DAY = 86_400_000;

interface DatedRow {
  [key: string]: unknown;
}

function periodWindow(range: AnalyticsRange, now: Date) {
  if (range === "all") {
    return { from: null as Date | null, to: now };
  }
  const days = RANGE_DAYS[range];
  return { from: new Date(now.getTime() - days * MS_PER_DAY), to: now };
}

function previousWindow(from: Date | null, to: Date) {
  if (!from) return null;
  const span = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - span), to: from };
}

function inWindow<T extends DatedRow>(
  rows: T[],
  field: keyof T,
  from: Date | null,
  to: Date | null,
): T[] {
  return rows.filter((row) => {
    const time = new Date(row[field] as Date | string).getTime();
    if (from && time < from.getTime()) return false;
    if (to && time >= to.getTime()) return false;
    return true;
  });
}

function sumInvoiceBase(rows: { totalBase: Prisma.Decimal | null }[]) {
  return rows.reduce((sum, row) => sum.add(new Prisma.Decimal(row.totalBase?.toString() ?? "0")), ZERO);
}

function sumPaymentBase(
  rows: { amount: Prisma.Decimal; invoice: { exchangeRateToBase: Prisma.Decimal | null } | null }[],
) {
  return rows.reduce((sum, row) => {
    const rate = new Prisma.Decimal(row.invoice?.exchangeRateToBase?.toString() ?? "1");
    return sum.add(new Prisma.Decimal(row.amount).mul(rate));
  }, ZERO);
}

export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async get(organizationId: string, permissions: string[], range: AnalyticsRange) {
    const canInvoices = permissions.includes("invoices:read");
    const canPayments = permissions.includes("payments:read");
    const canQuotes = permissions.includes("quotes:read");
    const canOrders = permissions.includes("sales-orders:read");
    const canLeads = permissions.includes("leads:read");
    const canOpportunities = permissions.includes("opportunities:read");
    const canCustomers = permissions.includes("customers:read");

    const now = new Date();
    const period = periodWindow(range, now);
    const previous = previousWindow(period.from, period.to);
    const fetchFrom = previous ? previous.from : period.from;

    const [
      organization,
      invoiceRows,
      paymentRows,
      openInvoiceRows,
      opportunityRows,
      wonAggregate,
      lostAggregate,
      leadStatusRows,
      leadSourceRows,
      customerTotals,
      quoteRows,
      orderRows,
      invoiceStatusRows,
    ] = await Promise.all([
      this.repository.findOrganization(organizationId),
      canInvoices
        ? this.repository.invoicesIssued(organizationId, fetchFrom, now)
        : Promise.resolve([]),
      canPayments
        ? this.repository.paymentsReceived(organizationId, fetchFrom, now)
        : Promise.resolve([]),
      canInvoices ? this.repository.openInvoices(organizationId) : Promise.resolve([]),
      canOpportunities
        ? this.repository.openOpportunities(organizationId)
        : Promise.resolve([]),
      canOpportunities
        ? this.repository.wonOpportunities(organizationId, period.from, now)
        : Promise.resolve({ _count: { _all: 0 }, _sum: { estimatedValueBase: null } }),
      canOpportunities
        ? this.repository.lostOpportunities(organizationId, period.from, now)
        : Promise.resolve({ _count: { _all: 0 } }),
      canLeads
        ? this.repository.leadStatusCounts(organizationId, period.from, now)
        : Promise.resolve([]),
      canLeads
        ? this.repository.leadSourceCounts(organizationId, period.from, now)
        : Promise.resolve([]),
      canCustomers
        ? this.repository.customerCounts(organizationId, period.from, now)
        : Promise.resolve([0, 0] as [number, number]),
      canQuotes ? this.repository.quoteStatusCounts(organizationId) : Promise.resolve([]),
      canOrders
        ? this.repository.salesOrderStatusCounts(organizationId)
        : Promise.resolve([]),
      canInvoices
        ? this.repository.invoiceStatusCounts(organizationId)
        : Promise.resolve([]),
    ]);

    if (!organization) {
      throw new NotFoundError("Organization not found");
    }

    const currentInvoices = inWindow(invoiceRows, "issueDate", period.from, now);
    const previousInvoices = previous
      ? inWindow(invoiceRows, "issueDate", previous.from, period.from)
      : [];
    const currentPayments = inWindow(paymentRows, "receivedDate", period.from, now);
    const previousPayments = previous
      ? inWindow(paymentRows, "receivedDate", previous.from, period.from)
      : [];

    const outstanding = buildOutstanding(openInvoiceRows);
    const pipeline = buildPipeline(opportunityRows);
    const winRate = buildWinRate(wonAggregate, lostAggregate);
    const leads = buildLeadMetrics(leadStatusRows);

    const invoicedCurrent = sumInvoiceBase(currentInvoices);
    const invoicedPrevious = sumInvoiceBase(previousInvoices);
    const revenueCurrent = sumPaymentBase(currentPayments);
    const revenuePrevious = sumPaymentBase(previousPayments);

    const openQuotes = quoteRows.filter((row) => row.status === "DRAFT" || row.status === "SENT");
    const openQuoteValue = openQuotes.reduce(
      (sum, row) => sum.add(new Prisma.Decimal(row._sum?.totalBase?.toString() ?? "0")),
      ZERO,
    );
    const acceptedQuotes = quoteRows.find((row) => row.status === "ACCEPTED")?._count._all ?? 0;

    return {
      generatedAt: now.toISOString(),
      baseCurrencyCode: organization.baseCurrencyCode,
      range,
      period: {
        from: period.from ? period.from.toISOString() : null,
        to: now.toISOString(),
      },
      kpis: {
        revenue: canPayments
          ? {
              valueBase: revenueCurrent.toFixed(4),
              count: currentPayments.length,
              previousValueBase: revenuePrevious.toFixed(4),
              deltaPercent: deltaPercent(revenueCurrent, revenuePrevious),
            }
          : null,
        invoiced: canInvoices
          ? {
              valueBase: invoicedCurrent.toFixed(4),
              count: currentInvoices.length,
              previousValueBase: invoicedPrevious.toFixed(4),
              deltaPercent: deltaPercent(invoicedCurrent, invoicedPrevious),
            }
          : null,
        outstanding: canInvoices ? outstanding : null,
        pipeline: canOpportunities
          ? {
              openCount: pipeline.openCount,
              pipelineValueBase: pipeline.pipelineValueBase,
              weightedPipelineBase: pipeline.weightedPipelineBase,
            }
          : null,
        winRate: canOpportunities ? winRate : null,
        leads: canLeads ? leads : null,
        customers: canCustomers
          ? { total: customerTotals[0], newThisPeriod: customerTotals[1] }
          : null,
        quotes: canQuotes
          ? {
              openCount: openQuotes.reduce((sum, row) => sum + row._count._all, 0),
              openValueBase: openQuoteValue.toFixed(4),
              acceptedCount: acceptedQuotes,
            }
          : null,
      },
      revenueTrend: buildTrend(
        invoiceRows.map((row) => ({ issueDate: row.issueDate, totalBase: row.totalBase })),
        paymentRows.map((row) => ({
          receivedDate: row.receivedDate,
          amount: row.amount,
          exchangeRateToBase: row.invoice?.exchangeRateToBase ?? null,
        })),
        TREND_MONTHS,
        now,
      ),
      pipelineByStage: pipeline.byStage,
      leadsBySource: buildSourceRows(leadSourceRows),
      invoiceAging: buildAging(openInvoiceRows, now),
      topCustomers: buildTopCustomers(currentInvoices, 20),
      statusMix: {
        quotes: buildStatusCounts(quoteRows),
        orders: buildStatusCounts(orderRows),
        invoices: buildStatusCounts(invoiceStatusRows),
      },
      funnel: buildFunnel(leads, pipeline, winRate),
    };
  }
}

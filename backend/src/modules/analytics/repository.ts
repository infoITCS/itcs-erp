import type { PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { OPEN_INVOICE_STATUSES, OPEN_OPPORTUNITY_STAGES } from "./summary";

/** Analytics reads run against the read client so reporting can move to a replica later. */
export class AnalyticsRepository extends BaseRepository {
  constructor(db: PrismaClient, protected readonly readDb: PrismaClient) {
    super(db);
  }

  private get read(): PrismaClient {
    return this.readDb;
  }

  findOrganization(organizationId: string) {
    return this.read.organization.findUnique({
      where: { id: organizationId },
      select: { baseCurrencyCode: true },
    });
  }

  invoicesIssued(organizationId: string, from: Date | null, to: Date) {
    return this.read.invoice.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(from ? { issueDate: { gte: from, lt: to } } : {}),
      },
      select: {
        id: true,
        issueDate: true,
        totalBase: true,
        status: true,
        customerId: true,
        customer: { select: { displayName: true } },
      },
    });
  }

  paymentsReceived(organizationId: string, from: Date | null, to: Date) {
    return this.read.payment.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(from ? { receivedDate: { gte: from, lt: to } } : {}),
      },
      select: {
        receivedDate: true,
        amount: true,
        invoice: { select: { exchangeRateToBase: true } },
      },
    });
  }

  openInvoices(organizationId: string) {
    return this.read.invoice.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: [...OPEN_INVOICE_STATUSES] },
      },
      select: {
        status: true,
        dueDate: true,
        totalBase: true,
        amountPaid: true,
        exchangeRateToBase: true,
      },
    });
  }

  openOpportunities(organizationId: string) {
    return this.read.opportunity.findMany({
      where: {
        organizationId,
        deletedAt: null,
        stage: { in: [...OPEN_OPPORTUNITY_STAGES] },
      },
      select: {
        stage: true,
        estimatedValueBase: true,
        probabilityPercent: true,
      },
    });
  }

  wonOpportunities(organizationId: string, from: Date | null, to: Date) {
    return this.read.opportunity.aggregate({
      where: {
        organizationId,
        deletedAt: null,
        stage: "WON",
        ...(from ? { wonAt: { gte: from, lt: to } } : {}),
      },
      _count: { _all: true },
      _sum: { estimatedValueBase: true },
    });
  }

  lostOpportunities(organizationId: string, from: Date | null, to: Date) {
    return this.read.opportunity.aggregate({
      where: {
        organizationId,
        deletedAt: null,
        stage: "LOST",
        ...(from ? { lostAt: { gte: from, lt: to } } : {}),
      },
      _count: { _all: true },
    });
  }

  leadStatusCounts(organizationId: string, from: Date | null, to: Date) {
    return this.read.lead.groupBy({
      by: ["status"],
      where: {
        organizationId,
        deletedAt: null,
        ...(from ? { createdAt: { gte: from, lt: to } } : {}),
      },
      _count: { _all: true },
    });
  }

  leadSourceCounts(organizationId: string, from: Date | null, to: Date) {
    return this.read.lead.groupBy({
      by: ["source", "status"],
      where: {
        organizationId,
        deletedAt: null,
        ...(from ? { createdAt: { gte: from, lt: to } } : {}),
      },
      _count: { _all: true },
    });
  }

  customerCounts(organizationId: string, from: Date | null, to: Date) {
    return Promise.all([
      this.read.customer.count({ where: { organizationId, deletedAt: null } }),
      this.read.customer.count({
        where: {
          organizationId,
          deletedAt: null,
          ...(from ? { createdAt: { gte: from, lt: to } } : {}),
        },
      }),
    ]);
  }

  quoteStatusCounts(organizationId: string) {
    return this.read.quote.groupBy({
      by: ["status"],
      where: { organizationId, deletedAt: null },
      _count: { _all: true },
      _sum: { totalBase: true },
    });
  }

  salesOrderStatusCounts(organizationId: string) {
    return this.read.salesOrder.groupBy({
      by: ["status"],
      where: { organizationId, deletedAt: null },
      _count: { _all: true },
    });
  }

  invoiceStatusCounts(organizationId: string) {
    return this.read.invoice.groupBy({
      by: ["status"],
      where: { organizationId, deletedAt: null },
      _count: { _all: true },
    });
  }
}

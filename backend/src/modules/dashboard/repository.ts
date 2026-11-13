import type { PrismaClient } from "@prisma/client";
import { OPEN_INVOICE_STATUSES, OPEN_OPPORTUNITY_STAGES } from "./summary";

export class DashboardRepository {
  constructor(private readonly db: PrismaClient) {}

  findOrganization(organizationId: string) {
    return this.db.organization.findUnique({
      where: { id: organizationId },
      select: { baseCurrencyCode: true },
    });
  }

  openInvoiceBalances(organizationId: string) {
    return this.db.invoice.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: [...OPEN_INVOICE_STATUSES] },
      },
      select: {
        status: true,
        totalBase: true,
        amountPaid: true,
        exchangeRateToBase: true,
      },
    });
  }

  monthlyPayments(organizationId: string, from: Date, to: Date) {
    return this.db.payment.findMany({
      where: {
        organizationId,
        deletedAt: null,
        receivedDate: { gte: from, lt: to },
      },
      select: {
        amount: true,
        invoice: { select: { exchangeRateToBase: true } },
      },
    });
  }

  quoteStatusTotals(organizationId: string) {
    return this.db.quote.groupBy({
      by: ["status"],
      where: { organizationId, deletedAt: null },
      _count: { _all: true },
      _sum: { totalBase: true },
    });
  }

  salesOrderStatusTotals(organizationId: string) {
    return this.db.salesOrder.groupBy({
      by: ["status"],
      where: { organizationId, deletedAt: null },
      _count: { _all: true },
      _sum: { totalBase: true },
    });
  }

  leadStatusCounts(organizationId: string) {
    return this.db.lead.groupBy({
      by: ["status"],
      where: { organizationId, deletedAt: null },
      _count: { _all: true },
    });
  }

  openOpportunityValues(organizationId: string) {
    return this.db.opportunity.findMany({
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

  wonOpportunityTotals(organizationId: string, from: Date) {
    return this.db.opportunity.aggregate({
      where: {
        organizationId,
        deletedAt: null,
        stage: "WON",
        wonAt: { gte: from },
      },
      _count: { _all: true },
      _sum: { estimatedValueBase: true },
    });
  }

  recentInvoices(organizationId: string, take = 5) {
    return this.db.invoice.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        issueDate: true,
        dueDate: true,
        total: true,
        totalBase: true,
        amountPaid: true,
        currencyCode: true,
        customer: { select: { displayName: true } },
      },
    });
  }

  recentPayments(organizationId: string, take = 5) {
    return this.db.payment.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        paymentNumber: true,
        receivedDate: true,
        method: true,
        amount: true,
        currencyCode: true,
        customer: { select: { displayName: true } },
        invoice: { select: { invoiceNumber: true } },
      },
    });
  }

  recentLeads(organizationId: string, take = 5) {
    return this.db.lead.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        leadNumber: true,
        displayName: true,
        companyName: true,
        status: true,
        priority: true,
        estimatedValue: true,
        currencyCode: true,
        createdAt: true,
      },
    });
  }
}

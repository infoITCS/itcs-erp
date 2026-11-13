import { NotFoundError } from "../../common/errors/app-error";
import type { DashboardRepository } from "./repository";
import {
  buildInvoiceMetrics,
  buildLeadMetrics,
  buildOpportunityMetrics,
  buildPaymentMetrics,
  buildStatusValueMetrics,
  monthWindow,
  OPEN_ORDER_STATUSES,
  OPEN_QUOTE_STATUSES,
} from "./summary";

const RECENT_LIMIT = 5;

function hasAny(permissions: string[], codes: string[]): boolean {
  return codes.some((code) => permissions.includes(code));
}

export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  async get(organizationId: string, permissions: string[]) {
    const canQuotes = permissions.includes("quotes:read");
    const canOrders = permissions.includes("sales-orders:read");
    const canInvoices = permissions.includes("invoices:read");
    const canPayments = permissions.includes("payments:read");
    const canLeads = permissions.includes("leads:read");
    const canOpportunities = permissions.includes("opportunities:read");
    const canSales = hasAny(permissions, [
      "quotes:read",
      "sales-orders:read",
      "invoices:read",
      "payments:read",
    ]);
    const canCrm = canLeads || canOpportunities;
    const now = new Date();
    const { from, to } = monthWindow(now);

    const [
      organization,
      invoiceRows,
      paymentRows,
      quoteRows,
      orderRows,
      leadRows,
      opportunityRows,
      wonOpportunities,
      recentInvoices,
      recentPayments,
      recentLeads,
    ] = await Promise.all([
      this.repository.findOrganization(organizationId),
      canInvoices ? this.repository.openInvoiceBalances(organizationId) : Promise.resolve([]),
      canPayments
        ? this.repository.monthlyPayments(organizationId, from, to)
        : Promise.resolve([]),
      canQuotes ? this.repository.quoteStatusTotals(organizationId) : Promise.resolve([]),
      canOrders ? this.repository.salesOrderStatusTotals(organizationId) : Promise.resolve([]),
      canLeads ? this.repository.leadStatusCounts(organizationId) : Promise.resolve([]),
      canOpportunities
        ? this.repository.openOpportunityValues(organizationId)
        : Promise.resolve([]),
      canOpportunities
        ? this.repository.wonOpportunityTotals(organizationId, from)
        : Promise.resolve({ _count: { _all: 0 }, _sum: { estimatedValueBase: null } }),
      canInvoices
        ? this.repository.recentInvoices(organizationId, RECENT_LIMIT)
        : Promise.resolve([]),
      canPayments
        ? this.repository.recentPayments(organizationId, RECENT_LIMIT)
        : Promise.resolve([]),
      canLeads
        ? this.repository.recentLeads(organizationId, RECENT_LIMIT)
        : Promise.resolve([]),
    ]);

    if (!organization) {
      throw new NotFoundError("Organization not found");
    }

    return {
      generatedAt: now.toISOString(),
      baseCurrencyCode: organization.baseCurrencyCode,
      sales: canSales
        ? {
            quotes: canQuotes
              ? buildStatusValueMetrics(quoteRows, OPEN_QUOTE_STATUSES)
              : null,
            orders: canOrders
              ? buildStatusValueMetrics(orderRows, OPEN_ORDER_STATUSES)
              : null,
            invoices: canInvoices ? buildInvoiceMetrics(invoiceRows) : null,
            payments: canPayments
              ? buildPaymentMetrics(
                  paymentRows.map((row) => ({
                    amount: row.amount,
                    exchangeRateToBase: row.invoice.exchangeRateToBase,
                  })),
                )
              : null,
          }
        : null,
      crm: canCrm
        ? {
            leads: canLeads ? buildLeadMetrics(leadRows) : null,
            opportunities: canOpportunities
              ? buildOpportunityMetrics(opportunityRows, wonOpportunities)
              : null,
          }
        : null,
      recent: {
        invoices: recentInvoices,
        payments: recentPayments,
        leads: recentLeads,
      },
    };
  }
}

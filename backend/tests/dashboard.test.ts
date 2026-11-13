import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import type { DashboardRepository } from "../src/modules/dashboard/repository";
import { DashboardService } from "../src/modules/dashboard/service";
import {
  buildInvoiceMetrics,
  buildLeadMetrics,
  buildOpportunityMetrics,
  buildPaymentMetrics,
  buildStatusValueMetrics,
  monthWindow,
  OPEN_QUOTE_STATUSES,
} from "../src/modules/dashboard/summary";

const d = (value: string) => new Prisma.Decimal(value);

describe("dashboard metrics", () => {
  it("converts paid amounts to base currency when calculating receivables", () => {
    const metrics = buildInvoiceMetrics([
      {
        status: "SENT",
        totalBase: d("1000"),
        amountPaid: d("100"),
        exchangeRateToBase: d("2"),
      },
      {
        status: "OVERDUE",
        totalBase: d("500"),
        amountPaid: d("0"),
        exchangeRateToBase: d("1"),
      },
    ]);

    assert.deepEqual(metrics, {
      openCount: 2,
      overdueCount: 1,
      outstandingBase: "1300.0000",
      overdueBase: "500.0000",
    });
  });

  it("keeps only open quotes in the sales value summary", () => {
    const metrics = buildStatusValueMetrics(
      [
        {
          status: "DRAFT",
          _count: { _all: 2 },
          _sum: { totalBase: d("300") },
        },
        {
          status: "SENT",
          _count: { _all: 1 },
          _sum: { totalBase: d("150") },
        },
        {
          status: "ACCEPTED",
          _count: { _all: 4 },
          _sum: { totalBase: d("900") },
        },
      ],
      OPEN_QUOTE_STATUSES,
    );

    assert.deepEqual(metrics, { openCount: 3, openValueBase: "450.0000" });
  });

  it("converts monthly receipts into the organization base currency", () => {
    const metrics = buildPaymentMetrics([
      { amount: d("100"), exchangeRateToBase: d("2") },
      { amount: d("50"), exchangeRateToBase: null },
    ]);

    assert.deepEqual(metrics, {
      countThisMonth: 2,
      receivedThisMonthBase: "250.0000",
    });
  });

  it("separates active leads from new and qualified leads", () => {
    const metrics = buildLeadMetrics([
      { status: "NEW", _count: { _all: 3 } },
      { status: "CONTACTED", _count: { _all: 2 } },
      { status: "QUALIFIED", _count: { _all: 1 } },
      { status: "WON", _count: { _all: 4 } },
    ]);

    assert.deepEqual(metrics, {
      totalCount: 10,
      openCount: 6,
      newCount: 3,
      qualifiedCount: 1,
    });
  });

  it("builds a weighted pipeline with a stage breakdown", () => {
    const metrics = buildOpportunityMetrics(
      [
        { stage: "NEW", estimatedValueBase: d("1000"), probabilityPercent: 10 },
        { stage: "PROPOSAL", estimatedValueBase: d("500"), probabilityPercent: 60 },
      ],
      {
        _count: { _all: 2 },
        _sum: { estimatedValueBase: d("800") },
      },
    );

    assert.equal(metrics.openCount, 2);
    assert.equal(metrics.pipelineValueBase, "1500.0000");
    assert.equal(metrics.weightedPipelineBase, "400.0000");
    assert.equal(metrics.wonThisMonthCount, 2);
    assert.equal(metrics.wonThisMonthBase, "800.0000");
    assert.deepEqual(metrics.stageBreakdown, [
      { stage: "NEW", count: 1, valueBase: "1000.0000" },
      { stage: "PROPOSAL", count: 1, valueBase: "500.0000" },
    ]);
  });

  it("uses UTC month boundaries", () => {
    const { from, to } = monthWindow(new Date("2026-11-11T23:30:00.000Z"));
    assert.equal(from.toISOString(), "2026-11-01T00:00:00.000Z");
    assert.equal(to.toISOString(), "2026-12-01T00:00:00.000Z");
  });
});

describe("dashboard permissions", () => {
  it("does not query or expose modules the user cannot read", async () => {
    const calls = { invoices: 0, leads: 0 };
    const repository = {
      findOrganization: async () => ({ baseCurrencyCode: "USD" }),
      openInvoiceBalances: async () => {
        calls.invoices += 1;
        return [];
      },
      recentInvoices: async () => {
        calls.invoices += 1;
        return [];
      },
      leadStatusCounts: async () => {
        calls.leads += 1;
        return [];
      },
      recentLeads: async () => {
        calls.leads += 1;
        return [];
      },
      monthlyPayments: async () => [],
      quoteStatusTotals: async () => [],
      salesOrderStatusTotals: async () => [],
      openOpportunityValues: async () => [],
      wonOpportunityTotals: async () => ({
        _count: { _all: 0 },
        _sum: { estimatedValueBase: null },
      }),
      recentPayments: async () => [],
    } as unknown as DashboardRepository;

    const summary = await new DashboardService(repository).get("org-1", []);

    assert.equal(summary.sales, null);
    assert.equal(summary.crm, null);
    assert.equal(calls.invoices, 0);
    assert.equal(calls.leads, 0);
    assert.deepEqual(summary.recent, { invoices: [], payments: [], leads: [] });
  });
});

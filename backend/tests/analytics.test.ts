import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import type { AnalyticsRepository } from "../src/modules/analytics/repository";
import { AnalyticsService } from "../src/modules/analytics/service";
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
} from "../src/modules/analytics/summary";

const d = (value: string) => new Prisma.Decimal(value);

describe("analytics metrics", () => {
  it("sums outstanding and overdue receivables in base currency", () => {
    const metrics = buildOutstanding([
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

  it("buckets receivables by overdue age", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");
    const buckets = buildAging(
      [
        {
          status: "SENT",
          dueDate: new Date("2026-06-20T00:00:00.000Z"),
          totalBase: d("100"),
          amountPaid: d("0"),
          exchangeRateToBase: d("1"),
        },
        {
          status: "OVERDUE",
          dueDate: new Date("2026-06-01T00:00:00.000Z"),
          totalBase: d("200"),
          amountPaid: d("0"),
          exchangeRateToBase: d("1"),
        },
        {
          status: "OVERDUE",
          dueDate: new Date("2026-05-01T00:00:00.000Z"),
          totalBase: d("300"),
          amountPaid: d("0"),
          exchangeRateToBase: d("1"),
        },
      ],
      now,
    );

    assert.deepEqual(buckets, [
      { bucket: "Current", count: 1, valueBase: "100.0000" },
      { bucket: "1-30", count: 1, valueBase: "200.0000" },
      { bucket: "31-60", count: 1, valueBase: "300.0000" },
      { bucket: "61-90", count: 0, valueBase: "0.0000" },
      { bucket: "90+", count: 0, valueBase: "0.0000" },
    ]);
  });

  it("builds a monthly revenue trend in base currency", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");
    const trend = buildTrend(
      [{ issueDate: new Date("2026-05-10T00:00:00.000Z"), totalBase: d("100") }],
      [
        {
          receivedDate: new Date("2026-06-02T00:00:00.000Z"),
          amount: d("50"),
          exchangeRateToBase: d("2"),
        },
      ],
      3,
      now,
    );

    assert.deepEqual(trend, [
      { period: "2026-04", invoicedBase: "0.0000", collectedBase: "0.0000" },
      { period: "2026-05", invoicedBase: "100.0000", collectedBase: "0.0000" },
      { period: "2026-06", invoicedBase: "0.0000", collectedBase: "100.0000" },
    ]);
  });

  it("computes a weighted pipeline with a stage breakdown", () => {
    const pipeline = buildPipeline([
      { stage: "NEW", estimatedValueBase: d("1000"), probabilityPercent: 10 },
      { stage: "PROPOSAL", estimatedValueBase: d("500"), probabilityPercent: 60 },
    ]);

    assert.equal(pipeline.openCount, 2);
    assert.equal(pipeline.pipelineValueBase, "1500.0000");
    assert.equal(pipeline.weightedPipelineBase, "400.0000");
    assert.deepEqual(pipeline.byStage, [
      { stage: "NEW", count: 1, valueBase: "1000.0000" },
      { stage: "PROPOSAL", count: 1, valueBase: "500.0000" },
    ]);
  });

  it("computes the win rate from won and lost opportunities", () => {
    const winRate = buildWinRate(
      { _count: { _all: 3 }, _sum: { estimatedValueBase: d("900") } },
      { _count: { _all: 1 } },
    );

    assert.deepEqual(winRate, {
      wonCount: 3,
      lostCount: 1,
      wonValueBase: "900.0000",
      winRatePercent: 75,
    });
  });

  it("derives lead conversion metrics", () => {
    const metrics = buildLeadMetrics([
      { status: "NEW", _count: { _all: 3 } },
      { status: "QUALIFIED", _count: { _all: 1 } },
      { status: "CONVERTED", _count: { _all: 1 } },
      { status: "WON", _count: { _all: 1 } },
    ]);

    assert.deepEqual(metrics, {
      total: 6,
      open: 4,
      newCount: 3,
      qualifiedCount: 1,
      convertedCount: 2,
      conversionRatePercent: 33.3,
    });
  });

  it("groups lead sources and folds missing sources into OTHER", () => {
    const rows = buildSourceRows([
      { source: "WEBSITE", status: "NEW", _count: { _all: 2 } },
      { source: "WEBSITE", status: "CONVERTED", _count: { _all: 1 } },
      { source: null, status: "NEW", _count: { _all: 1 } },
    ]);

    assert.deepEqual(rows, [
      { source: "WEBSITE", total: 3, qualified: 0, converted: 1 },
      { source: "OTHER", total: 1, qualified: 0, converted: 0 },
    ]);
  });

  it("ranks top customers by invoiced value", () => {
    const rows = buildTopCustomers([
      { customerId: "c1", totalBase: d("100"), customer: { displayName: "Acme" } },
      { customerId: "c1", totalBase: d("50"), customer: { displayName: "Acme" } },
      { customerId: "c2", totalBase: d("500"), customer: { displayName: "Globex" } },
    ]);

    assert.deepEqual(rows, [
      { id: "c2", name: "Globex", invoicedBase: "500.0000", invoiceCount: 1 },
      { id: "c1", name: "Acme", invoicedBase: "150.0000", invoiceCount: 2 },
    ]);
  });

  it("sorts status counts by volume and builds a funnel", () => {
    assert.deepEqual(
      buildStatusCounts([
        { status: "PAID", _count: { _all: 2 } },
        { status: "SENT", _count: { _all: 5 } },
      ]),
      [
        { status: "SENT", count: 5 },
        { status: "PAID", count: 2 },
      ],
    );

    assert.deepEqual(
      buildFunnel(
        { total: 10, qualifiedCount: 4, convertedCount: 2 },
        { openCount: 6 },
        { wonCount: 3 },
      ),
      [
        { key: "leads", label: "Leads captured", count: 10 },
        { key: "qualified", label: "Qualified", count: 4 },
        { key: "opportunities", label: "Open pipeline", count: 6 },
        { key: "won", label: "Won", count: 3 },
      ],
    );
  });

  it("computes percentage deltas and handles a zero baseline", () => {
    assert.equal(deltaPercent(d("150"), d("100")), 50);
    assert.equal(deltaPercent(d("50"), d("100")), -50);
    assert.equal(deltaPercent(d("0"), d("0")), 0);
    assert.equal(deltaPercent(d("10"), d("0")), null);
  });
});

describe("analytics permissions", () => {
  it("hides every section and runs no module query without permissions", async () => {
    const calls = { invoices: 0, payments: 0, leads: 0, opportunities: 0 };
    const repository = {
      findOrganization: async () => ({ baseCurrencyCode: "USD" }),
      invoicesIssued: async () => {
        calls.invoices += 1;
        return [];
      },
      openInvoices: async () => {
        calls.invoices += 1;
        return [];
      },
      invoiceStatusCounts: async () => {
        calls.invoices += 1;
        return [];
      },
      paymentsReceived: async () => {
        calls.payments += 1;
        return [];
      },
      leadStatusCounts: async () => {
        calls.leads += 1;
        return [];
      },
      leadSourceCounts: async () => {
        calls.leads += 1;
        return [];
      },
      openOpportunities: async () => {
        calls.opportunities += 1;
        return [];
      },
      wonOpportunities: async () => {
        calls.opportunities += 1;
        return { _count: { _all: 0 }, _sum: { estimatedValueBase: null } };
      },
      lostOpportunities: async () => {
        calls.opportunities += 1;
        return { _count: { _all: 0 } };
      },
      customerCounts: async () => [0, 0],
      quoteStatusCounts: async () => [],
      salesOrderStatusCounts: async () => [],
    } as unknown as AnalyticsRepository;

    const report = await new AnalyticsService(repository).get("org-1", [], "90d");

    assert.deepEqual(report.kpis, {
      revenue: null,
      invoiced: null,
      outstanding: null,
      pipeline: null,
      winRate: null,
      leads: null,
      customers: null,
      quotes: null,
    });
    assert.deepEqual(report.leadsBySource, []);
    assert.deepEqual(report.topCustomers, []);
    assert.equal(calls.invoices, 0);
    assert.equal(calls.payments, 0);
    assert.equal(calls.leads, 0);
    assert.equal(calls.opportunities, 0);
  });
});

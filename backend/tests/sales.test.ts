import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, computeDocumentMoney, computeLineMoney } from "../src/common/sales/totals";
import { assertQuoteTransition } from "../src/modules/quotes/types";
import { assertSalesOrderTransition } from "../src/modules/sales-orders/types";
import { assertInvoiceTransition } from "../src/modules/invoices/types";
import { applyPaymentDelta } from "../src/modules/payments/status";

describe("sales totals", () => {
  it("computes line discount and tax at four decimal places", () => {
    const line = computeLineMoney({
      quantity: "2",
      unitPrice: "100",
      discountPercent: "10",
      taxRate: "5",
    });

    assert.deepEqual(line, {
      lineSubtotal: "200.0000",
      lineDiscount: "20.0000",
      lineTax: "9.0000",
      lineTotal: "189.0000",
    });
  });

  it("rolls lines up into document totals", () => {
    const first = computeLineMoney({ quantity: "2", unitPrice: "100", discountPercent: "10", taxRate: "5" });
    const second = computeLineMoney({ quantity: "1", unitPrice: "50", taxRate: "10" });

    assert.deepEqual(computeDocumentMoney([first, second]), {
      subtotal: "250.0000",
      discountTotal: "20.0000",
      taxTotal: "14.0000",
      total: "244.0000",
    });
  });

  it("adds calendar days across month end", () => {
    assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  });
});

describe("sales document status guards", () => {
  it("allows a draft quote to be sent and rejects a terminal change", () => {
    assert.doesNotThrow(() => assertQuoteTransition("DRAFT", "SENT"));
    assert.throws(() => assertQuoteTransition("ACCEPTED", "DRAFT"));
  });

  it("requires orders to be confirmed before fulfilment", () => {
    assert.doesNotThrow(() => assertSalesOrderTransition("CONFIRMED", "FULFILLED"));
    assert.throws(() => assertSalesOrderTransition("DRAFT", "FULFILLED"));
  });

  it("keeps paid invoices terminal", () => {
    assert.doesNotThrow(() => assertInvoiceTransition("SENT", "PARTIALLY_PAID"));
    assert.throws(() => assertInvoiceTransition("PAID", "VOID"));
  });
});

describe("payment allocation", () => {
  const asOf = new Date("2026-02-01T00:00:00.000Z");

  it("marks an invoice partially paid when a receipt is below the total", () => {
    const result = applyPaymentDelta({
      currentStatus: "SENT",
      total: "1000.0000",
      amountPaid: "0.0000",
      delta: "250.0000",
      dueDate: new Date("2026-03-01T00:00:00.000Z"),
      asOf,
    });

    assert.deepEqual(result, { amountPaid: "250.0000", status: "PARTIALLY_PAID" });
  });

  it("marks an invoice paid when receipts cover the total", () => {
    const result = applyPaymentDelta({
      currentStatus: "PARTIALLY_PAID",
      total: "1000.0000",
      amountPaid: "750.0000",
      delta: "250.0000",
      dueDate: new Date("2026-03-01T00:00:00.000Z"),
      asOf,
    });

    assert.deepEqual(result, { amountPaid: "1000.0000", status: "PAID" });
  });

  it("marks a partial payment overdue when the due date has passed", () => {
    const result = applyPaymentDelta({
      currentStatus: "SENT",
      total: "1000.0000",
      amountPaid: "0.0000",
      delta: "250.0000",
      dueDate: new Date("2026-01-15T00:00:00.000Z"),
      asOf,
    });

    assert.deepEqual(result, { amountPaid: "250.0000", status: "OVERDUE" });
  });

  it("restores the invoice when the covering payment is removed", () => {
    const result = applyPaymentDelta({
      currentStatus: "PAID",
      total: "1000.0000",
      amountPaid: "1000.0000",
      delta: "-1000.0000",
      dueDate: new Date("2026-01-15T00:00:00.000Z"),
      asOf,
    });

    assert.deepEqual(result, { amountPaid: "0.0000", status: "OVERDUE" });
  });
});

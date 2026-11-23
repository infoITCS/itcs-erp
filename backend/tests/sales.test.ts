import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ValidationFailedError } from "../src/common/errors/app-error";
import { addDays, computeDocumentMoney, computeLineMoney } from "../src/common/sales/totals";
import { QuotesService } from "../src/modules/quotes/service";
import { assertQuoteTransition } from "../src/modules/quotes/types";
import { SalesOrdersService } from "../src/modules/sales-orders/service";
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

  it("extracts VAT from tax-inclusive prices instead of adding it again", () => {
    const line = computeLineMoney({
      quantity: "1",
      unitPrice: "100",
      discountPercent: "10",
      taxRate: "17",
      pricesIncludeTax: true,
    });

    assert.deepEqual(line, {
      lineSubtotal: "85.4701",
      lineDiscount: "8.5470",
      lineTax: "13.0769",
      lineTotal: "90.0000",
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

describe("credit hold enforcement", () => {
  const meta = { ipAddress: null, userAgent: null };
  const heldCustomer = {
    id: "11111111-1111-4111-8111-111111111111",
    customerNumber: "CUS-00001",
    displayName: "Held Customer",
    status: "ACTIVE",
    currencyCode: "PKR",
    paymentTermId: null,
    creditHold: true,
  };

  function rejectsCreditHold(error: unknown): boolean {
    return (
      error instanceof ValidationFailedError &&
      Boolean(error.errors?.customerId?.[0]?.includes("credit hold"))
    );
  }

  it("blocks sales order creation for a held customer", async () => {
    let created = false;
    const service = new SalesOrdersService(
      {
        async findCustomer() {
          return heldCustomer;
        },
        async create() {
          created = true;
          return {};
        },
      } as never,
      {} as never,
    );

    await assert.rejects(
      () => service.create("org-1", "actor-1", { customerId: heldCustomer.id, lines: [] } as never, meta),
      rejectsCreditHold,
    );
    assert.equal(created, false);
  });

  it("blocks editing an existing sales order for a held customer", async () => {
    let updated = false;
    const service = new SalesOrdersService(
      {
        async findById() {
          return { id: "order-1", customerId: heldCustomer.id, status: "DRAFT" };
        },
        async findCustomer() {
          return heldCustomer;
        },
        async update() {
          updated = true;
          return {};
        },
      } as never,
      {} as never,
    );

    await assert.rejects(
      () => service.update("org-1", "actor-1", "order-1", { customerId: heldCustomer.id } as never, meta),
      rejectsCreditHold,
    );
    assert.equal(updated, false);
  });

  it("blocks converting a quote to an order for a held customer", async () => {
    let converted = false;
    const service = new QuotesService(
      {
        async findById() {
          return {
            id: "quote-1",
            quoteNumber: "QT-00001",
            customerId: heldCustomer.id,
            status: "DRAFT",
          };
        },
        async findCustomer() {
          return heldCustomer;
        },
        async convertToOrder() {
          converted = true;
          return {};
        },
      } as never,
      {} as never,
    );

    await assert.rejects(
      () => service.convertToOrder("org-1", "actor-1", "quote-1", undefined, meta),
      rejectsCreditHold,
    );
    assert.equal(converted, false);
  });
});

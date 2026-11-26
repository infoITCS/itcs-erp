import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ForbiddenError, ValidationFailedError } from "../src/common/errors/app-error";
import { InventoryService } from "../src/modules/inventory/service";
import { applyInventoryMovement } from "../src/modules/inventory/valuation";
import { applyVendorBillPaymentDelta } from "../src/modules/purchasing/money";
import { PurchasingService } from "../src/modules/purchasing/service";
import { assertPurchaseOrderTransition } from "../src/modules/purchasing/types";

const meta = { ipAddress: null, userAgent: null };
const audit = { async record() {} };

describe("purchase order workflow", () => {
  it("enforces the documented status transitions", () => {
    assert.doesNotThrow(() => assertPurchaseOrderTransition("DRAFT", "APPROVED"));
    assert.doesNotThrow(() => assertPurchaseOrderTransition("BILLED", "CLOSED"));
    assert.throws(() => assertPurchaseOrderTransition("DRAFT", "RECEIVED"));
    assert.throws(() => assertPurchaseOrderTransition("CANCELLED", "APPROVED"));
  });

  it("computes line totals and currency snapshot on creation", async () => {
    let payload: Record<string, unknown> | null = null;
    const service = new PurchasingService(
      {
        async findVendor() {
          return { id: "v1", status: "ACTIVE", currencyCode: "USD" };
        },
        async currencyIsActive() {
          return true;
        },
        async findActiveOrgUser() {
          return { id: "actor-1" };
        },
        async findProductsByIds() {
          return [
            {
              id: "p1",
              code: "WIDGET",
              name: "Widget",
              unitOfMeasure: { code: "EA" },
              taxCodeId: null,
              taxCode: null,
            },
          ];
        },
        async findTaxCodesByIds() {
          return [];
        },
        async findOrganization() {
          return { baseCurrencyCode: "USD" };
        },
        async findExchangeRateValue() {
          return null;
        },
        async createOrder(_organizationId: string, _actorId: string, data: Record<string, unknown>) {
          payload = data;
          return { id: "po-1", purchaseOrderNumber: "PO-2026-00001", status: "DRAFT", total: "189.0000" };
        },
      } as never,
      audit as never,
    );

    const order = await service.createOrder(
      "org-1",
      "actor-1",
      {
        vendorId: "v1",
        currencyCode: "USD",
        lines: [{ productId: "p1", quantity: "2", unitPrice: "100", discountPercent: "10", taxRate: "5" }],
      } as never,
      meta,
    );

    assert.equal(order.id, "po-1");
    assert.equal(payload?.subtotal, "200.0000");
    assert.equal(payload?.discountTotal, "20.0000");
    assert.equal(payload?.taxTotal, "9.0000");
    assert.equal(payload?.total, "189.0000");
    assert.equal(payload?.totalBase, "189.0000");
    assert.equal((payload?.lines as Array<{ lineTotal: string }>)[0].lineTotal, "189.0000");
  });

  it("requires approval permission for approval and sent transitions", async () => {
    let changed = false;
    const service = new PurchasingService(
      {
        async findOrder() {
          return { id: "po-1", purchaseOrderNumber: "PO-1", status: "DRAFT" };
        },
        async changeOrderStatus() {
          changed = true;
          return true;
        },
      } as never,
      audit as never,
    );

    await assert.rejects(
      () =>
        service.changeOrderStatus(
          "org-1",
          "actor-1",
          "po-1",
          { status: "APPROVED" } as never,
          meta,
          ["purchasing:update"],
        ),
      ForbiddenError,
    );
    assert.equal(changed, false);

    await service.changeOrderStatus(
      "org-1",
      "actor-1",
      "po-1",
      { status: "APPROVED" } as never,
      meta,
      ["purchasing:update", "purchasing:approve"],
    );
    assert.equal(changed, true);
  });
});

describe("goods receipts", () => {
  const order = {
    id: "po-1",
    purchaseOrderNumber: "PO-1",
    vendorId: "v1",
    currencyCode: "USD",
    status: "SENT",
    lines: [
      {
        id: "pol-1",
        productId: "p1",
        productCode: "WIDGET",
        productName: "Widget",
        quantity: "10",
        receivedQuantity: "8",
        unitPrice: "10",
        discountPercent: "0",
        taxCodeId: null,
        taxCode: null,
        taxRate: "0",
      },
    ],
  };

  it("rejects a receipt that exceeds the remaining quantity", async () => {
    const service = new PurchasingService(
      {
        async findOrder() {
          return order;
        },
        async findProductsByIds() {
          return [{ id: "p1", receivingLocation: "MAIN LOCATION" }];
        },
        async sumPendingReceiptQuantities() {
          return new Map([["pol-1", "1"]]);
        },
      } as never,
      audit as never,
    );

    await assert.rejects(
      () =>
        service.createReceipt(
          "org-1",
          "actor-1",
          {
            purchaseOrderId: "po-1",
            lines: [{ purchaseOrderLineId: "pol-1", receivedQuantity: "2" }],
          } as never,
          meta,
        ),
      ValidationFailedError,
    );
  });

  it("posts a receipt with weighted-average movements and updates the order", async () => {
    let payload: Record<string, unknown> | null = null;
    const service = new PurchasingService(
      {
        async findReceipt() {
          return {
            id: "gr-1",
            receiptNumber: "GR-2026-00001",
            purchaseOrderId: "po-1",
            status: "DRAFT",
            lines: [
              {
                id: "grl-1",
                purchaseOrderLineId: "pol-1",
                productId: "p1",
                receivedQuantity: "3",
                unitCost: "10",
                location: "MAIN LOCATION",
              },
            ],
          };
        },
        async findOrder() {
          return { ...order, lines: [{ ...order.lines[0], receivedQuantity: "5" }] };
        },
        async sumPendingReceiptQuantities() {
          return new Map();
        },
        async findBalance() {
          return null;
        },
        async postReceipt(
          _organizationId: string,
          _actorId: string,
          _id: string,
          data: Record<string, unknown>,
        ) {
          payload = data;
          return { id: "gr-1", status: "POSTED" };
        },
      } as never,
      audit as never,
    );

    const posted = await service.postReceipt("org-1", "actor-1", "gr-1", meta);
    assert.equal(posted.status, "POSTED");
    assert.equal(payload?.status, "PARTIALLY_RECEIVED");
    assert.equal(payload?.amountReceived, "80.0000");
    assert.deepEqual(payload?.lineUpdates, [{ id: "pol-1", receivedQuantity: "8.0000" }]);
    assert.equal((payload?.movements as Array<{ balanceAfter: string }>)[0].balanceAfter, "3.0000");
    assert.equal((payload?.movements as Array<{ referenceType: string }>)[0].referenceType, "GOODS_RECEIPT");
    assert.equal((payload?.balances as Array<{ averageCost: string }>)[0].averageCost, "10.0000");
  });
});

describe("vendor bills and payments", () => {
  it("updates purchase order billed quantities when a bill is approved", async () => {
    let payload: Record<string, unknown> | null = null;
    const service = new PurchasingService(
      {
        async findBill() {
          return {
            id: "bill-1",
            billNumber: "BILL-2026-00001",
            status: "DRAFT",
            purchaseOrderId: "po-1",
            total: "20.0000",
            lines: [{ id: "bl-1", productId: "p1", quantity: "2" }],
          };
        },
        async findOrder() {
          return {
            id: "po-1",
            amountBilled: "0",
            lines: [{ id: "pol-1", productId: "p1", quantity: "5", billedQuantity: "0" }],
          };
        },
        async approveBill(
          _organizationId: string,
          _actorId: string,
          _id: string,
          data: Record<string, unknown>,
        ) {
          payload = data;
          return { id: "bill-1", status: "APPROVED" };
        },
      } as never,
      audit as never,
    );

    const approved = await service.approveBill("org-1", "actor-1", "bill-1", meta);
    assert.equal(approved.status, "APPROVED");
    assert.equal(payload?.amountBilled, "20.0000");
    assert.deepEqual(payload?.lineUpdates, [{ id: "pol-1", billedQuantity: "2.0000" }]);
  });

  it("rejects bill quantities beyond the purchase order balance", async () => {
    const service = new PurchasingService(
      {
        async findBill() {
          return {
            id: "bill-1",
            status: "DRAFT",
            purchaseOrderId: "po-1",
            total: "100.0000",
            lines: [{ id: "bl-1", productId: "p1", quantity: "7" }],
          };
        },
        async findOrder() {
          return {
            id: "po-1",
            amountBilled: "0",
            lines: [{ id: "pol-1", productId: "p1", quantity: "5", billedQuantity: "0" }],
          };
        },
      } as never,
      audit as never,
    );

    await assert.rejects(() => service.approveBill("org-1", "actor-1", "bill-1", meta), ValidationFailedError);
  });

  it("tracks bill balances as payments are allocated", () => {
    assert.deepEqual(
      applyVendorBillPaymentDelta(
        { status: "APPROVED", total: "1000.0000", amountPaid: "0.0000" },
        "250.0000",
      ),
      { amountPaid: "250.0000", status: "PARTIALLY_PAID" },
    );
    assert.deepEqual(
      applyVendorBillPaymentDelta(
        { status: "PARTIALLY_PAID", total: "1000.0000", amountPaid: "750.0000" },
        "250.0000",
      ),
      { amountPaid: "1000.0000", status: "PAID" },
    );
    assert.throws(() =>
      applyVendorBillPaymentDelta(
        { status: "APPROVED", total: "100.0000", amountPaid: "0.0000" },
        "101.0000",
      ),
    );
  });

  it("prevents allocations beyond outstanding bill balances", async () => {
    const service = new PurchasingService(
      {
        async findVendor() {
          return { id: "v1", status: "ACTIVE", currencyCode: "USD" };
        },
        async currencyIsActive() {
          return true;
        },
        async findBillsForAllocation() {
          return [{ id: "bill-1", vendorId: "v1", status: "APPROVED", total: "100", amountPaid: "60" }];
        },
        async sumPendingAllocations() {
          return new Map([["bill-1", "10"]]);
        },
      } as never,
      audit as never,
    );

    await assert.rejects(
      () =>
        service.createPayment(
          "org-1",
          "actor-1",
          {
            vendorId: "v1",
            method: "BANK_TRANSFER",
            amount: "31",
            currencyCode: "USD",
            allocations: [{ billId: "bill-1", amount: "31" }],
          } as never,
          meta,
        ),
      ValidationFailedError,
    );
  });

  it("approves a payment and applies the outstanding bill delta", async () => {
    const updates: Array<{ billId: string; status: string }> = [];
    const service = new PurchasingService(
      {
        async findPayment() {
          return {
            id: "pay-1",
            paymentNumber: "PAY-2026-00001",
            status: "DRAFT",
            vendorId: "v1",
            amount: "250.0000",
            allocations: [{ billId: "bill-1", amount: "250.0000" }],
          };
        },
        async findBillsForAllocation() {
          return [{ id: "bill-1", vendorId: "v1", status: "APPROVED", total: "1000", amountPaid: "0" }];
        },
        async approvePayment(
          _organizationId: string,
          _actorId: string,
          _id: string,
          billUpdates: Array<{ billId: string; status: string }>,
        ) {
          updates.push(...billUpdates);
          return { id: "pay-1", status: "PAID" };
        },
      } as never,
      audit as never,
    );

    const payment = await service.approvePayment("org-1", "actor-1", "pay-1", meta);
    assert.equal(payment.status, "PAID");
    assert.deepEqual(updates, [{ billId: "bill-1", amountPaid: "250.0000", status: "PARTIALLY_PAID" }]);
  });
});

describe("inventory adjustments", () => {
  it("recalculates weighted-average cost for receipts and adjustments", () => {
    assert.deepEqual(applyInventoryMovement({ quantity: "5", averageCost: "8" }, "2", "12"), {
      quantity: "7.0000",
      averageCost: "9.1429",
      balanceAfter: "7.0000",
    });
    assert.deepEqual(applyInventoryMovement(null, "3", "10"), {
      quantity: "3.0000",
      averageCost: "10.0000",
      balanceAfter: "3.0000",
    });
  });

  it("records an adjustment with the computed balance", async () => {
    let payload: Record<string, unknown> | null = null;
    const service = new InventoryService(
      {
        async findProduct() {
          return {
            id: "p1",
            code: "WIDGET",
            name: "Widget",
            allowNegativeStock: false,
            weightedAveragePrice: "10",
            minimumStockQuantity: "0",
            receivingLocation: "MAIN LOCATION",
          };
        },
        async findBalance() {
          return { quantity: "5", averageCost: "8" };
        },
        async createAdjustment(_organizationId: string, _actorId: string, data: Record<string, unknown>) {
          payload = data;
          return { id: "adj-1", balanceAfter: "7.0000" };
        },
      } as never,
      audit as never,
    );

    const result = await service.adjust(
      "org-1",
      "actor-1",
      { productId: "p1", quantity: "2", unitCost: "12", reason: "Cycle count correction" } as never,
      meta,
    );
    assert.equal(result.balanceAfter, "7.0000");
    assert.equal((payload?.movement as { averageCost: string }).averageCost, "9.1429");
    assert.equal(payload?.location, "MAIN LOCATION");
  });

  it("blocks negative stock when the product disallows it", async () => {
    const service = new InventoryService(
      {
        async findProduct() {
          return {
            id: "p1",
            code: "WIDGET",
            name: "Widget",
            allowNegativeStock: false,
            weightedAveragePrice: "10",
            minimumStockQuantity: "0",
            receivingLocation: "MAIN LOCATION",
          };
        },
        async findBalance() {
          return { quantity: "1", averageCost: "10" };
        },
      } as never,
      audit as never,
    );

    await assert.rejects(
      () =>
        service.adjust(
          "org-1",
          "actor-1",
          { productId: "p1", quantity: "-2", unitCost: "10", reason: "Stock correction" } as never,
          meta,
        ),
      ValidationFailedError,
    );
  });
});

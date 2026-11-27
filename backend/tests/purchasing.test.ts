import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ForbiddenError, ValidationFailedError } from "../src/common/errors/app-error";
import { encodeCursor } from "../src/common/pagination/cursor";
import { InventoryRepository } from "../src/modules/inventory/repository";
import { InventoryService } from "../src/modules/inventory/service";
import { DEFAULT_LOCATION, INVENTORY_ADJUSTMENT_REASONS } from "../src/modules/inventory/types";
import { movementQuerySchema, stockQuerySchema } from "../src/modules/inventory/validation";
import { applyInventoryMovement } from "../src/modules/inventory/valuation";
import { applyVendorBillPaymentDelta } from "../src/modules/purchasing/money";
import { PurchasingRepository } from "../src/modules/purchasing/repository";
import { PurchasingService } from "../src/modules/purchasing/service";
import { assertPurchaseOrderTransition } from "../src/modules/purchasing/types";
import { createReceiptSchema, receiptListQuerySchema } from "../src/modules/purchasing/validation";
import { toVendorPage } from "../src/modules/vendors/page";
import { VendorsRepository } from "../src/modules/vendors/repository";
import { vendorListQuerySchema } from "../src/modules/vendors/validation";

const meta = { ipAddress: null, userAgent: null };
const audit = { async record() {} };

function fakeSequenceTx(delegates: Record<string, unknown>) {
  return {
    $queryRaw: async () => [{ id: "seq-1" }],
    documentSequence: { update: async () => ({ prefix: "DOC", padding: 5, nextNumber: 2 }) },
    ...delegates,
  };
}

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
    assert.deepEqual(payload?.receiptLines, [
      {
        purchaseOrderLineId: "pol-1",
        productId: "p1",
        receivedQuantity: "3",
        unitCost: "10",
        location: "MAIN LOCATION",
      },
    ]);
  });

  it("includes previously received order lines in the amount received", async () => {
    let payload: Record<string, unknown> | null = null;
    const service = new PurchasingService(
      {
        async findReceipt() {
          return {
            id: "gr-2",
            receiptNumber: "GR-2",
            purchaseOrderId: "po-1",
            status: "DRAFT",
            lines: [
              {
                id: "grl-2",
                purchaseOrderLineId: "pol-1",
                productId: "p1",
                receivedQuantity: "2",
                unitCost: "10",
                location: "MAIN LOCATION",
              },
            ],
          };
        },
        async findOrder() {
          return {
            ...order,
            lines: [
              { ...order.lines[0], receivedQuantity: "4" },
              {
                id: "pol-2",
                productId: "p2",
                quantity: "5",
                receivedQuantity: "0",
                unitPrice: "20",
                discountPercent: "0",
                taxCodeId: null,
                taxCode: null,
                taxRate: "0",
              },
            ],
          };
        },
        async sumPendingReceiptQuantities() {
          return new Map();
        },
        async postReceipt(
          _organizationId: string,
          _actorId: string,
          _id: string,
          data: Record<string, unknown>,
        ) {
          payload = data;
          return { id: "gr-2", status: "POSTED" };
        },
      } as never,
      audit as never,
    );

    await service.postReceipt("org-1", "actor-1", "gr-2", meta);

    assert.equal(payload?.amountReceived, "60.0000");
    assert.deepEqual(payload?.lineUpdates, [{ id: "pol-1", receivedQuantity: "6.0000" }]);
  });

  it("writes cumulative order-line receipt quantities without incrementing", async () => {
    const lineUpdates: Array<Record<string, unknown>> = [];
    const movements: Array<Record<string, unknown>> = [];
    const balances: Array<Record<string, unknown>> = [];
    const tx = {
      goodsReceipt: {
        findFirst: async () => ({ id: "gr-1", purchaseOrderId: "po-1" }),
        update: async () => ({}),
      },
      purchaseOrderLine: {
        update: async ({ data }: { data: Record<string, unknown> }) => {
          lineUpdates.push(data);
        },
      },
      purchaseOrder: { update: async () => ({}) },
      inventoryMovement: {
        createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
          movements.push(...data);
          return { count: data.length };
        },
      },
      inventoryBalance: {
        findFirst: async () => null,
        upsert: async ({ create }: { create: Record<string, unknown> }) => {
          balances.push(create);
        },
      },
    };
    const repository = new PurchasingRepository({
      $transaction: async (fn: (client: unknown) => Promise<unknown>) => fn(tx),
      goodsReceipt: { findFirst: async () => ({ id: "gr-1", lines: [] }) },
    } as never);

    await repository.postReceipt("org-1", "actor-1", "gr-1", {
      status: "PARTIALLY_RECEIVED",
      amountReceived: "30.0000",
      lineUpdates: [{ id: "pol-1", receivedQuantity: "8.0000" }],
      receiptLines: [{ productId: "p1", receivedQuantity: "3", unitCost: "10", location: "MAIN LOCATION" }],
    });

    assert.deepEqual(lineUpdates, [{ receivedQuantity: "8.0000" }]);
    assert.equal(movements[0]?.balanceAfter, "3.0000");
    assert.equal(movements[0]?.referenceType, "GOODS_RECEIPT");
    assert.equal(balances[0]?.averageCost, "10.0000");
  });

  it("validates and applies the goods receipt status filter", async () => {
    assert.equal(receiptListQuerySchema.safeParse({ status: "POSTED" }).success, true);
    assert.equal(receiptListQuerySchema.safeParse({ status: "VOID" }).success, false);

    let where: Record<string, unknown> | null = null;
    const repository = new PurchasingRepository({
      goodsReceipt: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          where = args.where;
          return [];
        },
      },
    } as never);

    await repository.listReceipts("org-1", { status: "POSTED", limit: 50, order: "desc" } as never);

    assert.ok(where);
    assert.equal((where as { status?: string }).status, "POSTED");
  });

  it("accepts cleared optional receipt fields sent as null", () => {
    const parsed = createReceiptSchema.parse({
      purchaseOrderId: "11111111-1111-4111-8111-111111111111",
      vendorReference: null,
      notes: null,
      lines: [
        {
          purchaseOrderLineId: "22222222-2222-4222-8222-222222222222",
          receivedQuantity: "2",
          location: null,
        },
      ],
    });

    assert.equal(parsed.vendorReference, undefined);
    assert.equal(parsed.notes, undefined);
    assert.equal(parsed.lines[0]?.location, undefined);
  });

  it("allows deleted receipts with either delete or restore permission", async () => {
    const service = new PurchasingService(
      { listReceipts: async () => ({ items: [], pageInfo: { limit: 50, hasNextPage: false, nextCursor: null } }) } as never,
      audit as never,
    );

    await assert.rejects(
      () => service.listReceipts("org-1", { includeDeleted: true } as never, ["purchasing:read"]),
      ForbiddenError,
    );
    await service.listReceipts("org-1", { includeDeleted: true } as never, ["purchasing:restore"]);
    await service.listReceipts("org-1", { includeDeleted: true } as never, ["purchasing:delete"]);
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
            currencyCode: "USD",
            total: "20.0000",
            lines: [{ id: "bl-1", productId: "p1", quantity: "2" }],
          };
        },
        async findOrder() {
          return {
            id: "po-1",
            status: "RECEIVED",
            currencyCode: "USD",
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
            status: "RECEIVED",
            currencyCode: "USD",
            amountBilled: "0",
            lines: [{ id: "pol-1", productId: "p1", quantity: "5", billedQuantity: "0" }],
          };
        },
      } as never,
      audit as never,
    );

    await assert.rejects(() => service.approveBill("org-1", "actor-1", "bill-1", meta), ValidationFailedError);
  });

  it("enforces purchase order transitions when approving a bill", async () => {
    for (const status of ["DRAFT", "CANCELLED", "CLOSED", "SENT", "PARTIALLY_RECEIVED"]) {
      const service = new PurchasingService(
        {
          async findBill() {
            return {
              id: "bill-1",
              billNumber: "BILL-1",
              status: "DRAFT",
              purchaseOrderId: "po-1",
              currencyCode: "USD",
              total: "20.0000",
              lines: [],
            };
          },
          async findOrder() {
            return { id: "po-1", status, currencyCode: "USD", amountBilled: "0", lines: [] };
          },
        } as never,
        audit as never,
      );

      await assert.rejects(() => service.approveBill("org-1", "actor-1", "bill-1", meta), ValidationFailedError);
    }
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

  it("forces a purchase-order bill to use the order currency", async () => {
    let payload: Record<string, unknown> | null = null;
    const service = new PurchasingService(
      {
        async findVendor() {
          return { id: "v1", status: "ACTIVE", currencyCode: "USD" };
        },
        async findOrder() {
          return {
            id: "po-1",
            purchaseOrderNumber: "PO-1",
            vendorId: "v1",
            status: "RECEIVED",
            currencyCode: "EUR",
            lines: [
              {
                id: "pol-1",
                productId: "p1",
                productCode: "WIDGET",
                productName: "Widget",
                quantity: "1",
                receivedQuantity: "1",
                unitPrice: "10",
                discountPercent: "0",
                taxCodeId: null,
                taxCode: null,
                taxRate: "0",
              },
            ],
          };
        },
        async currencyIsActive() {
          return true;
        },
        async findProductsByIds() {
          return [{ id: "p1", code: "WIDGET", name: "Widget", unitOfMeasure: { code: "EA" }, taxCodeId: null }];
        },
        async findTaxCodesByIds() {
          return [];
        },
        async findOrganization() {
          return { baseCurrencyCode: "USD" };
        },
        async findExchangeRateValue() {
          return "1";
        },
        async createBill(_organizationId: string, _actorId: string, data: Record<string, unknown>) {
          payload = data;
          return { id: "bill-1", billNumber: "BILL-1", status: "DRAFT", total: "10.0000" };
        },
      } as never,
      audit as never,
    );

    await service.createBill(
      "org-1",
      "actor-1",
      { vendorId: "v1", purchaseOrderId: "po-1", currencyCode: "USD" } as never,
      meta,
    );

    assert.equal(payload?.currencyCode, "EUR");
  });

  it("rejects payment allocations that use a different currency", async () => {
    const service = new PurchasingService(
      {
        async findVendor() {
          return { id: "v1", status: "ACTIVE", currencyCode: "USD" };
        },
        async currencyIsActive() {
          return true;
        },
        async findBillsForAllocation() {
          return [
            {
              id: "bill-1",
              vendorId: "v1",
              status: "APPROVED",
              total: "100",
              amountPaid: "0",
              currencyCode: "EUR",
            },
          ];
        },
        async sumPendingAllocations() {
          return new Map();
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
            amount: "10",
            currencyCode: "USD",
            allocations: [{ billId: "bill-1", amount: "10" }],
          } as never,
          meta,
        ),
      ValidationFailedError,
    );
  });

  it("rejects payment approval when the bill currency changed", async () => {
    const service = new PurchasingService(
      {
        async findPayment() {
          return {
            id: "pay-1",
            paymentNumber: "PAY-1",
            status: "DRAFT",
            vendorId: "v1",
            currencyCode: "USD",
            amount: "10",
            allocations: [{ billId: "bill-1", amount: "10" }],
          };
        },
        async findBillsForAllocation() {
          return [
            {
              id: "bill-1",
              vendorId: "v1",
              status: "APPROVED",
              total: "100",
              amountPaid: "0",
              currencyCode: "EUR",
            },
          ];
        },
      } as never,
      audit as never,
    );

    await assert.rejects(() => service.approvePayment("org-1", "actor-1", "pay-1", meta), ValidationFailedError);
  });

  it("cancels draft receipts and payments through the guarded transitions", async () => {
    let cancelledReceipt = false;
    let cancelledPayment = false;
    const service = new PurchasingService(
      {
        async findReceipt() {
          return { id: "gr-1", receiptNumber: "GR-1", status: "DRAFT", lines: [] };
        },
        async cancelReceipt() {
          cancelledReceipt = true;
          return true;
        },
        async findPayment() {
          return { id: "pay-1", paymentNumber: "PAY-1", status: "DRAFT", allocations: [] };
        },
        async cancelPayment() {
          cancelledPayment = true;
          return true;
        },
      } as never,
      audit as never,
    );

    await service.cancelReceipt("org-1", "actor-1", "gr-1", meta);
    await service.cancelPayment("org-1", "actor-1", "pay-1", meta);
    assert.equal(cancelledReceipt, true);
    assert.equal(cancelledPayment, true);
  });
});

describe("purchasing repository regressions", () => {
  it("exposes active vendor status and net available quantities and balances", async () => {
    const repository = new PurchasingRepository({
      vendor: {
        findMany: async () => [
          {
            id: "v1",
            status: "ACTIVE",
            vendorNumber: "V-1",
            code: "V-CODE",
            name: "Vendor One",
            displayName: "Vendor One",
            currencyCode: "USD",
            paymentTermId: null,
          },
        ],
      },
      product: {
        findMany: async () => [
          {
            id: "p1",
            code: "WIDGET",
            name: "Widget",
            taxCodeId: "t1",
            receivingLocation: "MAIN LOCATION",
            unitOfMeasure: { code: "EA" },
            taxCode: { id: "t1", code: "VAT", rate: "0.17" },
          },
        ],
      },
      currency: { findMany: async () => [] },
      paymentTerm: { findMany: async () => [] },
      taxCode: { findMany: async () => [] },
      user: { findMany: async () => [] },
      purchaseOrder: {
        findMany: async () => [
          {
            id: "po-1",
            purchaseOrderNumber: "PO-1",
            vendorId: "v1",
            status: "RECEIVED",
            currencyCode: "USD",
            total: "100",
            amountReceived: "40",
            amountBilled: "0",
          },
        ],
      },
      vendorBill: {
        findMany: async () => [
          {
            id: "bill-1",
            billNumber: "BILL-1",
            vendorId: "v1",
            status: "APPROVED",
            currencyCode: "USD",
            total: "100",
            amountPaid: "20",
            dueDate: null,
          },
        ],
      },
      purchaseOrderLine: {
        findMany: async () => [
          {
            id: "pol-1",
            purchaseOrderId: "po-1",
            productId: "p1",
            productCode: "WIDGET",
            productName: "Widget",
            description: null,
            unitOfMeasure: "EA",
            quantity: "10",
            receivedQuantity: "4",
            unitPrice: "10",
            sortOrder: 0,
          },
        ],
      },
      goodsReceiptLine: {
        findMany: async () => [{ purchaseOrderLineId: "pol-1", receivedQuantity: "2" }],
      },
      vendorPaymentAllocation: {
        findMany: async () => [{ billId: "bill-1", amount: "30" }],
      },
    } as never);

    const options = await repository.formOptions("org-1");

    assert.equal(options.vendors[0]?.status, "ACTIVE");
    assert.equal(options.vendors[0]?.code, "V-CODE");
    assert.equal(options.products[0]?.taxCode, "VAT");
    assert.equal(options.products[0]?.unitOfMeasure, "EA");
    assert.equal(options.orders[0]?.lines[0]?.pendingQuantity, "2.0000");
    assert.equal(options.orders[0]?.lines[0]?.availableQuantity, "4.0000");
    assert.equal(options.orderLines[0]?.pendingQuantity, "2.0000");
    assert.equal(options.orderLines[0]?.availableQuantity, "4.0000");
    assert.equal(options.bills[0]?.pendingAmount, "30.0000");
    assert.equal(options.bills[0]?.availableBalance, "50.0000");
  });

  it("re-reads newly created orders from the transaction client", async () => {
    const tx = fakeSequenceTx({
      purchaseOrder: {
        create: async () => ({ id: "po-1" }),
        findFirst: async () => ({
          id: "po-1",
          purchaseOrderNumber: "PO-1",
          status: "DRAFT",
          lines: [],
          receipts: [],
          bills: [],
        }),
      },
    });
    const repository = new PurchasingRepository({
      $transaction: async (fn: (client: unknown) => Promise<unknown>) => fn(tx),
      purchaseOrder: {
        findFirst: async () => {
          throw new Error("order was read outside the transaction");
        },
      },
    } as never);

    const order = await repository.createOrder("org-1", "actor-1", {
      vendorId: "v1",
      ownerUserId: "actor-1",
      orderDate: "2026-01-01",
      currencyCode: "USD",
      subtotal: "0",
      discountTotal: "0",
      taxTotal: "0",
      total: "0",
      lines: [],
    } as never);

    assert.equal(order?.id, "po-1");
  });

  it("re-reads newly created receipts from the transaction client", async () => {
    const tx = fakeSequenceTx({
      goodsReceipt: {
        create: async () => ({ id: "gr-1" }),
        findFirst: async () => ({ id: "gr-1", receiptNumber: "GR-1", status: "DRAFT", lines: [] }),
      },
    });
    const repository = new PurchasingRepository({
      $transaction: async (fn: (client: unknown) => Promise<unknown>) => fn(tx),
      goodsReceipt: {
        findFirst: async () => {
          throw new Error("receipt was read outside the transaction");
        },
      },
    } as never);

    const receipt = await repository.createReceipt("org-1", "actor-1", {
      purchaseOrderId: "po-1",
      vendorId: "v1",
      receiptDate: "2026-01-01",
      currencyCode: "USD",
      lines: [],
    } as never);

    assert.equal(receipt?.id, "gr-1");
  });

  it("re-reads newly created bills with valid line fields", async () => {
    let lineSelect: Record<string, unknown> | null = null;
    const tx = fakeSequenceTx({
      vendorBill: {
        create: async () => ({ id: "bill-1" }),
        findFirst: async (args: { select: { lines: { select: Record<string, unknown> } } }) => {
          lineSelect = args.select.lines.select;
          return {
            id: "bill-1",
            billNumber: "BILL-1",
            status: "DRAFT",
            purchaseOrderId: null,
            lines: [{ id: "bl-1" }],
            paymentAllocations: [],
          };
        },
      },
    });
    const repository = new PurchasingRepository({
      $transaction: async (fn: (client: unknown) => Promise<unknown>) => fn(tx),
      vendorBill: {
        findFirst: async () => {
          throw new Error("bill was read outside the transaction");
        },
      },
    } as never);

    const bill = await repository.createBill("org-1", "actor-1", {
      vendorId: "v1",
      ownerUserId: "actor-1",
      billDate: "2026-01-01",
      currencyCode: "USD",
      subtotal: "0",
      discountTotal: "0",
      taxTotal: "0",
      total: "0",
      lines: [],
    } as never);

    assert.equal(bill?.id, "bill-1");
    assert.equal(lineSelect?.receivedQuantity, undefined);
    assert.equal(lineSelect?.billedQuantity, undefined);
    assert.equal(lineSelect?.lineTotal, true);
  });

  it("persists the vendor when a payment is updated", async () => {
    let updateData: Record<string, unknown> | null = null;
    const tx = {
      vendorPayment: {
        findFirst: async () => ({ id: "pay-1" }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updateData = data;
          return {};
        },
      },
    };
    const repository = new PurchasingRepository({
      $transaction: async (fn: (client: unknown) => Promise<unknown>) => fn(tx),
      vendorPayment: {
        findFirst: async () => ({
          id: "pay-1",
          paymentNumber: "PAY-1",
          status: "DRAFT",
          vendorId: "v2",
          allocations: [],
        }),
      },
    } as never);

    const payment = await repository.updatePayment("org-1", "pay-1", "actor-1", {
      vendorId: "v2",
      amount: "10",
      currencyCode: "USD",
    });

    assert.equal(updateData?.vendorId, "v2");
    assert.equal(payment?.vendorId, "v2");
  });

  it("reverses billed quantities and order status when a bill is voided", async () => {
    async function voidWith(remainingBills: Array<Record<string, unknown>>) {
      const lineUpdates: Array<Record<string, unknown>> = [];
      const orderUpdates: Array<Record<string, unknown>> = [];
      let billUpdate: Record<string, unknown> | null = null;
      const tx = {
        vendorBill: {
          findFirst: async () => ({ id: "bill-1", purchaseOrderId: "po-1" }),
          update: async ({ data }: { data: Record<string, unknown> }) => {
            billUpdate = data;
          },
          findMany: async () => remainingBills,
        },
        purchaseOrder: {
          findFirst: async () => ({ id: "po-1" }),
          update: async ({ data }: { data: Record<string, unknown> }) => {
            orderUpdates.push(data);
          },
        },
        purchaseOrderLine: {
          findMany: async () => [{ id: "pol-1", productId: "p1", quantity: "10", billedQuantity: "5" }],
          update: async ({ data }: { data: Record<string, unknown> }) => {
            lineUpdates.push(data);
          },
        },
      };
      const repository = new PurchasingRepository({
        $transaction: async (fn: (client: unknown) => Promise<unknown>) => fn(tx),
      } as never);
      const result = await repository.voidBill("org-1", "bill-1", "actor-1");
      return { result, lineUpdates, orderUpdates, billUpdate };
    }

    const withRemaining = await voidWith([
      { id: "bill-2", total: "30", lines: [{ productId: "p1", quantity: "3" }] },
    ]);
    assert.equal(withRemaining.result, true);
    assert.equal(withRemaining.billUpdate?.status, "VOID");
    assert.deepEqual(withRemaining.lineUpdates, [{ billedQuantity: "3.0000" }]);
    assert.equal(withRemaining.orderUpdates[0]?.amountBilled, "30.0000");
    assert.equal(withRemaining.orderUpdates[0]?.status, "BILLED");

    const withoutRemaining = await voidWith([]);
    assert.deepEqual(withoutRemaining.lineUpdates, [{ billedQuantity: "0.0000" }]);
    assert.equal(withoutRemaining.orderUpdates[0]?.amountBilled, "0.0000");
    assert.equal(withoutRemaining.orderUpdates[0]?.status, "RECEIVED");
  });

  it("queries pending receipt quantities through the goodsReceipt relation", async () => {
    let where: Record<string, unknown> | null = null;
    const repository = new PurchasingRepository({
      goodsReceiptLine: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          where = args.where;
          return [];
        },
      },
    } as never);

    const result = await repository.sumPendingReceiptQuantities("org-1", ["pol-1"]);

    assert.equal(result.size, 0);
    assert.ok(where);
    const receiptFilter = (where as { goodsReceipt?: Record<string, unknown> }).goodsReceipt;
    assert.ok(receiptFilter);
    assert.equal(receiptFilter.status, "DRAFT");
  });

  it("maps bill payment allocations to linked payments", async () => {
    let select: Record<string, unknown> | null = null;
    const repository = new PurchasingRepository({
      vendorBill: {
        findFirst: async (args: { select: Record<string, unknown> }) => {
          select = args.select;
          return {
            id: "bill-1",
            purchaseOrderId: null,
            paymentAllocations: [
              {
                payment: {
                  id: "pay-1",
                  paymentNumber: "VPAY-1",
                  status: "PAID",
                  paidDate: null,
                  amount: "20",
                  currencyCode: "USD",
                },
              },
            ],
          };
        },
      },
    } as never);

    const bill = await repository.findBill("org-1", "bill-1");

    assert.ok(select);
    assert.ok((select as { paymentAllocations?: unknown }).paymentAllocations);
    assert.equal(bill?.payments?.[0]?.id, "pay-1");
  });
});

describe("inventory adjustments", () => {
  it("recalculates weighted-average cost for receipts and adjustments", () => {
    assert.deepEqual(applyInventoryMovement({ quantity: "5", averageCost: "8" }, "2", "12"), {
      quantity: "7.0000",
      delta: "2.0000",
      averageCost: "9.1429",
      balanceAfter: "7.0000",
    });
    assert.deepEqual(applyInventoryMovement(null, "3", "10"), {
      quantity: "3.0000",
      delta: "3.0000",
      averageCost: "10.0000",
      balanceAfter: "3.0000",
    });
    assert.equal(applyInventoryMovement({ quantity: "5", averageCost: "8" }, "-2", "8").delta, "-2.0000");
  });

  it("records an adjustment with the computed balance", async () => {
    let payload: Record<string, unknown> | null = null;
    const audits: Array<Record<string, unknown>> = [];
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
      {
        async record(entry: Record<string, unknown>) {
          audits.push(entry);
        },
      } as never,
    );

    const result = await service.adjust(
      "org-1",
      "actor-1",
      { productId: "p1", quantity: "2", unitCost: "12", reason: "Cycle count correction" } as never,
      meta,
    );
    const movement = payload?.movement as { quantity: string; delta: string; averageCost: string };
    assert.equal(result.quantity, "2.0000");
    assert.equal(result.balanceAfter, "7.0000");
    assert.equal(movement.quantity, "7.0000");
    assert.equal(movement.delta, "2.0000");
    assert.equal(movement.averageCost, "9.1429");
    assert.equal(payload?.location, "MAIN LOCATION");
    assert.equal((audits[0]?.newValues as Record<string, unknown>).quantity, "2.0000");
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

  it("writes the signed delta to movements and the resulting balance to stock", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const tx = {
      inventoryMovement: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          calls.push(data);
        },
      },
      inventoryBalance: {
        upsert: async ({
          create,
          update,
        }: {
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => {
          calls.push(create, update);
        },
      },
    };
    const repository = new InventoryRepository({
      $transaction: async (fn: (client: unknown) => Promise<unknown>) => fn(tx),
    } as never);

    await repository.createAdjustment("org-1", "actor-1", {
      productId: "p1",
      location: DEFAULT_LOCATION,
      unitCost: "12",
      movement: { quantity: "7.0000", delta: "2.0000", averageCost: "9.1429", balanceAfter: "7.0000" },
    });

    assert.equal(calls[0]?.quantity, "2.0000");
    assert.equal(calls[1]?.quantity, "7.0000");
    assert.equal(calls[2]?.quantity, "7.0000");
  });
});

describe("inventory queries and options", () => {
  it("accepts search and location filters", () => {
    assert.equal(stockQuerySchema.safeParse({ q: "widget", location: "MAIN" }).success, true);
    assert.equal(movementQuerySchema.safeParse({ q: "GR-1", location: "MAIN" }).success, true);
  });

  it("filters stock by product code, product name, and location", async () => {
    let where: Record<string, unknown> | null = null;
    const repository = new InventoryRepository({
      inventoryBalance: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          where = args.where;
          return [];
        },
      },
    } as never);

    await repository.listStock("org-1", { q: "widget", location: "MAIN", limit: 50, order: "desc" } as never);

    assert.ok(where);
    assert.equal(where.location, "MAIN");
    const productConditions = where.product as {
      OR: Array<Record<string, { contains: string; mode: string }>>;
    };
    assert.equal(productConditions.OR[0].code?.contains, "widget");
    assert.equal(productConditions.OR[0].code?.mode, "insensitive");
    assert.equal(productConditions.OR[1].name?.contains, "widget");
  });

  it("combines movement search, location, and cursor predicates", async () => {
    let where: Record<string, unknown> | null = null;
    const repository = new InventoryRepository({
      inventoryMovement: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          where = args.where;
          return [];
        },
      },
    } as never);

    await repository.listMovements("org-1", {
      q: "GR-1",
      location: "MAIN",
      cursor: encodeCursor({ createdAt: "2026-01-01T00:00:00.000Z", id: "mov-1" }),
      limit: 50,
      order: "desc",
    } as never);

    assert.ok(where);
    assert.equal(where.location, "MAIN");
    const filters = where.AND as Array<Record<string, unknown>>;
    assert.equal(filters.length, 2);
    assert.ok(Array.isArray(filters[0].OR));
    assert.ok(Array.isArray(filters[1].OR));
  });

  it("returns option-shaped form data with adjustment reasons", async () => {
    const repository = new InventoryRepository({
      product: {
        findMany: async () => [
          {
            id: "p1",
            code: "WIDGET",
            name: "Widget",
            receivingLocation: null,
            minimumStockQuantity: "0",
            trackInventory: true,
            category: null,
            unitOfMeasure: null,
          },
        ],
      },
      inventoryBalance: { findMany: async () => [] },
    } as never);

    const options = await repository.formOptions("org-1");

    assert.deepEqual(options.reasons, INVENTORY_ADJUSTMENT_REASONS.map(({ value, label }) => ({ value, label })));
    assert.deepEqual(options.locations, [{ value: DEFAULT_LOCATION, label: DEFAULT_LOCATION }]);
    assert.equal(options.movementTypes.length, 4);
    assert.equal(options.products[0]?.value, "p1");
    assert.equal(options.products[0]?.label, "WIDGET · Widget");
  });
});

describe("vendor list options", () => {
  it("accepts status as a sort field", () => {
    assert.equal(vendorListQuerySchema.parse({ sort: "status" }).sort, "status");
  });

  it("orders vendor rows deterministically by status", async () => {
    let args: { orderBy?: unknown } | null = null;
    const repository = new VendorsRepository({
      vendor: {
        findMany: async (input: { orderBy: unknown }) => {
          args = input;
          return [];
        },
      },
    } as never);

    await repository.list({ organizationId: "org-1" }, 50, "status", "asc");

    assert.ok(args);
    assert.deepEqual(args.orderBy, [{ status: "asc" }, { id: "asc" }]);
  });

  it("builds a status sort cursor from the status value", () => {
    const rows = [
      { id: "v1", createdAt: new Date(), name: "One", vendorNumber: "V-1", code: null, status: "ACTIVE" },
      { id: "v2", createdAt: new Date(), name: "Two", vendorNumber: "V-2", code: null, status: "INACTIVE" },
    ];
    const page = toVendorPage(rows, 1, "status");
    assert.equal(page.pageInfo.hasNextPage, true);
    assert.ok(page.pageInfo.nextCursor);
  });
});

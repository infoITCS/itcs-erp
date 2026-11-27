import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ValidationFailedError } from "../src/common/errors/app-error";
import { PurchasingService } from "../src/modules/purchasing/service";
import { SalesOrdersService } from "../src/modules/sales-orders/service";

const meta = { ipAddress: null, userAgent: null };
const audit = { async record() {} };

describe("sales purchase fulfilment", () => {
  it("creates a purchase order for stock shortfalls and links source order lines", async () => {
    let payload: Record<string, unknown> | null = null;
    const service = new PurchasingService(
      {
        async findSalesOrderForPurchase() {
          return {
            id: "so-1",
            salesOrderNumber: "SO-2026-00001",
            status: "CONFIRMED",
            currencyCode: "PKR",
            lines: [
              {
                id: "sol-1",
                productId: "p1",
                productCode: "WIDGET",
                productName: "Widget",
                description: null,
                unitOfMeasure: "EA",
                quantity: "10",
                fulfilledQuantity: "2",
                unitPrice: "100",
                taxCodeId: null,
                taxCode: null,
                taxRate: "0",
              },
            ],
          };
        },
        async findVendor() {
          return { id: "v1", status: "ACTIVE", currencyCode: "PKR" };
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
              receivingLocation: "WH-1",
              trackInventory: true,
              weightedAveragePrice: "7.5000",
              allowNegativeStock: false,
            },
          ];
        },
        async sumInventoryByProducts() {
          return [{ productId: "p1", quantity: "3.0000" }];
        },
        async findTaxCodesByIds() {
          return [];
        },
        async findOrganization() {
          return { baseCurrencyCode: "PKR" };
        },
        async findExchangeRateValue() {
          return null;
        },
        async createOrder(_organizationId: string, _actorId: string, data: Record<string, unknown>) {
          payload = data;
          return { id: "po-1", purchaseOrderNumber: "PO-2026-00001", status: "DRAFT", total: "37.5000" };
        },
      } as never,
      audit as never,
    );

    const order = await service.createOrderFromSalesOrder(
      "org-1",
      "actor-1",
      { salesOrderId: "so-1", vendorId: "v1" } as never,
      meta,
    );

    assert.equal(order.id, "po-1");
    assert.equal(payload?.sourceSalesOrderId, "so-1");
    assert.equal((payload?.lines as Array<Record<string, string>>)[0].quantity, "5.0000");
    assert.equal((payload?.lines as Array<Record<string, string>>)[0].unitPrice, "7.5000");
    assert.equal((payload?.lines as Array<Record<string, string>>)[0].sourceSalesOrderLineId, "sol-1");
  });

  it("fulfils a confirmed sales order from stock and records cost of goods sold", async () => {
    let fulfilled = false;
    let payload: Record<string, unknown> | null = null;
    const repository = {
      async findById() {
        return {
          id: "so-1",
          salesOrderNumber: "SO-2026-00001",
          customerId: "c1",
          currencyCode: "PKR",
          status: fulfilled ? "FULFILLED" : "CONFIRMED",
          lines: [
            {
              id: "sol-1",
              productId: "p1",
              productCode: "WIDGET",
              productName: "Widget",
              description: null,
              unitOfMeasure: "EA",
              quantity: "5",
              fulfilledQuantity: fulfilled ? "5" : "0",
              unitPrice: "100",
              discountPercent: "0",
              taxCodeId: null,
              taxCode: null,
              taxRate: "0",
              lineSubtotal: "500.0000",
              lineDiscount: "0.0000",
              lineTax: "0.0000",
              lineTotal: "500.0000",
              cogsAmount: fulfilled ? "20.0000" : "0.0000",
              sortOrder: 0,
            },
          ],
          cogsTotal: fulfilled ? "20.0000" : "0.0000",
        };
      },
      async findProductsByIds() {
        return [
          {
            id: "p1",
            trackInventory: true,
            weightedAveragePrice: "4",
            deliveryLocation: "WH-1",
            allowNegativeStock: false,
          },
        ];
      },
      async findInventoryBalances() {
        return [{ productId: "p1", location: "WH-1", quantity: "5", averageCost: "4" }];
      },
      async fulfilOrder(
        _organizationId: string,
        _actorId: string,
        _id: string,
        lines: Record<string, unknown>[],
      ) {
        payload = lines[0];
        fulfilled = true;
        return { id: "so-1", status: "FULFILLED" };
      },
    };
    const service = new SalesOrdersService(repository as never, audit as never);

    const order = await service.fulfil("org-1", "actor-1", "so-1", meta);

    assert.equal(order.status, "FULFILLED");
    assert.equal(payload?.quantity, "5.0000");
    assert.equal(payload?.unitCost, "4.0000");
    assert.equal(payload?.cogsAmount, "20.0000");
    assert.equal(payload?.location, "WH-1");
  });

  it("rejects fulfilment when tracked stock is insufficient", async () => {
    const repository = {
      async findById() {
        return {
          id: "so-1",
          salesOrderNumber: "SO-2026-00001",
          customerId: "c1",
          currencyCode: "PKR",
          status: "CONFIRMED",
          lines: [
            {
              id: "sol-1",
              productId: "p1",
              productCode: "WIDGET",
              productName: "Widget",
              quantity: "5",
              fulfilledQuantity: "0",
              sortOrder: 0,
            },
          ],
        };
      },
      async findProductsByIds() {
        return [{ id: "p1", trackInventory: true, deliveryLocation: "WH-1", allowNegativeStock: false }];
      },
      async findInventoryBalances() {
        return [{ productId: "p1", location: "WH-1", quantity: "2", averageCost: "4" }];
      },
    };
    const service = new SalesOrdersService(repository as never, audit as never);

    await assert.rejects(
      () => service.fulfil("org-1", "actor-1", "so-1", meta),
      (error: unknown) =>
        error instanceof ValidationFailedError &&
        Boolean(error.errors?.lines?.some((message) => message.includes("only 2.0000 is available in WH-1"))),
    );
  });
});

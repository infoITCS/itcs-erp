import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { requirePermission } from "../src/middleware/authorize";
import type { AuditEntry } from "../src/modules/audit-logs/types";
import { buildProductListWhere } from "../src/modules/products/list-filter";
import { dateRangesOverlap } from "../src/modules/products/price-overlap";
import { currentSalesPriceWhere } from "../src/modules/products/repository";
import { ProductsService } from "../src/modules/products/service";
import {
  createProductSchema,
  createTaxCodeSchema,
  createUnitOfMeasureSchema,
  productListQuerySchema,
  productPriceInputSchema,
} from "../src/modules/products/validation";

const orgId = "8d6c1b2a-4e3f-4a1b-9c2d-1a2b3c4d5e6f";
const actorId = "6f0b9c3e-1c0a-4f0a-9c1e-6d5b2a9e8f11";
const uomId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const meta = { ipAddress: "127.0.0.1", userAgent: "test" };

const validProduct = {
  name: "Managed firewall",
  productType: "SERVICE",
  unitOfMeasureId: uomId,
};

describe("product validation", () => {
  it("rejects a service that tracks inventory", () => {
    const parsed = createProductSchema.safeParse({ ...validProduct, trackInventory: true });
    assert.equal(parsed.success, false);
  });

  it("accepts a physical product and uppercases currency on prices", () => {
    const parsed = createProductSchema.safeParse({
      ...validProduct,
      productType: "PHYSICAL_PRODUCT",
      trackInventory: true,
      initialSalesPrice: {
        priceType: "SALES",
        currencyCode: "pkr",
        amount: "1500.0000",
        effectiveDate: "2026-01-01",
      },
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.initialSalesPrice?.currencyCode, "PKR");
      assert.equal(parsed.data.initialSalesPrice?.priceListCode, "STANDARD");
    }
  });

  it("defaults service posting accounts to service revenue and cost accounts", () => {
    const parsed = createProductSchema.safeParse({ ...validProduct, productType: "SERVICE" });

    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.incomeAccount, "Sales - Services (40140)");
      assert.equal(parsed.data.cogsAccount, "COGS - Services (50140)");
    }
  });

  it("accepts the product form payload with empty dropdowns and accounts", () => {
    const parsed = createProductSchema.safeParse({
      name: "Managed firewall",
      description: undefined,
      productType: "SERVICE",
      status: "ACTIVE",
      categoryId: null,
      unitOfMeasureId: uomId,
      taxCodeId: null,
      trackInventory: false,
      valuationMethod: "WEIGHTED_AVERAGE",
      weightedAveragePrice: "0.00",
      allowNegativeStock: false,
      minimumStockQuantity: "0.00",
      receivingLocation: "MAIN LOCATION",
      deliveryLocation: "MAIN LOCATION",
      inventoryAccount: null,
      inventoryTransitAccount: null,
      privateNote: "",
      netWeight: "0.00",
      width: "0.00",
      length: "0.00",
      height: "0.00",
      dimensionUnit: "METER",
      cogsAccount: "COGS - Services (50140)",
      incomeAccount: "Sales - Services (40140)",
      notes: null,
      initialSalesPrice: {
        priceType: "SALES",
        currencyCode: "PKR",
        amount: "0.00",
        effectiveDate: "2026-11-26",
      },
      initialPurchasePrice: {
        priceType: "PURCHASE",
        currencyCode: "PKR",
        amount: "0.00",
        effectiveDate: "2026-11-26",
      },
    });

    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.categoryId, null);
      assert.equal(parsed.data.taxCodeId, null);
      assert.equal(parsed.data.inventoryAccount, null);
      assert.equal(parsed.data.privateNote, null);
    }
  });

  it("accepts OneUp product fields with safe defaults", () => {
    const parsed = createProductSchema.safeParse({
      ...validProduct,
      productType: "PHYSICAL_PRODUCT",
      trackInventory: true,
      valuationMethod: "FIFO",
      weightedAveragePrice: "120.5000",
      allowNegativeStock: true,
      minimumStockQuantity: "5",
      receivingLocation: "MAIN STORE",
      deliveryLocation: "DISPATCH",
      inventoryAccount: "12100 ( Inventory )",
      inventoryTransitAccount: "12900 ( Inventory in Transit )",
      privateNote: "Handle with care",
      netWeight: "2.500",
      width: "10",
      length: "20",
      height: "5",
      dimensionUnit: "CENTIMETER",
      cogsAccount: "COGS - Products (50110)",
      incomeAccount: "Sales - Miscellaneous (40150)",
      initialPurchasePrice: {
        priceType: "PURCHASE",
        currencyCode: "pkr",
        amount: "90.0000",
        effectiveDate: "2026-01-01",
      },
    });

    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.initialPurchasePrice?.currencyCode, "PKR");
      assert.equal(parsed.data.valuationMethod, "FIFO");
      assert.equal(parsed.data.dimensionUnit, "CENTIMETER");
      assert.equal(parsed.data.receivingLocation, "MAIN STORE");
      assert.equal(parsed.data.privateNote, "Handle with care");
    }
  });

  it("rejects malformed OneUp fields and illegal service inventory flags", () => {
    assert.equal(
      createProductSchema.safeParse({ ...validProduct, valuationMethod: "AVERAGE" }).success,
      false,
    );
    assert.equal(
      createProductSchema.safeParse({ ...validProduct, dimensionUnit: "KILOMETER" }).success,
      false,
    );
    assert.equal(
      createProductSchema.safeParse({ ...validProduct, allowNegativeStock: true }).success,
      false,
    );
  });

  it("rejects an oversized product page", () => {
    assert.equal(productListQuerySchema.safeParse({ limit: "101" }).success, false);
  });

  it("rejects expiry before effective date", () => {
    const parsed = productPriceInputSchema.safeParse({
      priceType: "SALES",
      currencyCode: "PKR",
      amount: "10",
      effectiveDate: "2026-06-01",
      expiryDate: "2026-01-01",
    });
    assert.equal(parsed.success, false);
  });

  it("rejects amounts with more than four decimals and accepts a cleared expiry", () => {
    const invalid = productPriceInputSchema.safeParse({
      priceType: "SALES",
      currencyCode: "PKR",
      amount: "10.12345",
      effectiveDate: "2026-01-01",
    });
    const cleared = productPriceInputSchema.safeParse({
      priceType: "SALES",
      currencyCode: "PKR",
      amount: "10.0000",
      effectiveDate: "2026-01-01",
      expiryDate: null,
    });
    assert.equal(invalid.success, false);
    assert.equal(cleared.success, true);
  });

  it("normalizes inline option codes and caps tax rates", () => {
    const unit = createUnitOfMeasureSchema.safeParse({ code: "day", name: "Day" });
    const tax = createTaxCodeSchema.safeParse({ code: "gst17", name: "GST 17%", rate: "17.0000" });
    const invalidTax = createTaxCodeSchema.safeParse({ code: "gst120", name: "GST 120%", rate: "120" });

    assert.equal(unit.success, true);
    assert.equal(tax.success, true);
    assert.equal(invalidTax.success, false);
    if (unit.success) {
      assert.equal(unit.data.code, "DAY");
    }
    if (tax.success) {
      assert.equal(tax.data.code, "GST17");
    }
  });
});

describe("price date overlap", () => {
  it("allows adjacent non-overlapping ranges", () => {
    assert.equal(dateRangesOverlap("2026-01-01", "2026-06-30", "2026-07-01", "2026-12-31"), false);
  });

  it("rejects overlapping ranges", () => {
    assert.equal(dateRangesOverlap("2026-01-01", "2026-06-30", "2026-06-01", "2026-12-31"), true);
  });

  it("treats a null expiry as open-ended", () => {
    assert.equal(dateRangesOverlap("2026-01-01", null, "2026-06-01", "2026-12-31"), true);
  });
});

describe("product list filters", () => {
  it("always scopes the query to the organization and hides deleted rows", () => {
    const where = buildProductListWhere({ organizationId: orgId, q: "firewall", status: "ACTIVE" });
    assert.equal(where.organizationId, orgId);
    assert.equal(where.deletedAt, null);
    assert.equal(where.status, "ACTIVE");
    assert.ok(Array.isArray(where.OR));
  });

  it("keeps deleted rows only when includeDeleted is set", () => {
    const where = buildProductListWhere({
      organizationId: orgId,
      includeDeleted: true,
      productType: "SERVICE",
    });
    assert.equal(where.deletedAt, undefined);
    assert.equal(where.productType, "SERVICE");
  });

  it("selects only current active standard sales prices for document options", () => {
    const where = currentSalesPriceWhere();
    assert.equal(where.deletedAt, null);
    assert.equal(where.isActive, true);
    assert.equal(where.priceType, "SALES");
    assert.equal(where.priceListCode, "STANDARD");
    assert.ok(Array.isArray(where.OR));
  });
});

describe("product service", () => {
  it("creates a product and records an audit event", async () => {
    const audits: AuditEntry[] = [];
    const service = new ProductsService(
      {
        async findActiveUom() {
          return { id: uomId, code: "HOUR", name: "Hour" };
        },
        async create() {
          return {
            id: "11111111-1111-4111-8111-111111111111",
            code: "PRD-2026-00001",
            name: "Managed firewall",
            productType: "SERVICE",
            status: "ACTIVE",
            prices: [],
          };
        },
      } as never,
      recorder(audits),
    );

    const product = await service.create(orgId, actorId, validProduct as never, meta);
    assert.equal(product.code, "PRD-2026-00001");
    assert.equal(audits[0]?.action, "products.created");
  });

  it("returns stable form options with existing custom accounts and locations", async () => {
    const service = new ProductsService(
      {
        async listAccountOptions() {
          return ["Sales - Support (40160)"];
        },
        async listLocationOptions() {
          return ["SITE B", "MAIN LOCATION"];
        },
      } as never,
      recorder([]),
    );
    const options = await service.formOptions(orgId);

    assert.deepEqual(options.locations, ["MAIN LOCATION", "SITE B"]);
    assert.deepEqual(options.valuationMethods.map((option) => option.value), ["WEIGHTED_AVERAGE", "FIFO"]);
    assert.deepEqual(options.dimensionUnits.map((option) => option.value), ["METER", "CENTIMETER", "INCH", "FOOT"]);
    assert.ok(options.accounts.includes("COGS - Products (50110)"));
    assert.ok(options.accounts.includes("Sales - Services (40140)"));
    assert.ok(options.accounts.includes("Sales - Support (40160)"));
  });

  it("rejects overlapping active prices for the same key", async () => {
    const audits: AuditEntry[] = [];
    const service = new ProductsService(
      {
        async findById() {
          return { id: "11111111-1111-4111-8111-111111111111", code: "PRD-1", name: "Item" };
        },
        async currencyIsActive() {
          return true;
        },
        async listOverlappingPriceCandidates() {
          return [
            {
              id: "p1",
              effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
              expiryDate: new Date("2026-06-30T00:00:00.000Z"),
            },
          ];
        },
        mapPriceDates(row: { effectiveDate: Date; expiryDate: Date | null }) {
          return {
            effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
            expiryDate: row.expiryDate ? row.expiryDate.toISOString().slice(0, 10) : null,
          };
        },
      } as never,
      recorder(audits),
    );

    await assert.rejects(
      () =>
        service.createPrice(
          orgId,
          actorId,
          "11111111-1111-4111-8111-111111111111",
          {
            priceType: "SALES",
            priceListCode: "STANDARD",
            currencyCode: "PKR",
            amount: "100.0000",
            effectiveDate: "2026-06-01",
            expiryDate: "2026-12-31",
          },
          meta,
        ),
      /overlapping dates/,
    );
    assert.equal(audits.length, 0);
  });

  it("soft-deletes a product without removing the row", async () => {
    const audits: AuditEntry[] = [];
    let deleted = false;
    const service = new ProductsService(
      {
        async findById() {
          return { id: "11111111-1111-4111-8111-111111111111", code: "PRD-1", name: "Item", status: "ACTIVE" };
        },
        async softDelete() {
          deleted = true;
          return true;
        },
      } as never,
      recorder(audits),
    );

    await service.remove(orgId, actorId, "11111111-1111-4111-8111-111111111111", meta);
    assert.equal(deleted, true);
    assert.equal(audits[0]?.action, "products.deleted");
  });

  it("rejects a category parent that would create a cycle", async () => {
    const service = new ProductsService(
      {
        async findCategory(_organizationId: string, id: string) {
          return { id, code: id, name: id, parentId: null };
        },
        async categoryAncestorIds() {
          return ["cat-parent", "cat-child"];
        },
      } as never,
      recorder([]),
    );

    try {
      await service.updateCategory(orgId, actorId, "cat-parent", { parentId: "cat-child" }, meta);
      assert.fail("expected cycle rejection");
    } catch (error) {
      const errors = (error as { errors?: Record<string, string[]> }).errors;
      assert.ok(errors?.parentId?.[0]?.includes("cycle"));
    }
  });
});

describe("products permissions", () => {
  it("allows products:read and blocks products:create", () => {
    const allow = requirePermission("products:read");
    const deny = requirePermission("products:create");
    const req = { auth: { permissions: ["products:read"] } } as Request;
    let allowed = false;
    let denied: unknown;
    allow(req, {} as Response, (() => {
      allowed = true;
    }) as NextFunction);
    deny(req, {} as Response, ((error?: unknown) => {
      denied = error;
    }) as NextFunction);
    assert.equal(allowed, true);
    assert.equal((denied as { statusCode?: number }).statusCode, 403);
  });
});

function recorder(audits: AuditEntry[]) {
  return {
    async record(entry: AuditEntry) {
      audits.push(entry);
    },
  };
}

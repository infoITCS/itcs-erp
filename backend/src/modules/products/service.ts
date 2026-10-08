import type { Prisma } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import { assertDecimalString } from "../../common/money/decimal";
import type { AuditWriter } from "../audit-logs/types";
import type { RequestMeta } from "../auth/types";
import { dateRangesOverlap } from "./price-overlap";
import { toProductPage, type ProductSort } from "./page";
import type { ProductsRepository } from "./repository";
import type {
  CreateCategoryInput,
  CreateProductInput,
  ProductListQuery,
  ProductPriceInput,
  UpdateCategoryInput,
  UpdateProductInput,
} from "./validation";

const PRODUCTS = "products";
const AMOUNT_SCALE = 4;

export class ProductsService {
  constructor(
    private readonly repository: ProductsRepository,
    private readonly audit: AuditWriter,
  ) {}

  async list(organizationId: string, query: ProductListQuery, permissions: string[]) {
    if (query.includeDeleted && !canSeeDeleted(permissions)) {
      throw new ForbiddenError();
    }
    const sort = (query.sort ?? "createdAt") as ProductSort;
    const rows = await this.repository.list(
      {
        organizationId,
        q: query.q,
        status: query.status,
        productType: query.productType,
        categoryId: query.categoryId,
        trackInventory: query.trackInventory,
        from: query.from,
        to: query.to,
        includeDeleted: query.includeDeleted,
      },
      query.limit,
      sort,
      query.order,
      query.cursor,
    );
    return toProductPage(rows, query.limit, sort);
  }

  async get(organizationId: string, id: string) {
    const product = await this.repository.findById(organizationId, id);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    return product;
  }

  async create(organizationId: string, actorId: string, input: CreateProductInput, meta: RequestMeta) {
    await this.requireUom(organizationId, input.unitOfMeasureId);
    if (input.categoryId) {
      await this.requireCategory(organizationId, input.categoryId);
    }
    if (input.taxCodeId) {
      await this.requireTaxCode(organizationId, input.taxCodeId);
    }
    if (input.initialSalesPrice) {
      await this.requireCurrency(input.initialSalesPrice.currencyCode);
      assertDecimalString(input.initialSalesPrice.amount, AMOUNT_SCALE, "amount");
    }

    const product = await this.repository.create(organizationId, actorId, {
      ...input,
      initialSalesPrice: input.initialSalesPrice
        ? { ...input.initialSalesPrice, priceType: "SALES" }
        : undefined,
    });
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    await this.record(organizationId, actorId, "products.created", "product", product.id, meta, {
      productId: product.id,
      code: product.code,
      name: product.name,
      productType: product.productType,
      status: product.status,
    });
    if (input.initialSalesPrice && product.prices[0]) {
      await this.record(organizationId, actorId, "products.price.created", "product_price", product.prices[0].id, meta, {
        productId: product.id,
        priceType: product.prices[0].priceType,
        currencyCode: product.prices[0].currencyCode,
        amount: String(product.prices[0].amount),
      });
    }
    return product;
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    input: UpdateProductInput,
    meta: RequestMeta,
  ) {
    const existing = await this.get(organizationId, id);
    if (input.unitOfMeasureId) {
      await this.requireUom(organizationId, input.unitOfMeasureId);
    }
    if (input.categoryId) {
      await this.requireCategory(organizationId, input.categoryId);
    }
    if (input.taxCodeId) {
      await this.requireTaxCode(organizationId, input.taxCodeId);
    }
    const nextType = input.productType ?? existing.productType;
    if (nextType === "SERVICE" && input.trackInventory === true) {
      throw new ValidationFailedError({ trackInventory: ["A service cannot track inventory"] });
    }

    const updated = await this.repository.update(organizationId, id, actorId, input);
    if (!updated) {
      throw new NotFoundError("Product not found");
    }

    if (input.status && input.status !== existing.status) {
      await this.record(
        organizationId,
        actorId,
        "products.status.changed",
        "product",
        id,
        meta,
        { productId: id, status: input.status },
        { status: existing.status },
      );
    }
    if (input.taxCodeId !== undefined && input.taxCodeId !== existing.taxCodeId) {
      await this.record(
        organizationId,
        actorId,
        "products.tax.changed",
        "product",
        id,
        meta,
        { productId: id, taxCodeId: input.taxCodeId },
        { taxCodeId: existing.taxCodeId },
      );
    }
    const otherFields = { ...input };
    delete otherFields.status;
    delete otherFields.taxCodeId;
    if (Object.values(otherFields).some((value) => value !== undefined)) {
      await this.record(organizationId, actorId, "products.updated", "product", id, meta, {
        productId: id,
        changes: otherFields,
      });
    }
    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    const removed = await this.repository.softDelete(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Product not found");
    }
    await this.record(organizationId, actorId, "products.deleted", "product", id, meta, {
      productId: id,
      code: existing.code,
      name: existing.name,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async restore(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const restored = await this.repository.restore(organizationId, id, actorId);
    if (!restored) {
      throw new NotFoundError("Deleted product not found");
    }
    await this.record(organizationId, actorId, "products.restored", "product", id, meta, { productId: id });
    return this.get(organizationId, id);
  }

  async listUnits(organizationId: string) {
    return this.repository.listUnits(organizationId);
  }

  async listTaxCodes(organizationId: string) {
    return this.repository.listTaxCodes(organizationId);
  }

  async listCategories(organizationId: string) {
    return this.repository.listCategories(organizationId);
  }

  async createCategory(organizationId: string, actorId: string, input: CreateCategoryInput, meta: RequestMeta) {
    if (input.parentId) {
      await this.requireCategory(organizationId, input.parentId, "parentId");
    }
    const category = await this.repository.createCategory(organizationId, actorId, input);
    await this.record(organizationId, actorId, "products.category.created", "product_category", category.id, meta, {
      categoryId: category.id,
      code: category.code,
      name: category.name,
      parentId: category.parentId,
    });
    return category;
  }

  async updateCategory(
    organizationId: string,
    actorId: string,
    id: string,
    input: UpdateCategoryInput,
    meta: RequestMeta,
  ) {
    const existing = await this.repository.findCategory(organizationId, id);
    if (!existing) {
      throw new NotFoundError("Category not found");
    }
    if (input.parentId !== undefined && input.parentId !== null) {
      if (input.parentId === id) {
        throw new ValidationFailedError({ parentId: ["A category cannot be its own parent"] });
      }
      await this.requireCategory(organizationId, input.parentId, "parentId");
      const ancestors = await this.repository.categoryAncestorIds(organizationId, input.parentId);
      if (ancestors.includes(id)) {
        throw new ValidationFailedError({ parentId: ["That parent would create a category cycle"] });
      }
    }
    const updated = await this.repository.updateCategory(organizationId, id, actorId, input);
    if (!updated) {
      throw new NotFoundError("Category not found");
    }
    await this.record(
      organizationId,
      actorId,
      "products.category.updated",
      "product_category",
      id,
      meta,
      { categoryId: id, changes: input },
      { code: existing.code, name: existing.name, parentId: existing.parentId },
    );
    return updated;
  }

  async removeCategory(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.repository.softDeleteCategory(organizationId, id, actorId);
    if (!existing) {
      throw new NotFoundError("Category not found");
    }
    await this.record(organizationId, actorId, "products.category.deleted", "product_category", id, meta, {
      categoryId: id,
      code: existing.code,
      name: existing.name,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async listPrices(organizationId: string, productId: string) {
    await this.get(organizationId, productId);
    return this.repository.listPrices(organizationId, productId);
  }

  async createPrice(
    organizationId: string,
    actorId: string,
    productId: string,
    input: ProductPriceInput,
    meta: RequestMeta,
  ) {
    await this.get(organizationId, productId);
    await this.requireCurrency(input.currencyCode);
    const amount = assertDecimalString(input.amount, AMOUNT_SCALE, "amount");
    const normalized = { ...input, amount };
    await this.assertNoPriceOverlap(organizationId, productId, normalized);
    const price = await this.repository.createPrice(organizationId, productId, actorId, normalized);
    await this.record(organizationId, actorId, "products.price.created", "product_price", price.id, meta, {
      productId,
      priceType: price.priceType,
      priceListCode: price.priceListCode,
      currencyCode: price.currencyCode,
      amount: String(price.amount),
      effectiveDate: this.repository.mapPriceDates(price).effectiveDate,
      expiryDate: this.repository.mapPriceDates(price).expiryDate,
    });
    return price;
  }

  async updatePrice(
    organizationId: string,
    actorId: string,
    id: string,
    input: ProductPriceInput,
    meta: RequestMeta,
  ) {
    const existing = await this.repository.findPrice(organizationId, id);
    if (!existing) {
      throw new NotFoundError("Price not found");
    }
    await this.requireCurrency(input.currencyCode);
    const amount = assertDecimalString(input.amount, AMOUNT_SCALE, "amount");
    const normalized = { ...input, amount };
    await this.assertNoPriceOverlap(organizationId, existing.productId, normalized, id);
    const price = await this.repository.updatePrice(organizationId, id, actorId, normalized);
    if (!price) {
      throw new NotFoundError("Price not found");
    }
    await this.record(
      organizationId,
      actorId,
      "products.price.updated",
      "product_price",
      id,
      meta,
      {
        productId: price.productId,
        priceType: price.priceType,
        currencyCode: price.currencyCode,
        amount: String(price.amount),
      },
      {
        priceType: existing.priceType,
        currencyCode: existing.currencyCode,
        amount: String(existing.amount),
      },
    );
    return price;
  }

  async removePrice(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.repository.softDeletePrice(organizationId, id, actorId);
    if (!existing) {
      throw new NotFoundError("Price not found");
    }
    await this.record(organizationId, actorId, "products.price.deleted", "product_price", id, meta, {
      productId: existing.productId,
      priceType: existing.priceType,
      currencyCode: existing.currencyCode,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  private async assertNoPriceOverlap(
    organizationId: string,
    productId: string,
    input: ProductPriceInput,
    exceptId?: string,
  ) {
    if (input.isActive === false) {
      return;
    }
    const candidates = await this.repository.listOverlappingPriceCandidates(
      organizationId,
      productId,
      input.priceType,
      input.priceListCode,
      input.currencyCode,
      exceptId,
    );
    for (const candidate of candidates) {
      const dates = this.repository.mapPriceDates(candidate);
      if (dateRangesOverlap(input.effectiveDate, input.expiryDate, dates.effectiveDate, dates.expiryDate)) {
        throw new ConflictError(
          "An active price already covers overlapping dates for this product, type, list, and currency",
        );
      }
    }
  }

  private async requireCurrency(code: string) {
    if (!(await this.repository.currencyIsActive(code))) {
      throw new ValidationFailedError({ currencyCode: ["Choose an active currency"] });
    }
  }

  private async requireUom(organizationId: string, id: string) {
    if (!(await this.repository.findActiveUom(organizationId, id))) {
      throw new ValidationFailedError({ unitOfMeasureId: ["Choose an active unit of measure"] });
    }
  }

  private async requireCategory(organizationId: string, id: string, field = "categoryId") {
    if (!(await this.repository.findCategory(organizationId, id))) {
      throw new ValidationFailedError({ [field]: ["Choose an active category"] });
    }
  }

  private async requireTaxCode(organizationId: string, id: string) {
    if (!(await this.repository.findTaxCode(organizationId, id))) {
      throw new ValidationFailedError({ taxCodeId: ["Choose an active tax code"] });
    }
  }

  private record(
    organizationId: string,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    meta: RequestMeta,
    newValues: Prisma.InputJsonValue,
    oldValues?: Prisma.InputJsonValue,
  ) {
    return this.audit.record({
      organizationId,
      userId: actorId,
      action,
      module: PRODUCTS,
      entityType,
      entityId,
      oldValues,
      newValues,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }
}

function canSeeDeleted(permissions: string[]): boolean {
  return permissions.includes("products:delete") || permissions.includes("products:restore");
}

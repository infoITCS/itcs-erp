import { Prisma, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { ConflictError } from "../../common/errors/app-error";
import { allocateDocumentNumberIn } from "../../common/numbering/allocate";
import { buildProductListWhere, type ProductListFilter } from "./list-filter";
import { decodeProductCursor, productCursorWhere, type ProductSort } from "./page";
import { toDateOnly } from "./price-overlap";
import type { CreateCategoryInput, CreateProductInput, ProductPriceInput, UpdateCategoryInput, UpdateProductInput } from "./validation";

const productSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  productType: true,
  status: true,
  categoryId: true,
  unitOfMeasureId: true,
  taxCodeId: true,
  trackInventory: true,
  notes: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, code: true, name: true } },
  unitOfMeasure: { select: { id: true, code: true, name: true } },
  taxCode: { select: { id: true, code: true, name: true, rate: true } },
} satisfies Prisma.ProductSelect;

const priceSelect = {
  id: true,
  productId: true,
  priceType: true,
  priceListCode: true,
  currencyCode: true,
  amount: true,
  effectiveDate: true,
  expiryDate: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductPriceSelect;

const categorySelect = {
  id: true,
  parentId: true,
  code: true,
  name: true,
  description: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductCategorySelect;

export class ProductsRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(filter: ProductListFilter, limit: number, sort: ProductSort, order: "asc" | "desc", cursor?: string) {
    const decoded = cursor ? decodeProductCursor(cursor) : null;
    const where = buildProductListWhere(filter);
    return this.db.product.findMany({
      where: decoded && decoded.sort === sort ? { AND: [where, productCursorWhere(decoded, order)] } : where,
      orderBy: [{ [sort]: order }, { id: order }],
      take: limit + 1,
      select: {
        ...productSelect,
        prices: {
          where: {
            deletedAt: null,
            isActive: true,
            priceType: "SALES",
            priceListCode: "STANDARD",
          },
          orderBy: [{ effectiveDate: "desc" }],
          take: 1,
          select: priceSelect,
        },
      },
    });
  }

  async findById(organizationId: string, id: string, includeDeleted = false) {
    return this.db.product.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: {
        ...productSelect,
        prices: {
          where: { deletedAt: null },
          orderBy: [{ priceType: "asc" }, { effectiveDate: "desc" }],
          select: priceSelect,
        },
      },
    });
  }

  async codeExists(organizationId: string, code: string, exceptId?: string): Promise<boolean> {
    const row = await this.db.product.findFirst({
      where: {
        organizationId,
        code,
        deletedAt: null,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true },
    });
    return row !== null;
  }

  async currencyIsActive(code: string): Promise<boolean> {
    const currency = await this.db.currency.findUnique({ where: { code }, select: { isActive: true } });
    return currency?.isActive === true;
  }

  async findActiveUom(organizationId: string, id: string) {
    return this.db.unitOfMeasure.findFirst({
      where: { id, organizationId, isActive: true },
      select: { id: true, code: true, name: true },
    });
  }

  async findCategory(organizationId: string, id: string) {
    return this.db.productCategory.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: categorySelect,
    });
  }

  async findTaxCode(organizationId: string, id: string) {
    return this.db.taxCode.findFirst({
      where: { id, organizationId, isActive: true },
      select: { id: true, code: true, name: true, rate: true },
    });
  }

  async listUnits(organizationId: string) {
    return this.db.unitOfMeasure.findMany({
      where: { organizationId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, isActive: true },
    });
  }

  async listTaxCodes(organizationId: string) {
    return this.db.taxCode.findMany({
      where: { organizationId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, rate: true, isActive: true },
    });
  }

  async listCategories(organizationId: string) {
    return this.db.productCategory.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: categorySelect,
    });
  }

  async create(organizationId: string, actorId: string, input: CreateProductInput) {
    try {
      const productId = await this.transaction(async (tx) => {
        const code = input.code?.trim() || (await allocateDocumentNumberIn(tx, organizationId, "PRODUCT"));
        const product = await tx.product.create({
          data: {
            organizationId,
            code,
            name: input.name,
            description: input.description ?? null,
            productType: input.productType,
            status: input.status ?? "ACTIVE",
            categoryId: input.categoryId ?? null,
            unitOfMeasureId: input.unitOfMeasureId,
            taxCodeId: input.taxCodeId ?? null,
            trackInventory: input.productType === "SERVICE" ? false : (input.trackInventory ?? false),
            notes: input.notes ?? null,
            createdById: actorId,
            updatedById: actorId,
          },
          select: { id: true },
        });

        if (input.initialSalesPrice) {
          await tx.productPrice.create({
            data: priceData(organizationId, product.id, actorId, {
              ...input.initialSalesPrice,
              priceType: "SALES",
            }),
          });
        }

        return product.id;
      });
      return this.findById(organizationId, productId);
    } catch (error) {
      throw mapConflict(error, "A product with this code already exists");
    }
  }

  async update(organizationId: string, id: string, actorId: string, input: UpdateProductInput) {
    const existing = await this.findById(organizationId, id);
    if (!existing) {
      return null;
    }
    const nextType = input.productType ?? existing.productType;
    const trackInventory =
      nextType === "SERVICE" ? false : input.trackInventory !== undefined ? input.trackInventory : existing.trackInventory;

    try {
      await this.db.product.update({
        where: { id },
        data: {
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description ?? null } : {}),
          ...(input.productType !== undefined ? { productType: input.productType } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(input.unitOfMeasureId !== undefined ? { unitOfMeasureId: input.unitOfMeasureId } : {}),
          ...(input.taxCodeId !== undefined ? { taxCodeId: input.taxCodeId } : {}),
          trackInventory,
          ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
          updatedById: actorId,
        },
      });
      return this.findById(organizationId, id);
    } catch (error) {
      throw mapConflict(error, "A product with this code already exists");
    }
  }

  async softDelete(organizationId: string, id: string, actorId: string) {
    const result = await this.db.product.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
  }

  async restore(organizationId: string, id: string, actorId: string) {
    const result = await this.db.product.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null, updatedById: actorId },
    });
    return result.count === 1;
  }

  async listPrices(organizationId: string, productId: string) {
    return this.db.productPrice.findMany({
      where: { organizationId, productId, deletedAt: null },
      orderBy: [{ priceType: "asc" }, { effectiveDate: "desc" }],
      select: priceSelect,
    });
  }

  async findPrice(organizationId: string, id: string) {
    return this.db.productPrice.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: priceSelect,
    });
  }

  async listOverlappingPriceCandidates(
    organizationId: string,
    productId: string,
    priceType: "SALES" | "PURCHASE",
    priceListCode: string,
    currencyCode: string,
    exceptId?: string,
  ) {
    return this.db.productPrice.findMany({
      where: {
        organizationId,
        productId,
        priceType,
        priceListCode,
        currencyCode,
        deletedAt: null,
        isActive: true,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true, effectiveDate: true, expiryDate: true },
    });
  }

  async createPrice(organizationId: string, productId: string, actorId: string, input: ProductPriceInput) {
    return this.db.productPrice.create({
      data: priceData(organizationId, productId, actorId, input),
      select: priceSelect,
    });
  }

  async updatePrice(organizationId: string, id: string, actorId: string, input: ProductPriceInput) {
    const existing = await this.findPrice(organizationId, id);
    if (!existing) {
      return null;
    }
    return this.db.productPrice.update({
      where: { id },
      data: {
        priceType: input.priceType,
        priceListCode: input.priceListCode,
        currencyCode: input.currencyCode,
        amount: input.amount,
        effectiveDate: new Date(`${input.effectiveDate}T00:00:00.000Z`),
        expiryDate: input.expiryDate ? new Date(`${input.expiryDate}T00:00:00.000Z`) : null,
        isActive: input.isActive ?? true,
        updatedById: actorId,
      },
      select: priceSelect,
    });
  }

  async softDeletePrice(organizationId: string, id: string, actorId: string) {
    const existing = await this.findPrice(organizationId, id);
    if (!existing) {
      return null;
    }
    await this.db.productPrice.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return existing;
  }

  async createCategory(organizationId: string, actorId: string, input: CreateCategoryInput) {
    try {
      return await this.db.productCategory.create({
        data: {
          organizationId,
          code: input.code.trim().toUpperCase(),
          name: input.name,
          description: input.description ?? null,
          parentId: input.parentId ?? null,
          isActive: input.isActive ?? true,
          createdById: actorId,
          updatedById: actorId,
        },
        select: categorySelect,
      });
    } catch (error) {
      throw mapConflict(error, "A category with this code already exists");
    }
  }

  async updateCategory(organizationId: string, id: string, actorId: string, input: UpdateCategoryInput) {
    const existing = await this.findCategory(organizationId, id);
    if (!existing) {
      return null;
    }
    try {
      return await this.db.productCategory.update({
        where: { id },
        data: {
          ...(input.code !== undefined ? { code: input.code.trim().toUpperCase() } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description ?? null } : {}),
          ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          updatedById: actorId,
        },
        select: categorySelect,
      });
    } catch (error) {
      throw mapConflict(error, "A category with this code already exists");
    }
  }

  async softDeleteCategory(organizationId: string, id: string, actorId: string) {
    const existing = await this.findCategory(organizationId, id);
    if (!existing) {
      return null;
    }
    await this.db.productCategory.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return existing;
  }

  async categoryAncestorIds(organizationId: string, startId: string): Promise<string[]> {
    const ids: string[] = [];
    let currentId: string | null = startId;
    const seen = new Set<string>();
    while (currentId) {
      if (seen.has(currentId)) {
        break;
      }
      seen.add(currentId);
      ids.push(currentId);
      const row: { parentId: string | null } | null = await this.db.productCategory.findFirst({
        where: { id: currentId, organizationId, deletedAt: null },
        select: { parentId: true },
      });
      currentId = row?.parentId ?? null;
    }
    return ids;
  }

  mapPriceDates(row: { effectiveDate: Date; expiryDate: Date | null }) {
    return {
      effectiveDate: toDateOnly(row.effectiveDate),
      expiryDate: row.expiryDate ? toDateOnly(row.expiryDate) : null,
    };
  }
}

function priceData(organizationId: string, productId: string, actorId: string, input: ProductPriceInput) {
  return {
    organizationId,
    productId,
    priceType: input.priceType,
    priceListCode: input.priceListCode,
    currencyCode: input.currencyCode,
    amount: input.amount,
    effectiveDate: new Date(`${input.effectiveDate}T00:00:00.000Z`),
    expiryDate: input.expiryDate ? new Date(`${input.expiryDate}T00:00:00.000Z`) : null,
    isActive: input.isActive ?? true,
    createdById: actorId,
    updatedById: actorId,
  };
}

function mapConflict(error: unknown, message: string): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictError(message);
  }
  return error;
}

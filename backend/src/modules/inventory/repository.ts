import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { createdAtRange } from "../../common/pagination/list-query";
import { cursorFilter, decodeCursor, toCursorPage } from "../../common/pagination/cursor";
import type { StockUpdate } from "./valuation";
import type { DecimalLike } from "./valuation";
import type { StockQuery, MovementQuery } from "./validation";
import { DEFAULT_LOCATION, INVENTORY_MOVEMENT_TYPE_LABELS } from "./types";

interface ModelDelegate {
  findMany(args?: Record<string, unknown>): Promise<unknown[]>;
  findFirst(args?: Record<string, unknown>): Promise<unknown>;
  findUnique(args?: Record<string, unknown>): Promise<unknown>;
  create(args?: Record<string, unknown>): Promise<unknown>;
  update(args?: Record<string, unknown>): Promise<unknown>;
  updateMany(args?: Record<string, unknown>): Promise<{ count: number }>;
  upsert(args?: Record<string, unknown>): Promise<unknown>;
}

interface InventoryDb {
  inventoryBalance: ModelDelegate;
  inventoryMovement: ModelDelegate;
  product: ModelDelegate;
  productCategory: ModelDelegate;
  unitOfMeasure: ModelDelegate;
}

interface StockRow {
  productId: string;
  location: string;
  quantity: DecimalLike;
  averageCost: DecimalLike;
  updatedAt: Date;
  product?: {
    id: string;
    code: string;
    name: string;
    minimumStockQuantity: DecimalLike;
    category?: { id: string; name: string } | null;
    unitOfMeasure?: { code: string; name: string } | null;
  } | null;
}

interface MovementRow {
  id: string;
  createdAt: Date;
  productId: string;
  movementType: string;
  quantity: DecimalLike;
  unitCost: DecimalLike;
  location: string;
  referenceType: string;
  referenceId: string;
  balanceAfter: DecimalLike;
  createdById: string;
  product?: { id: string; code: string; name: string } | null;
}

export interface AdjustmentProduct {
  id: string;
  name: string;
  code: string;
  allowNegativeStock: boolean;
  weightedAveragePrice: DecimalLike;
  minimumStockQuantity: DecimalLike;
  receivingLocation: string | null;
}

export interface AdjustmentWriteData {
  productId: string;
  location: string;
  unitCost: string;
  movement: StockUpdate;
}

function db(client: PrismaClient | Record<string, unknown>): InventoryDb {
  return client as unknown as InventoryDb;
}

function decimal(value: DecimalLike): number {
  return Number(value.toString());
}

export class InventoryRepository extends BaseRepository {
  constructor(client: PrismaClient) {
    super(client);
  }

  async listStock(organizationId: string, query: StockQuery) {
    const decoded = query.cursor ? decodeCursor(query.cursor) : null;
    const range = createdAtRange(query.from, query.to);
    const stockFilters: Record<string, unknown>[] = [];
    if (range) {
      stockFilters.push({ updatedAt: range });
    }
    if (decoded) {
      stockFilters.push({
        updatedAt: query.order === "desc" ? { lt: new Date(decoded.createdAt) } : { gt: new Date(decoded.createdAt) },
      });
    }
    const rows = (await db(this.db).inventoryBalance.findMany({
      where: {
        organizationId,
        ...(query.productId ? { productId: query.productId } : {}),
        ...(stockFilters.length > 0 ? { AND: stockFilters } : {}),
      },
      orderBy: [{ updatedAt: query.order }, { productId: query.order }, { location: query.order }],
      take: query.lowStock ? 10000 : query.limit + 1,
      select: {
        productId: true,
        location: true,
        quantity: true,
        averageCost: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            minimumStockQuantity: true,
            category: { select: { id: true, name: true } },
            unitOfMeasure: { select: { code: true, name: true } },
          },
        },
      },
    })) as StockRow[];

    const filtered = query.lowStock
      ? rows.filter((row) => decimal(row.quantity) < decimal(row.product?.minimumStockQuantity ?? 0))
      : rows;
    const items = filtered.map((row) => ({
      ...row,
      id: `${row.productId}:${row.location}`,
      createdAt: row.updatedAt,
    }));
    return toCursorPage(items, query.limit);
  }

  async listMovements(organizationId: string, query: MovementQuery) {
    const decoded = query.cursor ? decodeCursor(query.cursor) : null;
    const range = createdAtRange(query.from, query.to);
    const rows = (await db(this.db).inventoryMovement.findMany({
      where: {
        organizationId,
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.type ? { movementType: query.type } : {}),
        ...(range ? { createdAt: range } : {}),
        ...(decoded ? { OR: cursorFilter(decoded, query.order) } : {}),
      },
      orderBy: [{ createdAt: query.order }, { id: query.order }],
      take: query.limit + 1,
      select: {
        id: true,
        createdAt: true,
        productId: true,
        movementType: true,
        quantity: true,
        unitCost: true,
        location: true,
        referenceType: true,
        referenceId: true,
        balanceAfter: true,
        createdById: true,
        product: { select: { id: true, code: true, name: true } },
      },
    })) as MovementRow[];
    return toCursorPage(rows, query.limit);
  }

  async findBalance(organizationId: string, productId: string, location: string) {
    const row = (await db(this.db).inventoryBalance.findFirst({
      where: { organizationId, productId, location },
      select: { quantity: true, averageCost: true },
    })) as { quantity: DecimalLike; averageCost: DecimalLike } | null;
    return row;
  }

  async findProduct(organizationId: string, productId: string) {
    return (await db(this.db).product.findFirst({
      where: { id: productId, organizationId, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        allowNegativeStock: true,
        weightedAveragePrice: true,
        minimumStockQuantity: true,
        receivingLocation: true,
      },
    })) as AdjustmentProduct | null;
  }

  async formOptions(organizationId: string) {
    const [products, balances] = await Promise.all([
      db(this.db).product.findMany({
        where: { organizationId, deletedAt: null, status: "ACTIVE" },
        orderBy: { name: "asc" },
        take: 500,
        select: {
          id: true,
          code: true,
          name: true,
          receivingLocation: true,
          minimumStockQuantity: true,
          trackInventory: true,
          category: { select: { id: true, name: true } },
          unitOfMeasure: { select: { code: true, name: true } },
        },
      }),
      db(this.db).inventoryBalance.findMany({
        where: { organizationId },
        distinct: ["location"],
        orderBy: { location: "asc" },
        select: { location: true },
      }),
    ]) as [
      Array<{
        id: string;
        code: string;
        name: string;
        receivingLocation: string;
        minimumStockQuantity: DecimalLike;
        trackInventory: boolean;
        category: { id: string; name: string } | null;
        unitOfMeasure: { code: string; name: string } | null;
      }>,
      Array<{ location: string }>,
    ];

    const locations = [
      ...new Set([DEFAULT_LOCATION, ...balances.map((balance) => balance.location), ...products.map((product) => product.receivingLocation)]),
    ].sort();

    return {
      locations: locations.map((location) => ({ value: location, label: location })),
      products: products.map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        location: product.receivingLocation || DEFAULT_LOCATION,
        minimumStockQuantity: product.minimumStockQuantity.toString(),
        trackInventory: product.trackInventory,
        category: product.category,
        unitOfMeasure: product.unitOfMeasure,
      })),
      movementTypes: Object.entries(INVENTORY_MOVEMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    };
  }

  async createAdjustment(organizationId: string, actorId: string, input: AdjustmentWriteData) {
    return this.transaction(async (tx) => {
      const client = db(tx as unknown as Record<string, unknown>);
      const referenceId = randomUUID();
      const now = new Date();
      await client.inventoryMovement.create({
        data: {
          organizationId,
          productId: input.productId,
          movementType: "ADJUSTMENT",
          quantity: input.movement.quantity,
          unitCost: input.unitCost,
          location: input.location,
          referenceType: "ADJUSTMENT",
          referenceId,
          balanceAfter: input.movement.balanceAfter,
          createdById: actorId,
        },
      });
      await client.inventoryBalance.upsert({
        where: {
          organizationId_productId_location: {
            organizationId,
            productId: input.productId,
            location: input.location,
          },
        },
        create: {
          organizationId,
          productId: input.productId,
          location: input.location,
          quantity: input.movement.quantity,
          averageCost: input.movement.averageCost,
          updatedAt: now,
        },
        update: {
          quantity: input.movement.quantity,
          averageCost: input.movement.averageCost,
          updatedAt: now,
        },
      });
      return { id: referenceId, balanceAfter: input.movement.balanceAfter };
    });
  }
}

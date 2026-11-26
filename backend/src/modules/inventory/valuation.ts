import { Prisma } from "@prisma/client";
import { ValidationFailedError } from "../../common/errors/app-error";

export type DecimalLike = string | number | { toString(): string };

export interface StockSnapshot {
  quantity: DecimalLike;
  averageCost: DecimalLike;
}

export interface StockUpdate {
  quantity: string;
  averageCost: string;
  balanceAfter: string;
}

function decimal(value: DecimalLike): Prisma.Decimal {
  return new Prisma.Decimal(value.toString());
}

function scale(value: Prisma.Decimal): string {
  return value.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP).toFixed(4);
}

export function applyInventoryMovement(
  stock: StockSnapshot | null,
  movementQuantity: DecimalLike,
  unitCost: DecimalLike,
  allowNegativeStock = false,
): StockUpdate {
  const delta = decimal(movementQuantity);
  const cost = decimal(unitCost);
  const currentQuantity = stock ? decimal(stock.quantity) : new Prisma.Decimal(0);
  const currentAverageCost = stock ? decimal(stock.averageCost) : new Prisma.Decimal(0);
  const nextQuantity = currentQuantity.add(delta);

  if (nextQuantity.isNegative() && !allowNegativeStock) {
    throw new ValidationFailedError({
      quantity: ["The adjustment cannot make the stock balance negative"],
    });
  }

  let nextAverageCost = currentAverageCost;
  if (nextQuantity.eq(0)) {
    nextAverageCost = new Prisma.Decimal(0);
  } else if (delta.gt(0)) {
    const value = currentQuantity.mul(currentAverageCost).add(delta.mul(cost));
    nextAverageCost = value.div(nextQuantity);
  } else if (currentQuantity.lte(0)) {
    nextAverageCost = cost;
  }

  return {
    quantity: scale(nextQuantity),
    averageCost: scale(nextAverageCost),
    balanceAfter: scale(nextQuantity),
  };
}

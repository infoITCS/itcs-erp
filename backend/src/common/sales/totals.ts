import { Prisma } from "@prisma/client";

export const MONEY_SCALE = 4;

export interface LineMoneyInput {
  quantity: string;
  unitPrice: string;
  discountPercent?: string;
  taxRate?: string;
}

export interface LineMoney {
  lineSubtotal: string;
  lineDiscount: string;
  lineTax: string;
  lineTotal: string;
}

export interface DocumentMoney {
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
}

function round(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
}

export function computeLineMoney(input: LineMoneyInput): LineMoney {
  const quantity = new Prisma.Decimal(input.quantity);
  const unitPrice = new Prisma.Decimal(input.unitPrice);
  const discountPercent = new Prisma.Decimal(input.discountPercent ?? "0");
  const taxRate = new Prisma.Decimal(input.taxRate ?? "0");

  const lineSubtotal = round(quantity.mul(unitPrice));
  const lineDiscount = round(lineSubtotal.mul(discountPercent).div(100));
  const net = lineSubtotal.sub(lineDiscount);
  const lineTax = round(net.mul(taxRate).div(100));
  const lineTotal = round(net.add(lineTax));

  return {
    lineSubtotal: lineSubtotal.toFixed(MONEY_SCALE),
    lineDiscount: lineDiscount.toFixed(MONEY_SCALE),
    lineTax: lineTax.toFixed(MONEY_SCALE),
    lineTotal: lineTotal.toFixed(MONEY_SCALE),
  };
}

export function computeDocumentMoney(
  lines: Array<{
    lineSubtotal: { toString(): string };
    lineDiscount: { toString(): string };
    lineTax: { toString(): string };
  }>,
): DocumentMoney {
  const subtotal = lines.reduce(
    (sum, line) => sum.add(new Prisma.Decimal(line.lineSubtotal.toString())),
    new Prisma.Decimal(0),
  );
  const discountTotal = lines.reduce(
    (sum, line) => sum.add(new Prisma.Decimal(line.lineDiscount.toString())),
    new Prisma.Decimal(0),
  );
  const taxTotal = lines.reduce(
    (sum, line) => sum.add(new Prisma.Decimal(line.lineTax.toString())),
    new Prisma.Decimal(0),
  );
  const total = subtotal.sub(discountTotal).add(taxTotal);

  return {
    subtotal: subtotal.toFixed(MONEY_SCALE),
    discountTotal: discountTotal.toFixed(MONEY_SCALE),
    taxTotal: taxTotal.toFixed(MONEY_SCALE),
    total: total.toFixed(MONEY_SCALE),
  };
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

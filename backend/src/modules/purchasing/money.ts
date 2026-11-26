import { Prisma } from "@prisma/client";
import { ValidationFailedError } from "../../common/errors/app-error";
import type { PurchaseOrderStatusValue, VendorBillStatusValue } from "./types";

export type DecimalInput = string | number | { toString(): string };

function decimal(value: DecimalInput): Prisma.Decimal {
  return new Prisma.Decimal(value.toString());
}

export function applyVendorBillPaymentDelta(
  bill: { status: VendorBillStatusValue; total: DecimalInput; amountPaid: DecimalInput },
  delta: DecimalInput,
): { amountPaid: string; status: VendorBillStatusValue } {
  if (bill.status !== "APPROVED" && bill.status !== "PARTIALLY_PAID") {
    throw new ValidationFailedError({
      billId: ["Only an approved vendor bill can receive a payment"],
    });
  }

  const paid = decimal(bill.amountPaid).add(decimal(delta));
  const total = decimal(bill.total);
  if (paid.isNegative() || paid.gt(total)) {
    throw new ValidationFailedError({
      amount: ["The payment would exceed the outstanding bill balance"],
    });
  }

  return {
    amountPaid: paid.toFixed(4),
    status: paid.eq(total) ? "PAID" : paid.gt(0) ? "PARTIALLY_PAID" : "APPROVED",
  };
}

export function purchaseOrderStatusAfterReceipt(
  lines: Array<{ quantity: DecimalInput; receivedQuantity: DecimalInput }>,
): PurchaseOrderStatusValue {
  const fullyReceived = lines.every((line) => decimal(line.receivedQuantity).gte(decimal(line.quantity)));
  return fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
}

export function sumAmounts(values: DecimalInput[]): string {
  return values
    .reduce<Prisma.Decimal>((sum, value) => sum.add(decimal(value)), new Prisma.Decimal(0))
    .toFixed(4);
}

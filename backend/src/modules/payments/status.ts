import { Prisma } from "@prisma/client";

export type InvoicePaymentStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";

export interface PaymentDeltaInput {
  currentStatus: InvoicePaymentStatus;
  total: Prisma.Decimal | string;
  amountPaid: Prisma.Decimal | string;
  delta: Prisma.Decimal | string;
  dueDate: Date | null;
  asOf: Date;
}

export interface PaymentDeltaResult {
  amountPaid: string;
  status: InvoicePaymentStatus;
}

export function applyPaymentDelta(input: PaymentDeltaInput): PaymentDeltaResult {
  let paid = new Prisma.Decimal(input.amountPaid).add(input.delta);
  if (paid.isNegative()) {
    paid = new Prisma.Decimal(0);
  }

  const total = new Prisma.Decimal(input.total);
  const overdue = input.dueDate !== null && input.dueDate < dateOnly(input.asOf);
  let status = input.currentStatus;

  if (paid.gte(total)) {
    status = "PAID";
  } else if (paid.gt(0)) {
    status = overdue ? "OVERDUE" : "PARTIALLY_PAID";
  } else if (status === "PAID" || status === "PARTIALLY_PAID" || status === "OVERDUE") {
    status = overdue ? "OVERDUE" : "SENT";
  }

  return { amountPaid: paid.toFixed(4), status };
}

function dateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

import type { Prisma } from "@prisma/client";
import type { PaymentMethodValue } from "./types";

export interface PaymentListFilter {
  organizationId: string;
  q?: string;
  method?: PaymentMethodValue;
  invoiceId?: string;
  customerId?: string;
  from?: string;
  to?: string;
}

export function buildPaymentListWhere(filter: PaymentListFilter): Prisma.PaymentWhereInput {
  const search = filter.q?.trim();

  return {
    organizationId: filter.organizationId,
    deletedAt: null,
    ...(filter.method ? { method: filter.method } : {}),
    ...(filter.invoiceId ? { invoiceId: filter.invoiceId } : {}),
    ...(filter.customerId ? { customerId: filter.customerId } : {}),
    ...(filter.from || filter.to
      ? {
          receivedDate: {
            ...(filter.from ? { gte: dateOnly(filter.from) } : {}),
            ...(filter.to ? { lte: dateOnly(filter.to) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { paymentNumber: { contains: search, mode: "insensitive" as const } },
            { reference: { contains: search, mode: "insensitive" as const } },
            { invoice: { invoiceNumber: { contains: search, mode: "insensitive" as const } } },
            { customer: { displayName: { contains: search, mode: "insensitive" as const } } },
            { customer: { customerNumber: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

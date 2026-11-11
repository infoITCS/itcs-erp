import type { Prisma } from "@prisma/client";
import type { InvoiceStatusValue } from "./types";

export interface InvoiceListFilter {
  organizationId: string;
  q?: string;
  status?: InvoiceStatusValue;
  customerId?: string;
  ownerUserId?: string;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
}

export function buildInvoiceListWhere(filter: InvoiceListFilter): Prisma.InvoiceWhereInput {
  const search = filter.q?.trim();

  return {
    organizationId: filter.organizationId,
    ...(filter.includeDeleted ? {} : { deletedAt: null }),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.customerId ? { customerId: filter.customerId } : {}),
    ...(filter.ownerUserId ? { ownerUserId: filter.ownerUserId } : {}),
    ...(filter.from || filter.to
      ? {
          issueDate: {
            ...(filter.from ? { gte: dateOnly(filter.from) } : {}),
            ...(filter.to ? { lte: dateOnly(filter.to) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: "insensitive" as const } },
            { customerReference: { contains: search, mode: "insensitive" as const } },
            { customer: { displayName: { contains: search, mode: "insensitive" as const } } },
            { customer: { customerNumber: { contains: search, mode: "insensitive" as const } } },
            { sourceSalesOrder: { salesOrderNumber: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

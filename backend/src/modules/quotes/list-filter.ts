import type { Prisma } from "@prisma/client";
import { createdAtRange } from "../../common/pagination/list-query";
import type { QuoteStatusValue } from "./types";

export interface QuoteListFilter {
  organizationId: string;
  q?: string;
  status?: QuoteStatusValue;
  customerId?: string;
  ownerUserId?: string;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
}

export function buildQuoteListWhere(filter: QuoteListFilter): Prisma.QuoteWhereInput {
  const search = filter.q?.trim();
  const createdAt = createdAtRange(filter.from, filter.to);

  return {
    organizationId: filter.organizationId,
    ...(filter.includeDeleted ? {} : { deletedAt: null }),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.customerId ? { customerId: filter.customerId } : {}),
    ...(filter.ownerUserId ? { ownerUserId: filter.ownerUserId } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search
      ? {
          OR: [
            { quoteNumber: { contains: search, mode: "insensitive" as const } },
            { customerReference: { contains: search, mode: "insensitive" as const } },
            { customer: { displayName: { contains: search, mode: "insensitive" as const } } },
            { customer: { customerNumber: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}

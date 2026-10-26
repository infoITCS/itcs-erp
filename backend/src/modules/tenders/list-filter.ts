import type { Prisma } from "@prisma/client";
import { createdAtRange } from "../../common/pagination/list-query";
import type { TenderStatusValue } from "./types";

export interface TenderListFilter {
  organizationId: string;
  q?: string;
  status?: TenderStatusValue;
  customerId?: string;
  ownerUserId?: string;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
}

export function buildTenderListWhere(filter: TenderListFilter): Prisma.TenderWhereInput {
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
            { title: { contains: search, mode: "insensitive" } },
            { tenderNumber: { contains: search, mode: "insensitive" } },
            { referenceNumber: { contains: search, mode: "insensitive" } },
            { customer: { is: { displayName: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
}

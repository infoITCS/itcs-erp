import type { Prisma } from "@prisma/client";
import { createdAtRange } from "../../common/pagination/list-query";
import type { LeadPriorityValue, LeadSourceValue, LeadStatusValue } from "./types";

export interface LeadListFilter {
  organizationId: string;
  q?: string;
  status?: LeadStatusValue;
  source?: LeadSourceValue;
  ownerUserId?: string;
  priority?: LeadPriorityValue;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
}

export function buildLeadListWhere(filter: LeadListFilter): Prisma.LeadWhereInput {
  const search = filter.q?.trim();
  const createdAt = createdAtRange(filter.from, filter.to);

  return {
    organizationId: filter.organizationId,
    ...(filter.includeDeleted ? {} : { deletedAt: null }),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.source ? { source: filter.source } : {}),
    ...(filter.ownerUserId ? { ownerUserId: filter.ownerUserId } : {}),
    ...(filter.priority ? { priority: filter.priority } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search
      ? {
          OR: [
            { leadNumber: { contains: search, mode: "insensitive" } },
            { displayName: { contains: search, mode: "insensitive" } },
            { companyName: { contains: search, mode: "insensitive" } },
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

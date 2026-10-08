import type { Prisma } from "@prisma/client";
import { createdAtRange } from "../../common/pagination/list-query";

export interface ResellerListFilter {
  organizationId: string;
  q?: string;
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  country?: string;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
}

export function buildResellerListWhere(filter: ResellerListFilter): Prisma.ResellerWhereInput {
  const search = filter.q?.trim();
  const createdAt = createdAtRange(filter.from, filter.to);

  return {
    organizationId: filter.organizationId,
    ...(filter.includeDeleted ? {} : { deletedAt: null }),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.country ? { countryCode: filter.country.toUpperCase() } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search
      ? {
          OR: [
            { resellerNumber: { contains: search, mode: "insensitive" } },
            { legalName: { contains: search, mode: "insensitive" } },
            { displayName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

import type { Prisma } from "@prisma/client";
import { createdAtRange } from "../../common/pagination/list-query";

export interface CustomerListFilter {
  organizationId: string;
  q?: string;
  status?: "ACTIVE" | "INACTIVE" | "HOLD";
  customerType?: "COMPANY" | "INDIVIDUAL" | "B2B" | "B2C" | "WHOLESALE";
  country?: string;
  currency?: string;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
}

export function buildCustomerListWhere(filter: CustomerListFilter): Prisma.CustomerWhereInput {
  const search = filter.q?.trim();
  const createdAt = createdAtRange(filter.from, filter.to);

  return {
    organizationId: filter.organizationId,
    ...(filter.includeDeleted ? {} : { deletedAt: null }),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.customerType ? { customerType: filter.customerType } : {}),
    ...(filter.country ? { countryCode: filter.country.toUpperCase() } : {}),
    ...(filter.currency ? { currencyCode: filter.currency.toUpperCase() } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search
      ? {
          OR: [
            { customerNumber: { contains: search, mode: "insensitive" } },
            { legalName: { contains: search, mode: "insensitive" } },
            { displayName: { contains: search, mode: "insensitive" } },
            { taxNumber: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

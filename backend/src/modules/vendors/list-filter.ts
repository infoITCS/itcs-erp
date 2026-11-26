import type { Prisma } from "@prisma/client";
import { createdAtRange } from "../../common/pagination/list-query";
import type { VendorStatus } from "./types";

export interface VendorListFilter {
  organizationId: string;
  q?: string;
  status?: VendorStatus;
  currencyCode?: string;
  paymentTermId?: string;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
}

export function buildVendorListWhere(filter: VendorListFilter): Prisma.VendorWhereInput {
  const search = filter.q?.trim();
  const createdAt = createdAtRange(filter.from, filter.to);

  return {
    organizationId: filter.organizationId,
    ...(filter.includeDeleted ? {} : { deletedAt: null }),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.currencyCode ? { currencyCode: filter.currencyCode.toUpperCase() } : {}),
    ...(filter.paymentTermId ? { paymentTermId: filter.paymentTermId } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search
      ? {
          OR: [
            { vendorNumber: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { legalName: { contains: search, mode: "insensitive" } },
            { displayName: { contains: search, mode: "insensitive" } },
            { taxId: { contains: search, mode: "insensitive" } },
            { registrationNumber: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

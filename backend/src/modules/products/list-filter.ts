import type { Prisma } from "@prisma/client";
import { createdAtRange } from "../../common/pagination/list-query";

export interface ProductListFilter {
  organizationId: string;
  q?: string;
  status?: "ACTIVE" | "INACTIVE";
  productType?: "PHYSICAL_PRODUCT" | "SERVICE";
  categoryId?: string;
  trackInventory?: boolean;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
}

export function buildProductListWhere(filter: ProductListFilter): Prisma.ProductWhereInput {
  const search = filter.q?.trim();
  const createdAt = createdAtRange(filter.from, filter.to);

  return {
    organizationId: filter.organizationId,
    ...(filter.includeDeleted ? {} : { deletedAt: null }),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.productType ? { productType: filter.productType } : {}),
    ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
    ...(filter.trackInventory === undefined ? {} : { trackInventory: filter.trackInventory }),
    ...(createdAt ? { createdAt } : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

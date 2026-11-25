import { Prisma, type ProjectStatus } from "@prisma/client";
import { createdAtRange } from "../../common/pagination/list-query";
import type { ProjectStatusValue } from "./types";

export interface ProjectListFilter {
  organizationId: string;
  q?: string;
  status?: ProjectStatusValue;
  customerId?: string;
  ownerUserId?: string;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
}

export function buildProjectListWhere(filter: ProjectListFilter): Prisma.ProjectWhereInput {
  const search = filter.q?.trim();
  const createdAt = createdAtRange(filter.from, filter.to);

  return {
    organizationId: filter.organizationId,
    ...(filter.includeDeleted ? {} : { deletedAt: null }),
    ...(filter.status ? { status: filter.status as ProjectStatus } : {}),
    ...(filter.customerId ? { customerId: filter.customerId } : {}),
    ...(filter.ownerUserId ? { ownerUserId: filter.ownerUserId } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { projectNumber: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { customerContactName: { contains: search, mode: "insensitive" } },
            { supplierCompany: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

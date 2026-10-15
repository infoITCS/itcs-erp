import type { Prisma } from "@prisma/client";
import { createdAtRange } from "../../common/pagination/list-query";
import type { OpportunityLeadSourceValue, OpportunityStageValue } from "./types";

export interface OpportunityListFilter {
  organizationId: string;
  q?: string;
  stage?: OpportunityStageValue;
  customerId?: string;
  resellerId?: string;
  ownerUserId?: string;
  leadSource?: OpportunityLeadSourceValue;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
}

export function buildOpportunityListWhere(filter: OpportunityListFilter): Prisma.OpportunityWhereInput {
  const search = filter.q?.trim();
  const createdAt = createdAtRange(filter.from, filter.to);

  return {
    organizationId: filter.organizationId,
    ...(filter.includeDeleted ? {} : { deletedAt: null }),
    ...(filter.stage ? { stage: filter.stage } : {}),
    ...(filter.customerId ? { customerId: filter.customerId } : {}),
    ...(filter.resellerId ? { resellerId: filter.resellerId } : {}),
    ...(filter.ownerUserId ? { ownerUserId: filter.ownerUserId } : {}),
    ...(filter.leadSource ? { leadSource: filter.leadSource } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { opportunityNumber: { contains: search, mode: "insensitive" } },
            { prospectDisplayName: { contains: search, mode: "insensitive" } },
            { prospectEmail: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

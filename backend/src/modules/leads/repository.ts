import { Prisma, type CustomerLeadSource, type CustomerPriority, type LeadStatus, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { ConflictError } from "../../common/errors/app-error";
import { allocateDocumentNumberIn } from "../../common/numbering/allocate";
import { buildLeadListWhere, type LeadListFilter } from "./list-filter";
import { decodeLeadCursor, leadCursorWhere, type LeadSort } from "./page";

const leadSelect = {
  id: true,
  organizationId: true,
  leadNumber: true,
  firstName: true,
  lastName: true,
  displayName: true,
  companyName: true,
  jobTitle: true,
  email: true,
  phone: true,
  website: true,
  countryCode: true,
  currencyCode: true,
  source: true,
  status: true,
  priority: true,
  estimatedValue: true,
  ownerUserId: true,
  nextAction: true,
  nextActionDueAt: true,
  description: true,
  notes: true,
  qualifiedAt: true,
  unqualifiedAt: true,
  unqualifiedReason: true,
  convertedAt: true,
  wonAt: true,
  convertedCustomerId: true,
  convertedContactId: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, firstName: true, lastName: true, email: true } },
  convertedCustomer: { select: { id: true, customerNumber: true, displayName: true, status: true } },
  convertedContact: { select: { id: true, displayName: true, email: true } },
  opportunity: {
    select: {
      id: true,
      opportunityNumber: true,
      title: true,
      stage: true,
      estimatedValue: true,
      currencyCode: true,
      wonAt: true,
      lostAt: true,
      closedAt: true,
    },
  },
} satisfies Prisma.LeadSelect;

export class LeadsRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(filter: LeadListFilter, limit: number, sort: LeadSort, order: "asc" | "desc", cursor?: string) {
    const decoded = cursor ? decodeLeadCursor(cursor) : null;
    const where = buildLeadListWhere(filter);
    return this.db.lead.findMany({
      where: decoded && decoded.sort === sort ? { AND: [where, leadCursorWhere(decoded, order)] } : where,
      orderBy: [{ [sort]: order }, { id: order }],
      take: limit + 1,
      select: leadSelect,
    });
  }

  async findById(organizationId: string, id: string, includeDeleted = false) {
    return this.db.lead.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: leadSelect,
    });
  }

  async findOrganization(organizationId: string) {
    return this.db.organization.findUnique({
      where: { id: organizationId },
      select: { baseCurrencyCode: true },
    });
  }

  async currencyIsActive(code: string): Promise<boolean> {
    const currency = await this.db.currency.findUnique({ where: { code }, select: { isActive: true } });
    return currency?.isActive === true;
  }

  async findExchangeRateValue(
    organizationId: string,
    baseCurrencyCode: string,
    quoteCurrencyCode: string,
    asOf: Date = utcDateOnly(new Date()),
  ): Promise<string | null> {
    const row = await this.db.exchangeRate.findFirst({
      where: { organizationId, baseCurrencyCode, quoteCurrencyCode, isActive: true, effectiveDate: { lte: asOf } },
      orderBy: { effectiveDate: "desc" },
      select: { rate: true },
    });
    return row ? row.rate.toString() : null;
  }

  async listOwnerOptions(organizationId: string) {
    return this.db.user.findMany({
      where: { status: "ACTIVE", memberships: { some: { organizationId, status: "ACTIVE" } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
    });
  }

  async findActiveOrgUser(organizationId: string, userId: string) {
    return this.db.user.findFirst({
      where: { id: userId, status: "ACTIVE", memberships: { some: { organizationId, status: "ACTIVE" } } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
  }

  async create(organizationId: string, actorId: string, input: LeadCreateData) {
    const id = await this.transaction(async (tx) => {
      const leadNumber = await allocateDocumentNumberIn(tx, organizationId, "LEAD");
      const created = await tx.lead.create({
        data: {
          organizationId,
          leadNumber,
          firstName: input.firstName,
          lastName: input.lastName,
          displayName: input.displayName,
          companyName: input.companyName ?? null,
          jobTitle: input.jobTitle ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          website: input.website ?? null,
          countryCode: input.countryCode,
          currencyCode: input.currencyCode,
          source: input.source as CustomerLeadSource,
          status: "NEW",
          priority: (input.priority as CustomerPriority | undefined) ?? "NORMAL",
          estimatedValue: input.estimatedValue ?? "0",
          ownerUserId: input.ownerUserId,
          nextAction: input.nextAction ?? null,
          nextActionDueAt: input.nextActionDueAt ? new Date(input.nextActionDueAt) : null,
          description: input.description ?? null,
          notes: input.notes ?? null,
          createdById: actorId,
          updatedById: actorId,
        },
        select: { id: true },
      });
      return created.id;
    });
    return this.findById(organizationId, id);
  }

  async update(organizationId: string, id: string, actorId: string, input: LeadUpdateData) {
    const existing = await this.findById(organizationId, id);
    if (!existing) {
      return null;
    }
    await this.db.lead.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.companyName !== undefined ? { companyName: input.companyName ?? null } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle ?? null } : {}),
        ...(input.email !== undefined ? { email: input.email ?? null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
        ...(input.website !== undefined ? { website: input.website ?? null } : {}),
        ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
        ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
        ...(input.source !== undefined ? { source: input.source as CustomerLeadSource } : {}),
        ...(input.priority !== undefined ? { priority: input.priority as CustomerPriority } : {}),
        ...(input.estimatedValue !== undefined ? { estimatedValue: input.estimatedValue } : {}),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.nextAction !== undefined ? { nextAction: input.nextAction ?? null } : {}),
        ...(input.nextActionDueAt !== undefined
          ? { nextActionDueAt: input.nextActionDueAt ? new Date(input.nextActionDueAt) : null }
          : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        updatedById: actorId,
      },
    });
    return this.findById(organizationId, id);
  }

  async softDelete(organizationId: string, id: string, actorId: string) {
    const result = await this.db.lead.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
  }

  async restore(organizationId: string, id: string, actorId: string) {
    const result = await this.db.lead.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null, updatedById: actorId },
    });
    return result.count === 1;
  }

  async changeStatus(
    organizationId: string,
    id: string,
    actorId: string,
    data: {
      status: LeadStatus;
      unqualifiedReason?: string;
      nextAction?: string;
      nextActionDueAt?: string;
    },
  ) {
    const now = new Date();
    const result = await this.db.lead.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: {
        status: data.status,
        ...(data.status === "QUALIFIED" ? { qualifiedAt: now, unqualifiedAt: null, unqualifiedReason: null } : {}),
        ...(data.status === "UNQUALIFIED"
          ? { unqualifiedAt: now, unqualifiedReason: data.unqualifiedReason ?? null }
          : {}),
        ...(data.nextAction !== undefined ? { nextAction: data.nextAction } : {}),
        ...(data.nextActionDueAt !== undefined ? { nextActionDueAt: new Date(data.nextActionDueAt) } : {}),
        updatedById: actorId,
      },
    });
    return result.count === 1 ? this.findById(organizationId, id) : null;
  }

  /**
   * Runs the customer creation (optional), opportunity creation, and lead update
   * on one transaction. The caller supplies the write operations so this module
   * does not depend on the customers or opportunities services directly.
   */
  async convert(
    organizationId: string,
    leadId: string,
    actorId: string,
    input: {
      createCustomer?: (tx: Prisma.TransactionClient) => Promise<{
        id: string;
        contacts?: Array<{ id: string; isPrimary: boolean }>;
      }>;
      createOpportunity: (
        tx: Prisma.TransactionClient,
        link: { customerId?: string; contactId?: string },
      ) => Promise<string>;
    },
  ) {
    try {
      return await this.transaction(async (tx) => {
        const customer = input.createCustomer ? await input.createCustomer(tx) : undefined;
        const contactId =
          customer?.contacts?.find((contact) => contact.isPrimary)?.id ?? customer?.contacts?.[0]?.id;
        const opportunityId = await input.createOpportunity(tx, {
          customerId: customer?.id,
          contactId,
        });
        const updated = await tx.lead.updateMany({
          where: { id: leadId, organizationId, deletedAt: null, status: "QUALIFIED" },
          data: {
            status: "CONVERTED",
            convertedAt: new Date(),
            convertedCustomerId: customer?.id ?? null,
            convertedContactId: contactId ?? null,
            updatedById: actorId,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictError("Lead was already converted, deleted, or is no longer qualified");
        }
        return {
          customerId: customer?.id ?? null,
          contactId: contactId ?? null,
          opportunityId,
        };
      });
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("A customer with this email already exists or this lead is already converted");
      }
      throw error;
    }
  }

  async statusCounts(organizationId: string, from?: Date) {
    return this.db.lead.groupBy({
      by: ["status"],
      where: { organizationId, deletedAt: null, ...(from ? { createdAt: { gte: from } } : {}) },
      _count: { _all: true },
      _sum: { estimatedValue: true },
    });
  }

  async sourceStatusCounts(organizationId: string, from?: Date) {
    return this.db.lead.groupBy({
      by: ["source", "status"],
      where: { organizationId, deletedAt: null, ...(from ? { createdAt: { gte: from } } : {}) },
      _count: { _all: true },
      _sum: { estimatedValue: true },
    });
  }

  async opportunitySourceStageCounts(organizationId: string, from?: Date) {
    return this.db.opportunity.groupBy({
      by: ["leadSource", "stage"],
      where: {
        organizationId,
        deletedAt: null,
        leadSource: { not: null },
        ...(from ? { createdAt: { gte: from } } : {}),
      },
      _count: { _all: true },
      _sum: { estimatedValueBase: true },
    });
  }
}

export interface LeadCreateData {
  firstName: string;
  lastName: string;
  displayName: string;
  companyName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  countryCode: string;
  currencyCode: string;
  source: string;
  priority?: string;
  estimatedValue?: string;
  ownerUserId: string;
  nextAction?: string;
  nextActionDueAt?: string;
  description?: string;
  notes?: string;
}

export interface LeadUpdateData {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  companyName?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  countryCode?: string;
  currencyCode?: string;
  source?: string;
  priority?: string;
  estimatedValue?: string;
  ownerUserId?: string;
  nextAction?: string | null;
  nextActionDueAt?: string | null;
  description?: string | null;
  notes?: string | null;
}

function utcDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

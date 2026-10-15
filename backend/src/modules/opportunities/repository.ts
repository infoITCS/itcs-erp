import { Prisma, type CustomerLeadSource, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { ConflictError } from "../../common/errors/app-error";
import { allocateDocumentNumberIn } from "../../common/numbering/allocate";
import { buildOpportunityListWhere, type OpportunityListFilter } from "./list-filter";
import { decodeOpportunityCursor, opportunityCursorWhere, type OpportunitySort } from "./page";
import type {
  CreateProductInterestInput,
  UpdateProductInterestInput,
} from "./validation";

const opportunitySelect = {
  id: true,
  organizationId: true,
  opportunityNumber: true,
  title: true,
  description: true,
  stage: true,
  customerId: true,
  contactId: true,
  resellerId: true,
  ownerUserId: true,
  leadSource: true,
  estimatedValue: true,
  currencyCode: true,
  exchangeRateToBase: true,
  estimatedValueBase: true,
  baseCurrencyCode: true,
  probabilityPercent: true,
  expectedCloseDate: true,
  nextAction: true,
  nextActionDueAt: true,
  lostReason: true,
  lostReasonDetail: true,
  competitorName: true,
  wonAt: true,
  lostAt: true,
  closedAt: true,
  reopenedAt: true,
  prospectDisplayName: true,
  prospectLegalName: true,
  prospectEmail: true,
  prospectPhone: true,
  prospectCountryCode: true,
  notes: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, customerNumber: true, displayName: true, status: true, email: true } },
  contact: { select: { id: true, displayName: true, email: true } },
  reseller: { select: { id: true, displayName: true } },
  owner: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.OpportunitySelect;

const interestSelect = {
  id: true,
  organizationId: true,
  opportunityId: true,
  productId: true,
  quantity: true,
  estimatedUnitAmount: true,
  productCode: true,
  productName: true,
  notes: true,
  sortOrder: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OpportunityProductInterestSelect;

export class OpportunitiesRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(
    filter: OpportunityListFilter,
    limit: number,
    sort: OpportunitySort,
    order: "asc" | "desc",
    cursor?: string,
  ) {
    const decoded = cursor ? decodeOpportunityCursor(cursor) : null;
    const where = buildOpportunityListWhere(filter);
    return this.db.opportunity.findMany({
      where: decoded && decoded.sort === sort ? { AND: [where, opportunityCursorWhere(decoded, order)] } : where,
      orderBy: [{ [sort]: order }, { id: order }],
      take: limit + 1,
      select: opportunitySelect,
    });
  }

  async findById(organizationId: string, id: string, includeDeleted = false) {
    return this.db.opportunity.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: opportunitySelect,
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

  /**
   * Latest active rate on or before the UTC calendar day of `asOf`.
   * `rate` is quote-currency units per 1 unit of the base currency, matching ExchangeRate.
   * This is only for writing a new snapshot. Reads return the stored snapshot and do not call this.
   */
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

  async listResellerOptions(organizationId: string) {
    return this.db.reseller.findMany({
      where: { organizationId, deletedAt: null, status: "ACTIVE" },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    });
  }

  async findActiveOrgUser(organizationId: string, userId: string) {
    return this.db.user.findFirst({
      where: { id: userId, status: "ACTIVE", memberships: { some: { organizationId, status: "ACTIVE" } } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
  }

  async findCustomerForLink(organizationId: string, customerId: string) {
    return this.db.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { id: true, status: true, displayName: true, customerNumber: true, email: true },
    });
  }

  async findContactForOpportunity(organizationId: string, contactId: string) {
    return this.db.contact.findFirst({
      where: { id: contactId, organizationId, deletedAt: null },
      select: { id: true, customerId: true, displayName: true },
    });
  }

  async findResellerForOpportunity(organizationId: string, resellerId: string) {
    return this.db.reseller.findFirst({
      where: { id: resellerId, organizationId, deletedAt: null },
      select: { id: true, displayName: true },
    });
  }

  async findProductSnapshot(organizationId: string, productId: string) {
    return this.db.product.findFirst({
      where: { id: productId, organizationId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, code: true, name: true },
    });
  }

  async create(organizationId: string, actorId: string, input: OpportunityCreateData) {
    const id = await this.transaction(async (tx) => {
      const opportunityNumber = await allocateDocumentNumberIn(tx, organizationId, "OPPORTUNITY");
      const created = await tx.opportunity.create({
        data: {
          organizationId,
          opportunityNumber,
          title: input.title,
          description: input.description ?? null,
          stage: "NEW",
          customerId: input.customerId ?? null,
          contactId: input.contactId ?? null,
          resellerId: input.resellerId ?? null,
          ownerUserId: input.ownerUserId,
          leadSource: (input.leadSource as CustomerLeadSource | undefined) ?? null,
          estimatedValue: input.estimatedValue,
          currencyCode: input.currencyCode,
          exchangeRateToBase: input.exchangeRateToBase,
          estimatedValueBase: input.estimatedValueBase,
          baseCurrencyCode: input.baseCurrencyCode,
          probabilityPercent: input.probabilityPercent,
          expectedCloseDate: input.expectedCloseDate ? dateOnly(input.expectedCloseDate) : null,
          nextAction: input.nextAction ?? null,
          nextActionDueAt: input.nextActionDueAt ? new Date(input.nextActionDueAt) : null,
          competitorName: input.competitorName ?? null,
          prospectDisplayName: input.prospectDisplayName ?? null,
          prospectLegalName: input.prospectLegalName ?? null,
          prospectEmail: input.prospectEmail ?? null,
          prospectPhone: input.prospectPhone ?? null,
          prospectCountryCode: input.prospectCountryCode ?? null,
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

  async update(organizationId: string, id: string, actorId: string, input: OpportunityUpdateData) {
    const existing = await this.findById(organizationId, id);
    if (!existing) {
      return null;
    }
    await this.db.opportunity.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
        ...(input.resellerId !== undefined ? { resellerId: input.resellerId } : {}),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.leadSource !== undefined ? { leadSource: input.leadSource as CustomerLeadSource | null } : {}),
        ...(input.estimatedValue !== undefined ? { estimatedValue: input.estimatedValue } : {}),
        ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
        ...(input.exchangeRateToBase !== undefined ? { exchangeRateToBase: input.exchangeRateToBase } : {}),
        ...(input.estimatedValueBase !== undefined ? { estimatedValueBase: input.estimatedValueBase } : {}),
        ...(input.baseCurrencyCode !== undefined ? { baseCurrencyCode: input.baseCurrencyCode } : {}),
        ...(input.probabilityPercent !== undefined ? { probabilityPercent: input.probabilityPercent } : {}),
        ...(input.expectedCloseDate !== undefined
          ? { expectedCloseDate: input.expectedCloseDate ? dateOnly(input.expectedCloseDate) : null }
          : {}),
        ...(input.nextAction !== undefined ? { nextAction: input.nextAction ?? null } : {}),
        ...(input.nextActionDueAt !== undefined
          ? { nextActionDueAt: input.nextActionDueAt ? new Date(input.nextActionDueAt) : null }
          : {}),
        ...(input.competitorName !== undefined ? { competitorName: input.competitorName ?? null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        ...(input.prospectDisplayName !== undefined ? { prospectDisplayName: input.prospectDisplayName ?? null } : {}),
        ...(input.prospectLegalName !== undefined ? { prospectLegalName: input.prospectLegalName ?? null } : {}),
        ...(input.prospectEmail !== undefined ? { prospectEmail: input.prospectEmail ?? null } : {}),
        ...(input.prospectPhone !== undefined ? { prospectPhone: input.prospectPhone ?? null } : {}),
        ...(input.prospectCountryCode !== undefined ? { prospectCountryCode: input.prospectCountryCode ?? null } : {}),
        updatedById: actorId,
      },
    });
    return this.findById(organizationId, id);
  }

  async softDelete(organizationId: string, id: string, actorId: string) {
    const result = await this.db.opportunity.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
  }

  async restore(organizationId: string, id: string, actorId: string) {
    const result = await this.db.opportunity.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null, updatedById: actorId },
    });
    return result.count === 1;
  }

  async changeStage(
    organizationId: string,
    id: string,
    actorId: string,
    data: { stage: string; probabilityPercent: number; expectedCloseDate?: string },
  ) {
    const result = await this.db.opportunity.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: {
        stage: data.stage as Prisma.OpportunityUpdateInput["stage"],
        probabilityPercent: data.probabilityPercent,
        ...(data.expectedCloseDate !== undefined ? { expectedCloseDate: dateOnly(data.expectedCloseDate) } : {}),
        updatedById: actorId,
      },
    });
    return result.count === 1 ? this.findById(organizationId, id) : null;
  }

  async markWon(organizationId: string, id: string, actorId: string, probabilityPercent: number) {
    const now = new Date();
    const result = await this.db.opportunity.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: {
        stage: "WON",
        probabilityPercent,
        wonAt: now,
        lostAt: null,
        closedAt: now,
        lostReason: null,
        lostReasonDetail: null,
        updatedById: actorId,
      },
    });
    return result.count === 1 ? this.findById(organizationId, id) : null;
  }

  async markLost(
    organizationId: string,
    id: string,
    actorId: string,
    data: { probabilityPercent: number; lostReason: string; lostReasonDetail?: string; competitorName?: string },
  ) {
    const now = new Date();
    const result = await this.db.opportunity.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: {
        stage: "LOST",
        probabilityPercent: data.probabilityPercent,
        lostReason: data.lostReason as Prisma.OpportunityUpdateInput["lostReason"],
        lostReasonDetail: data.lostReasonDetail ?? null,
        ...(data.competitorName !== undefined ? { competitorName: data.competitorName ?? null } : {}),
        wonAt: null,
        lostAt: now,
        closedAt: now,
        updatedById: actorId,
      },
    });
    return result.count === 1 ? this.findById(organizationId, id) : null;
  }

  async reopen(organizationId: string, id: string, actorId: string, stage: string, probabilityPercent: number) {
    const result = await this.db.opportunity.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: {
        stage: stage as Prisma.OpportunityUpdateInput["stage"],
        probabilityPercent,
        wonAt: null,
        lostAt: null,
        closedAt: null,
        lostReason: null,
        lostReasonDetail: null,
        reopenedAt: new Date(),
        updatedById: actorId,
      },
    });
    return result.count === 1 ? this.findById(organizationId, id) : null;
  }

  async linkExistingCustomer(organizationId: string, id: string, customerId: string, actorId: string) {
    const result = await this.db.opportunity.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { customerId, updatedById: actorId },
    });
    return result.count === 1 ? this.findById(organizationId, id) : null;
  }

  /**
   * Links a newly created customer to the opportunity.
   * Customer insert, customer-number allocation, and the link commit or roll back together.
   * Prospect snapshot columns are left unchanged.
   */
  async convertWithNewCustomer<T extends { id: string }>(
    organizationId: string,
    id: string,
    actorId: string,
    createCustomer: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.transaction(async (tx) => {
        const customer = await createCustomer(tx);
        const updated = await tx.opportunity.updateMany({
          where: { id, organizationId, deletedAt: null, customerId: null },
          data: { customerId: customer.id, updatedById: actorId },
        });
        if (updated.count !== 1) {
          throw new ConflictError("Opportunity was not found, already deleted, or already linked to a customer");
        }
        return customer;
      });
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError(
          "A customer with this email already exists; convert using mode LINK to attach that customer instead",
        );
      }
      throw error;
    }
  }

  async listProductInterests(organizationId: string, opportunityId: string) {
    return this.db.opportunityProductInterest.findMany({
      where: { organizationId, opportunityId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: interestSelect,
    });
  }

  async findProductInterest(organizationId: string, opportunityId: string, interestId: string) {
    return this.db.opportunityProductInterest.findFirst({
      where: { id: interestId, organizationId, opportunityId },
      select: interestSelect,
    });
  }

  async createProductInterest(
    organizationId: string,
    opportunityId: string,
    actorId: string,
    product: { id: string; code: string; name: string },
    input: CreateProductInterestInput,
  ) {
    try {
      return await this.db.opportunityProductInterest.create({
        data: {
          organizationId,
          opportunityId,
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          quantity: input.quantity ?? "1",
          estimatedUnitAmount: input.estimatedUnitAmount ?? null,
          notes: input.notes ?? null,
          sortOrder: input.sortOrder ?? 0,
          createdById: actorId,
        },
        select: interestSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("This product is already a product interest on this opportunity");
      }
      throw error;
    }
  }

  async updateProductInterest(
    organizationId: string,
    opportunityId: string,
    interestId: string,
    input: UpdateProductInterestInput,
  ) {
    const existing = await this.findProductInterest(organizationId, opportunityId, interestId);
    if (!existing) {
      return null;
    }
    return this.db.opportunityProductInterest.update({
      where: { id: interestId },
      data: {
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.estimatedUnitAmount !== undefined ? { estimatedUnitAmount: input.estimatedUnitAmount } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
      select: interestSelect,
    });
  }

  async deleteProductInterest(organizationId: string, opportunityId: string, interestId: string) {
    const existing = await this.findProductInterest(organizationId, opportunityId, interestId);
    if (!existing) {
      return null;
    }
    await this.db.opportunityProductInterest.delete({ where: { id: interestId } });
    return existing;
  }
}

export interface OpportunityCreateData {
  title: string;
  description?: string;
  customerId?: string;
  contactId?: string;
  resellerId?: string;
  ownerUserId: string;
  leadSource?: string;
  estimatedValue: string;
  currencyCode: string;
  exchangeRateToBase: string;
  estimatedValueBase: string;
  baseCurrencyCode: string;
  probabilityPercent: number;
  expectedCloseDate?: string;
  nextAction?: string;
  nextActionDueAt?: string;
  competitorName?: string;
  prospectDisplayName?: string;
  prospectLegalName?: string;
  prospectEmail?: string;
  prospectPhone?: string;
  prospectCountryCode?: string;
  notes?: string;
}

export interface OpportunityUpdateData {
  title?: string;
  description?: string | null;
  contactId?: string | null;
  resellerId?: string | null;
  ownerUserId?: string;
  leadSource?: string | null;
  estimatedValue?: string;
  currencyCode?: string;
  exchangeRateToBase?: string;
  estimatedValueBase?: string;
  baseCurrencyCode?: string;
  probabilityPercent?: number;
  expectedCloseDate?: string | null;
  nextAction?: string | null;
  nextActionDueAt?: string | null;
  competitorName?: string | null;
  notes?: string | null;
  prospectDisplayName?: string | null;
  prospectLegalName?: string | null;
  prospectEmail?: string | null;
  prospectPhone?: string | null;
  prospectCountryCode?: string | null;
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function utcDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

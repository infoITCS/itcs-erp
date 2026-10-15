import type { Prisma } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import type { AuditLogsService } from "../audit-logs/service";
import type { RequestMeta } from "../auth/types";
import type { CustomersService } from "../customers/service";
import { computeCurrencySnapshot } from "./currency-snapshot";
import { toOpportunityPage, type OpportunitySort } from "./page";
import type { OpportunitiesRepository } from "./repository";
import { assertCanChangeStage, defaultProbabilityForStage, resolveProbability } from "./stages";
import { ALL_STAGES, LEAD_SOURCES, LOST_REASONS, OPPORTUNITIES_MODULE } from "./types";
import type {
  ChangeStageInput,
  ConvertOpportunityInput,
  CreateOpportunityInput,
  CreateProductInterestInput,
  MarkLostInput,
  MarkWonInput,
  OpportunityListQuery,
  ReopenOpportunityInput,
  UpdateOpportunityInput,
  UpdateProductInterestInput,
} from "./validation";

const LINK_EXISTING_CUSTOMER =
  "A customer with this email already exists; convert using mode LINK to attach that customer instead";

export class OpportunitiesService {
  constructor(
    private readonly repository: OpportunitiesRepository,
    private readonly customers: CustomersService,
    private readonly audit: AuditLogsService,
  ) {}

  async list(organizationId: string, query: OpportunityListQuery, permissions: string[]) {
    if (query.includeDeleted && !canSeeDeleted(permissions)) {
      throw new ForbiddenError();
    }
    const sort = (query.sort ?? "createdAt") as OpportunitySort;
    const rows = await this.repository.list(
      {
        organizationId,
        q: query.q,
        stage: query.stage,
        customerId: query.customerId,
        resellerId: query.resellerId,
        ownerUserId: query.ownerUserId,
        leadSource: query.leadSource,
        from: query.from,
        to: query.to,
        includeDeleted: query.includeDeleted,
      },
      query.limit,
      sort,
      query.order,
      query.cursor,
    );
    return toOpportunityPage(rows, query.limit, sort);
  }

  async get(organizationId: string, id: string) {
    const opportunity = await this.repository.findById(organizationId, id);
    if (!opportunity) {
      throw new NotFoundError("Opportunity not found");
    }
    return opportunity;
  }

  async formOptions(organizationId: string) {
    const [owners, resellers] = await Promise.all([
      this.repository.listOwnerOptions(organizationId),
      this.repository.listResellerOptions(organizationId),
    ]);
    return { owners, resellers, leadSources: LEAD_SOURCES, lostReasons: LOST_REASONS, stages: ALL_STAGES };
  }

  async create(organizationId: string, actorId: string, input: CreateOpportunityInput, meta: RequestMeta) {
    await this.requireCurrency(input.currencyCode);
    const ownerUserId = input.ownerUserId ?? actorId;
    await this.requireOwner(organizationId, ownerUserId);
    if (input.customerId) {
      await this.requireCustomerExists(organizationId, input.customerId);
    }
    if (input.contactId) {
      if (!input.customerId) {
        throw new ValidationFailedError({ contactId: ["Link a customer before attaching a contact"] });
      }
      await this.requireContact(organizationId, input.contactId, input.customerId);
    }
    if (input.resellerId) {
      await this.requireReseller(organizationId, input.resellerId);
    }

    const estimatedValue = input.estimatedValue ?? "0";
    const snapshot = await this.computeSnapshot(organizationId, estimatedValue, input.currencyCode);
    const probabilityPercent = input.probabilityPercent ?? defaultProbabilityForStage("NEW");

    const opportunity = await this.repository.create(organizationId, actorId, {
      title: input.title,
      description: input.description,
      customerId: input.customerId,
      contactId: input.contactId,
      resellerId: input.resellerId,
      ownerUserId,
      leadSource: input.leadSource,
      estimatedValue,
      currencyCode: input.currencyCode,
      exchangeRateToBase: snapshot.exchangeRateToBase,
      estimatedValueBase: snapshot.estimatedValueBase,
      baseCurrencyCode: snapshot.baseCurrencyCode,
      probabilityPercent,
      expectedCloseDate: input.expectedCloseDate,
      nextAction: input.nextAction,
      nextActionDueAt: input.nextActionDueAt,
      competitorName: input.competitorName,
      prospectDisplayName: input.prospectDisplayName,
      prospectLegalName: input.prospectLegalName,
      prospectEmail: input.prospectEmail,
      prospectPhone: input.prospectPhone,
      prospectCountryCode: input.prospectCountryCode,
      notes: input.notes,
    });
    if (!opportunity) {
      throw new NotFoundError("Opportunity not found");
    }

    await this.record(organizationId, actorId, "opportunities.created", "opportunity", opportunity.id, meta, {
      opportunityId: opportunity.id,
      opportunityNumber: opportunity.opportunityNumber,
      title: opportunity.title,
      stage: opportunity.stage,
      currencyCode: opportunity.currencyCode,
      estimatedValue: String(opportunity.estimatedValue),
    });
    return opportunity;
  }

  async update(organizationId: string, actorId: string, id: string, input: UpdateOpportunityInput, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    if (input.currencyCode) {
      await this.requireCurrency(input.currencyCode);
    }
    if (input.ownerUserId) {
      await this.requireOwner(organizationId, input.ownerUserId);
    }
    if (input.resellerId) {
      await this.requireReseller(organizationId, input.resellerId);
    }
    if (input.contactId) {
      if (!existing.customerId) {
        throw new ValidationFailedError({ contactId: ["Link a customer before attaching a contact"] });
      }
      await this.requireContact(organizationId, input.contactId, existing.customerId);
    }

    let snapshot: { exchangeRateToBase: string; estimatedValueBase: string; baseCurrencyCode: string } | undefined;
    if (input.estimatedValue !== undefined || input.currencyCode !== undefined) {
      const nextValue = input.estimatedValue ?? String(existing.estimatedValue);
      const nextCurrency = input.currencyCode ?? existing.currencyCode;
      snapshot = await this.computeSnapshot(organizationId, nextValue, nextCurrency);
    }

    const updated = await this.repository.update(organizationId, id, actorId, {
      ...input,
      ...snapshot,
    });
    if (!updated) {
      throw new NotFoundError("Opportunity not found");
    }

    await this.record(organizationId, actorId, "opportunities.updated", "opportunity", id, meta, {
      opportunityId: id,
      changes: input,
    });
    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    const removed = await this.repository.softDelete(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Opportunity not found");
    }
    await this.record(organizationId, actorId, "opportunities.deleted", "opportunity", id, meta, {
      opportunityId: id,
      opportunityNumber: existing.opportunityNumber,
      title: existing.title,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async restore(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const restored = await this.repository.restore(organizationId, id, actorId);
    if (!restored) {
      throw new NotFoundError("Deleted opportunity not found");
    }
    await this.record(organizationId, actorId, "opportunities.restored", "opportunity", id, meta, { opportunityId: id });
    return this.get(organizationId, id);
  }

  async changeStage(organizationId: string, actorId: string, id: string, input: ChangeStageInput, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    assertCanChangeStage(existing.stage);
    const probabilityPercent = resolveProbability(
      existing.probabilityPercent,
      input.stage,
      input.probabilityPercent,
      input.applyStageDefault,
    );
    const updated = await this.repository.changeStage(organizationId, id, actorId, {
      stage: input.stage,
      probabilityPercent,
      expectedCloseDate: input.expectedCloseDate,
    });
    if (!updated) {
      throw new NotFoundError("Opportunity not found");
    }
    await this.record(
      organizationId,
      actorId,
      "opportunities.stage.changed",
      "opportunity",
      id,
      meta,
      { opportunityId: id, stage: input.stage, probabilityPercent },
      { stage: existing.stage, probabilityPercent: existing.probabilityPercent },
    );
    return updated;
  }

  async markWon(organizationId: string, actorId: string, id: string, input: MarkWonInput, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    assertCanChangeStage(existing.stage);
    if (!existing.customerId || !existing.customer) {
      throw new ValidationFailedError({ customerId: ["Link this opportunity to a customer before marking it won"] });
    }
    if (existing.customer.status !== "ACTIVE") {
      throw new ValidationFailedError({
        customerId: ["The linked customer must be active to mark this opportunity won"],
      });
    }
    const probabilityPercent = resolveProbability(
      existing.probabilityPercent,
      "WON",
      input.probabilityPercent,
      input.applyStageDefault,
    );

    const updated = await this.repository.markWon(organizationId, id, actorId, probabilityPercent);
    if (!updated) {
      throw new NotFoundError("Opportunity not found");
    }
    await this.record(
      organizationId,
      actorId,
      "opportunities.won",
      "opportunity",
      id,
      meta,
      { opportunityId: id, probabilityPercent },
      { stage: existing.stage, probabilityPercent: existing.probabilityPercent },
    );
    return updated;
  }

  async markLost(organizationId: string, actorId: string, id: string, input: MarkLostInput, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    assertCanChangeStage(existing.stage);
    const probabilityPercent = resolveProbability(
      existing.probabilityPercent,
      "LOST",
      input.probabilityPercent,
      input.applyStageDefault,
    );

    const updated = await this.repository.markLost(organizationId, id, actorId, {
      probabilityPercent,
      lostReason: input.lostReason,
      lostReasonDetail: input.lostReasonDetail,
      competitorName: input.competitorName,
    });
    if (!updated) {
      throw new NotFoundError("Opportunity not found");
    }
    await this.record(
      organizationId,
      actorId,
      "opportunities.lost",
      "opportunity",
      id,
      meta,
      { opportunityId: id, probabilityPercent, lostReason: input.lostReason },
      { stage: existing.stage, probabilityPercent: existing.probabilityPercent },
    );
    return updated;
  }

  async reopen(organizationId: string, actorId: string, id: string, input: ReopenOpportunityInput, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    if (!["WON", "LOST"].includes(existing.stage)) {
      throw new ValidationFailedError({ stage: ["Only a won or lost opportunity can be reopened"] });
    }
    // Linked deals reopen into negotiation; prospects reopen into qualification.
    const stage = input.stage ?? (existing.customerId ? "NEGOTIATION" : "QUALIFICATION");
    const probabilityPercent = resolveProbability(
      existing.probabilityPercent,
      stage,
      input.probabilityPercent,
      input.applyStageDefault,
    );

    const updated = await this.repository.reopen(organizationId, id, actorId, stage, probabilityPercent);
    if (!updated) {
      throw new NotFoundError("Opportunity not found");
    }
    await this.record(
      organizationId,
      actorId,
      "opportunities.reopened",
      "opportunity",
      id,
      meta,
      { opportunityId: id, stage, probabilityPercent },
      { stage: existing.stage, probabilityPercent: existing.probabilityPercent },
    );
    return updated;
  }

  async convert(organizationId: string, actorId: string, id: string, input: ConvertOpportunityInput, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    if (existing.customerId) {
      throw new ConflictError("This opportunity is already linked to a customer");
    }

    if (input.mode === "LINK") {
      const customer = await this.repository.findCustomerForLink(organizationId, input.customerId);
      if (!customer) {
        throw new NotFoundError("Customer not found");
      }
      const updated = await this.repository.linkExistingCustomer(organizationId, id, customer.id, actorId);
      if (!updated) {
        throw new NotFoundError("Opportunity not found");
      }
      await this.record(organizationId, actorId, "opportunities.converted", "opportunity", id, meta, {
        opportunityId: id,
        customerId: customer.id,
        mode: "LINK",
      });
      return updated;
    }

    await this.customers.validateCreate(organizationId, input.customer);
    await this.assertNoMatchingCustomer(organizationId, existing.prospectEmail, input.customer.email);

    const customer = await this.repository.convertWithNewCustomer(organizationId, id, actorId, async (tx) => {
      await this.assertNoMatchingCustomer(organizationId, existing.prospectEmail, input.customer.email, tx);
      try {
        return await this.customers.createWithin(tx, organizationId, actorId, input.customer);
      } catch (error) {
        if (error instanceof ConflictError && error.message.includes("email already exists")) {
          throw new ConflictError(LINK_EXISTING_CUSTOMER);
        }
        throw error;
      }
    });
    await this.record(organizationId, actorId, "customers.created", "customer", customer.id, meta, {
      customerId: customer.id,
      customerNumber: customer.customerNumber,
      displayName: customer.displayName,
      createdFromOpportunityId: id,
    });
    await this.record(organizationId, actorId, "opportunities.converted", "opportunity", id, meta, {
      opportunityId: id,
      customerId: customer.id,
      mode: "CREATE",
    });
    return this.get(organizationId, id);
  }

  async listProductInterests(organizationId: string, id: string) {
    await this.get(organizationId, id);
    return this.repository.listProductInterests(organizationId, id);
  }

  async createProductInterest(
    organizationId: string,
    actorId: string,
    id: string,
    input: CreateProductInterestInput,
    meta: RequestMeta,
  ) {
    await this.get(organizationId, id);
    const product = await this.repository.findProductSnapshot(organizationId, input.productId);
    if (!product) {
      throw new ValidationFailedError({ productId: ["Choose an active product in this organization"] });
    }
    const interest = await this.repository.createProductInterest(organizationId, id, actorId, product, input);
    await this.record(organizationId, actorId, "opportunities.product_interest.created", "opportunity_product_interest", interest.id, meta, {
      opportunityId: id,
      productId: product.id,
      productCode: product.code,
      quantity: String(interest.quantity),
    });
    return interest;
  }

  async updateProductInterest(
    organizationId: string,
    actorId: string,
    id: string,
    interestId: string,
    input: UpdateProductInterestInput,
    meta: RequestMeta,
  ) {
    await this.get(organizationId, id);
    const existing = await this.repository.findProductInterest(organizationId, id, interestId);
    if (!existing) {
      throw new NotFoundError("Product interest not found");
    }
    const updated = await this.repository.updateProductInterest(organizationId, id, interestId, input);
    if (!updated) {
      throw new NotFoundError("Product interest not found");
    }
    await this.record(
      organizationId,
      actorId,
      "opportunities.product_interest.updated",
      "opportunity_product_interest",
      interestId,
      meta,
      { opportunityId: id, changes: input },
      { quantity: String(existing.quantity), estimatedUnitAmount: existing.estimatedUnitAmount ? String(existing.estimatedUnitAmount) : null },
    );
    return updated;
  }

  async removeProductInterest(organizationId: string, actorId: string, id: string, interestId: string, meta: RequestMeta) {
    await this.get(organizationId, id);
    const removed = await this.repository.deleteProductInterest(organizationId, id, interestId);
    if (!removed) {
      throw new NotFoundError("Product interest not found");
    }
    await this.record(organizationId, actorId, "opportunities.product_interest.deleted", "opportunity_product_interest", interestId, meta, {
      opportunityId: id,
      productId: removed.productId,
    });
    return { id: interestId, deleted: true };
  }

  async listAudit(organizationId: string, id: string, limit: number, cursor?: string) {
    await this.get(organizationId, id);
    return this.audit.list(organizationId, limit, cursor, { entityType: "opportunity", entityId: id });
  }

  private async computeSnapshot(organizationId: string, estimatedValue: string, currencyCode: string) {
    const organization = await this.repository.findOrganization(organizationId);
    if (!organization) {
      throw new NotFoundError("Organization not found");
    }
    return computeCurrencySnapshot(estimatedValue, currencyCode, organization.baseCurrencyCode, (base, quote) =>
      this.repository.findExchangeRateValue(organizationId, base, quote),
    );
  }

  private async assertNoMatchingCustomer(
    organizationId: string,
    prospectEmail: string | null | undefined,
    customerEmail: string | null | undefined,
    client?: Prisma.TransactionClient,
  ) {
    const seen = new Set<string>();
    for (const value of [prospectEmail, customerEmail]) {
      const email = value?.trim().toLowerCase();
      if (!email || seen.has(email)) {
        continue;
      }
      seen.add(email);
      if (await this.customers.emailTaken(organizationId, email, client)) {
        throw new ConflictError(LINK_EXISTING_CUSTOMER);
      }
    }
  }

  private async requireCurrency(code: string) {
    if (!(await this.repository.currencyIsActive(code))) {
      throw new ValidationFailedError({ currencyCode: ["Choose an active currency"] });
    }
  }

  private async requireOwner(organizationId: string, ownerUserId: string) {
    if (!(await this.repository.findActiveOrgUser(organizationId, ownerUserId))) {
      throw new ValidationFailedError({ ownerUserId: ["Choose an active user in this organization"] });
    }
  }

  private async requireCustomerExists(organizationId: string, customerId: string) {
    const customer = await this.repository.findCustomerForLink(organizationId, customerId);
    if (!customer) {
      throw new ValidationFailedError({ customerId: ["Choose a customer in this organization"] });
    }
    return customer;
  }

  private async requireContact(organizationId: string, contactId: string, customerId?: string | null) {
    const contact = await this.repository.findContactForOpportunity(organizationId, contactId);
    if (!contact) {
      throw new ValidationFailedError({ contactId: ["Choose a contact in this organization"] });
    }
    if (customerId && contact.customerId !== customerId) {
      throw new ValidationFailedError({ contactId: ["Choose a contact that belongs to the linked customer"] });
    }
  }

  private async requireReseller(organizationId: string, resellerId: string) {
    if (!(await this.repository.findResellerForOpportunity(organizationId, resellerId))) {
      throw new ValidationFailedError({ resellerId: ["Choose a reseller in this organization"] });
    }
  }

  private record(
    organizationId: string,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    meta: RequestMeta,
    newValues: Prisma.InputJsonValue,
    oldValues?: Prisma.InputJsonValue,
  ) {
    return this.audit.record({
      organizationId,
      userId: actorId,
      action,
      module: action.startsWith("customers.") ? "customers" : OPPORTUNITIES_MODULE,
      entityType,
      entityId,
      oldValues,
      newValues,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }
}

function canSeeDeleted(permissions: string[]): boolean {
  return permissions.includes("opportunities:delete") || permissions.includes("opportunities:restore");
}

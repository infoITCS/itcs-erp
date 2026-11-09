import type { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { ForbiddenError, NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import type { AuditLogsService } from "../audit-logs/service";
import type { RequestMeta } from "../auth/types";
import type { CustomersService } from "../customers/service";
import { createCustomerSchema, type CreateCustomerInput } from "../customers/validation";
import { computeCurrencySnapshot } from "../opportunities/currency-snapshot";
import type { OpportunitiesRepository } from "../opportunities/repository";
import { toLeadPage, type LeadSort } from "./page";
import type { LeadsRepository } from "./repository";
import { assertLeadTransition, isConverted } from "./status";
import {
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEADS_MODULE,
  type ComparisonPeriod,
} from "./types";
import type {
  ChangeLeadStatusInput,
  ConvertLeadInput,
  CreateLeadInput,
  LeadListQuery,
  UpdateLeadInput,
} from "./validation";

export class LeadsService {
  constructor(
    private readonly repository: LeadsRepository,
    private readonly opportunitiesRepository: OpportunitiesRepository,
    private readonly customers: CustomersService,
    private readonly audit: AuditLogsService,
  ) {}

  async list(organizationId: string, query: LeadListQuery, permissions: string[]) {
    if (query.includeDeleted && !canSeeDeleted(permissions)) {
      throw new ForbiddenError();
    }
    const sort = (query.sort ?? "createdAt") as LeadSort;
    const rows = await this.repository.list(
      {
        organizationId,
        q: query.q,
        status: query.status,
        source: query.source,
        ownerUserId: query.ownerUserId,
        priority: query.priority,
        from: query.from,
        to: query.to,
        includeDeleted: query.includeDeleted,
      },
      query.limit,
      sort,
      query.order,
      query.cursor,
    );
    return toLeadPage(rows, query.limit, sort);
  }

  async get(organizationId: string, id: string) {
    const lead = await this.repository.findById(organizationId, id);
    if (!lead) {
      throw new NotFoundError("Lead not found");
    }
    return lead;
  }

  async formOptions(organizationId: string) {
    const owners = await this.repository.listOwnerOptions(organizationId);
    return {
      owners,
      sources: LEAD_SOURCES,
      statuses: LEAD_STATUSES,
      priorities: LEAD_PRIORITIES,
    };
  }

  async create(organizationId: string, actorId: string, input: CreateLeadInput, meta: RequestMeta) {
    await this.requireCurrency(input.currencyCode);
    const ownerUserId = input.ownerUserId ?? actorId;
    await this.requireOwner(organizationId, ownerUserId);

    const displayName =
      input.displayName ?? input.companyName ?? `${input.firstName} ${input.lastName}`.trim();

    const lead = await this.repository.create(organizationId, actorId, {
      firstName: input.firstName,
      lastName: input.lastName,
      displayName,
      companyName: input.companyName,
      jobTitle: input.jobTitle,
      email: input.email,
      phone: input.phone,
      website: input.website,
      countryCode: input.countryCode,
      currencyCode: input.currencyCode,
      source: input.source,
      priority: input.priority,
      estimatedValue: input.estimatedValue,
      ownerUserId,
      nextAction: input.nextAction,
      nextActionDueAt: input.nextActionDueAt,
      description: input.description,
      notes: input.notes,
    });
    if (!lead) {
      throw new NotFoundError("Lead not found");
    }

    await this.record(organizationId, actorId, "leads.created", "lead", lead.id, meta, {
      leadId: lead.id,
      leadNumber: lead.leadNumber,
      displayName: lead.displayName,
      source: lead.source,
      status: lead.status,
    });
    return lead;
  }

  async update(organizationId: string, actorId: string, id: string, input: UpdateLeadInput, meta: RequestMeta) {
    await this.get(organizationId, id);
    if (input.currencyCode) {
      await this.requireCurrency(input.currencyCode);
    }
    if (input.ownerUserId) {
      await this.requireOwner(organizationId, input.ownerUserId);
    }

    const updated = await this.repository.update(organizationId, id, actorId, input);
    if (!updated) {
      throw new NotFoundError("Lead not found");
    }
    await this.record(organizationId, actorId, "leads.updated", "lead", id, meta, {
      leadId: id,
      changes: input,
    });
    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    const removed = await this.repository.softDelete(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Lead not found");
    }
    await this.record(organizationId, actorId, "leads.deleted", "lead", id, meta, {
      leadId: id,
      leadNumber: existing.leadNumber,
      displayName: existing.displayName,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async restore(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const restored = await this.repository.restore(organizationId, id, actorId);
    if (!restored) {
      throw new NotFoundError("Deleted lead not found");
    }
    await this.record(organizationId, actorId, "leads.restored", "lead", id, meta, { leadId: id });
    return this.get(organizationId, id);
  }

  async changeStatus(
    organizationId: string,
    actorId: string,
    id: string,
    input: ChangeLeadStatusInput,
    meta: RequestMeta,
  ) {
    const existing = await this.get(organizationId, id);
    if (isConverted(existing.status)) {
      throw new ValidationFailedError({
        status: ["A converted lead can no longer change status manually"],
      });
    }
    assertLeadTransition(existing.status, input.status);

    const updated = await this.repository.changeStatus(organizationId, id, actorId, {
      status: input.status,
      unqualifiedReason: input.unqualifiedReason,
      nextAction: input.nextAction,
      nextActionDueAt: input.nextActionDueAt,
    });
    if (!updated) {
      throw new NotFoundError("Lead not found");
    }
    await this.record(
      organizationId,
      actorId,
      "leads.status.changed",
      "lead",
      id,
      meta,
      { leadId: id, status: input.status },
      { status: existing.status },
    );
    return updated;
  }

  async convert(organizationId: string, actorId: string, id: string, input: ConvertLeadInput, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    if (existing.status !== "QUALIFIED") {
      throw new ValidationFailedError({
        status: ["Only a qualified lead can be converted to an opportunity"],
      });
    }

    const currencyCode = input.opportunity.currencyCode ?? existing.currencyCode;
    await this.requireCurrency(currencyCode);
    const ownerUserId = input.opportunity.ownerUserId ?? existing.ownerUserId;
    await this.requireOwner(organizationId, ownerUserId);
    const estimatedValue = input.opportunity.estimatedValue ?? String(existing.estimatedValue);
    const snapshot = await this.computeSnapshot(organizationId, estimatedValue, currencyCode);

    let customerInput: CreateCustomerInput | undefined;
    if (input.mode === "ACCOUNT") {
      try {
        customerInput = this.customerInput(existing, input);
      } catch (error) {
        if (error instanceof ZodError) {
          throw new ValidationFailedError(error.flatten().fieldErrors as Record<string, string[]>);
        }
        throw error;
      }
      await this.customers.validateCreate(organizationId, customerInput);
    }

    const opportunityBase = {
      title: input.opportunity.title,
      description: input.opportunity.description,
      estimatedValue,
      currencyCode,
      exchangeRateToBase: snapshot.exchangeRateToBase,
      estimatedValueBase: snapshot.estimatedValueBase,
      baseCurrencyCode: snapshot.baseCurrencyCode,
      probabilityPercent: 10,
      expectedCloseDate: input.opportunity.expectedCloseDate,
      nextAction: input.opportunity.nextAction,
      nextActionDueAt: input.opportunity.nextActionDueAt,
      notes: input.opportunity.notes,
      ownerUserId,
      leadId: existing.id,
      leadSource: existing.source,
    } as const;

    const result = await this.repository.convert(organizationId, existing.id, actorId, {
      createCustomer: customerInput
        ? (tx) => this.customers.createWithin(tx, organizationId, actorId, customerInput)
        : undefined,
      createOpportunity: (tx, link) =>
        this.opportunitiesRepository.createIn(tx, organizationId, actorId, {
          ...opportunityBase,
          customerId: link.customerId,
          contactId: link.contactId,
          prospectDisplayName:
            input.mode === "PROSPECT" ? input.opportunity.prospectDisplayName : undefined,
          prospectLegalName: input.mode === "PROSPECT" ? input.opportunity.prospectLegalName : undefined,
          prospectEmail: input.mode === "PROSPECT" ? input.opportunity.prospectEmail : undefined,
          prospectPhone: input.mode === "PROSPECT" ? input.opportunity.prospectPhone : undefined,
          prospectCountryCode:
            input.mode === "PROSPECT" ? input.opportunity.prospectCountryCode : undefined,
        }),
    });

    const opportunity = await this.opportunitiesRepository.findById(organizationId, result.opportunityId);
    await this.record(organizationId, actorId, "leads.converted", "lead", id, meta, {
      leadId: id,
      mode: input.mode,
      customerId: result.customerId,
      contactId: result.contactId,
      opportunityId: result.opportunityId,
      opportunityNumber: opportunity?.opportunityNumber ?? null,
    });
    if (result.customerId) {
      await this.record(organizationId, actorId, "customers.created", "customer", result.customerId, meta, {
        customerId: result.customerId,
        createdFromLeadId: id,
      });
    }
    if (opportunity) {
      await this.record(organizationId, actorId, "opportunities.created", "opportunity", opportunity.id, meta, {
        opportunityId: opportunity.id,
        opportunityNumber: opportunity.opportunityNumber,
        createdFromLeadId: id,
      });
    }
    return this.get(organizationId, id);
  }

  async analytics(organizationId: string, period: ComparisonPeriod) {
    const from = periodStart(period);
    const [organization, statusRows, sourceRows, opportunityRows] = await Promise.all([
      this.repository.findOrganization(organizationId),
      this.repository.statusCounts(organizationId, from),
      this.repository.sourceStatusCounts(organizationId, from),
      this.repository.opportunitySourceStageCounts(organizationId, from),
    ]);

    const statusTotals = new Map<string, { count: number; value: number }>();
    for (const row of statusRows) {
      statusTotals.set(row.status, {
        count: row._count._all,
        value: decimalToNumber(row._sum.estimatedValue),
      });
    }

    const totalLeads = [...statusTotals.values()].reduce((sum, entry) => sum + entry.count, 0);
    const convertedLeads =
      (statusTotals.get("CONVERTED")?.count ?? 0) + (statusTotals.get("WON")?.count ?? 0);

    const bySource = new Map<
      string,
      {
        source: string;
        leads: number;
        qualified: number;
        unqualified: number;
        converted: number;
        wonLeads: number;
        estimatedValue: number;
        opportunities: number;
        won: number;
        lost: number;
        openOpportunities: number;
        pipelineValueBase: number;
        wonValueBase: number;
      }
    >();
    for (const source of LEAD_SOURCES) {
      bySource.set(source, {
        source,
        leads: 0,
        qualified: 0,
        unqualified: 0,
        converted: 0,
        wonLeads: 0,
        estimatedValue: 0,
        opportunities: 0,
        won: 0,
        lost: 0,
        openOpportunities: 0,
        pipelineValueBase: 0,
        wonValueBase: 0,
      });
    }

    for (const row of sourceRows) {
      const entry = bySource.get(row.source);
      if (!entry) {
        continue;
      }
      const count = row._count._all;
      entry.leads += count;
      entry.estimatedValue += decimalToNumber(row._sum.estimatedValue);
      if (row.status === "QUALIFIED") entry.qualified += count;
      if (row.status === "UNQUALIFIED") entry.unqualified += count;
      if (row.status === "CONVERTED") entry.converted += count;
      if (row.status === "WON") {
        entry.converted += count;
        entry.wonLeads += count;
      }
    }

    let totalOpportunities = 0;
    let totalWon = 0;
    let totalLost = 0;
    let totalOpen = 0;
    let pipelineValueBase = 0;
    let wonValueBase = 0;
    for (const row of opportunityRows) {
      const source = row.leadSource ?? "OTHER";
      const entry = bySource.get(source);
      if (!entry) {
        continue;
      }
      const count = row._count._all;
      const value = decimalToNumber(row._sum.estimatedValueBase);
      entry.opportunities += count;
      totalOpportunities += count;
      if (row.stage === "WON") {
        entry.won += count;
        entry.wonValueBase += value;
        totalWon += count;
        wonValueBase += value;
      } else if (row.stage === "LOST") {
        entry.lost += count;
        totalLost += count;
      } else {
        entry.openOpportunities += count;
        entry.pipelineValueBase += value;
        totalOpen += count;
        pipelineValueBase += value;
      }
    }

    return {
      period,
      baseCurrencyCode: organization?.baseCurrencyCode ?? "USD",
      generatedAt: new Date().toISOString(),
      totals: {
        leads: totalLeads,
        new: statusTotals.get("NEW")?.count ?? 0,
        contacted: statusTotals.get("CONTACTED")?.count ?? 0,
        qualified: statusTotals.get("QUALIFIED")?.count ?? 0,
        unqualified: statusTotals.get("UNQUALIFIED")?.count ?? 0,
        converted: statusTotals.get("CONVERTED")?.count ?? 0,
        wonLeads: statusTotals.get("WON")?.count ?? 0,
        convertedOrWon: convertedLeads,
        conversionRate: percent(convertedLeads, totalLeads),
        estimatedLeadValue: [...statusTotals.values()].reduce((sum, entry) => sum + entry.value, 0),
        opportunities: totalOpportunities,
        openOpportunities: totalOpen,
        won: totalWon,
        lost: totalLost,
        winRate: percent(totalWon, totalWon + totalLost),
        pipelineValueBase,
        wonValueBase,
      },
      bySource: [...bySource.values()]
        .map((entry) => ({
          ...entry,
          conversionRate: percent(entry.converted, entry.leads),
          winRate: percent(entry.won, entry.won + entry.lost),
        }))
        .sort((a, b) => b.leads - a.leads || a.source.localeCompare(b.source)),
    };
  }

  async listAudit(organizationId: string, id: string, limit: number, cursor?: string) {
    await this.get(organizationId, id);
    return this.audit.list(organizationId, limit, cursor, { entityType: "lead", entityId: id });
  }

  private customerInput(
    lead: NonNullable<Awaited<ReturnType<LeadsRepository["findById"]>>>,
    input: Extract<ConvertLeadInput, { mode: "ACCOUNT" }>,
  ): CreateCustomerInput {
    const contact = input.customer.contact;
    const firstName = contact?.firstName ?? lead.firstName;
    const lastName = contact?.lastName ?? lead.lastName;
    return createCustomerSchema.parse({
      entityType: input.customer.entityType,
      customerType: input.customer.customerType,
      priority: lead.priority,
      leadSource: lead.source,
      assignedSalesRepId: lead.ownerUserId,
      legalName: input.customer.legalName,
      displayName: input.customer.displayName ?? input.customer.legalName,
      email: input.customer.email ?? lead.email ?? undefined,
      phone: input.customer.phone ?? lead.phone ?? undefined,
      website: input.customer.website ?? lead.website ?? undefined,
      countryCode: input.customer.countryCode ?? lead.countryCode,
      currencyCode: input.customer.currencyCode ?? lead.currencyCode,
      notes: lead.notes ?? undefined,
      contacts: [
        {
          firstName,
          lastName,
          jobTitle: contact?.jobTitle ?? lead.jobTitle ?? undefined,
          email: contact?.email ?? lead.email ?? undefined,
          phone: contact?.phone ?? lead.phone ?? undefined,
          isPrimary: true,
        },
      ],
    });
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
      module: action.startsWith("customers.") ? "customers" : action.startsWith("opportunities.") ? "opportunities" : LEADS_MODULE,
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
  return permissions.includes("leads:delete") || permissions.includes("leads:restore");
}

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  return value ? Number(value) : 0;
}

function percent(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((part / total) * 1000) / 10;
}

function periodStart(period: ComparisonPeriod): Date | undefined {
  const days = period === "30d" ? 30 : period === "90d" ? 90 : period === "12m" ? 365 : undefined;
  if (!days) {
    return undefined;
  }
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

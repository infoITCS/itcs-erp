import type { Prisma } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import type { AuditLogsService } from "../audit-logs/service";
import type { RequestMeta } from "../auth/types";
import { computeCurrencySnapshot } from "../opportunities/currency-snapshot";
import { toTenderPage, type TenderSort } from "./page";
import type { TendersRepository } from "./repository";
import { TENDERS_MODULE, TENDER_STATUSES } from "./types";
import type { CreateTenderInput, TenderListQuery, UpdateTenderInput } from "./validation";

export class TendersService {
  constructor(
    private readonly repository: TendersRepository,
    private readonly audit: AuditLogsService,
  ) {}

  async list(organizationId: string, query: TenderListQuery, permissions: string[]) {
    if (query.includeDeleted && !canSeeDeleted(permissions)) {
      throw new ForbiddenError();
    }
    const sort = (query.sort ?? "createdAt") as TenderSort;
    const rows = await this.repository.list(
      {
        organizationId,
        q: query.q,
        status: query.status,
        customerId: query.customerId,
        ownerUserId: query.ownerUserId,
        from: query.from,
        to: query.to,
        includeDeleted: query.includeDeleted,
      },
      query.limit,
      sort,
      query.order,
      query.cursor,
    );
    return toTenderPage(rows, query.limit, sort);
  }

  async get(organizationId: string, id: string) {
    const tender = await this.repository.findById(organizationId, id);
    if (!tender) {
      throw new NotFoundError("Tender not found");
    }
    return tender;
  }

  async formOptions(organizationId: string) {
    const [customers, owners] = await Promise.all([
      this.repository.listCustomerOptions(organizationId),
      this.repository.listOwnerOptions(organizationId),
    ]);
    return { customers, owners, statuses: TENDER_STATUSES };
  }

  async create(organizationId: string, actorId: string, input: CreateTenderInput, meta: RequestMeta) {
    await this.requireCurrency(input.currencyCode);
    const ownerUserId = input.ownerUserId ?? actorId;
    await this.requireOwner(organizationId, ownerUserId);
    await this.requireCustomer(organizationId, input.customerId);
    if (input.contactId) {
      await this.requireContact(organizationId, input.contactId, input.customerId);
    }

    const estimatedValue = input.estimatedValue ?? "0";
    const snapshot = await this.computeSnapshot(organizationId, estimatedValue, input.currencyCode);

    const tender = await this.repository.create(organizationId, actorId, {
      title: input.title,
      description: input.description,
      referenceNumber: input.referenceNumber,
      status: input.status,
      customerId: input.customerId,
      contactId: input.contactId,
      ownerUserId,
      estimatedValue,
      currencyCode: input.currencyCode,
      exchangeRateToBase: snapshot.exchangeRateToBase,
      estimatedValueBase: snapshot.estimatedValueBase,
      baseCurrencyCode: snapshot.baseCurrencyCode,
      submissionDeadline: input.submissionDeadline,
      expectedAwardDate: input.expectedAwardDate,
      notes: input.notes,
    });
    if (!tender) {
      throw new NotFoundError("Tender not found");
    }

    await this.record(organizationId, actorId, "tenders.created", "tender", tender.id, meta, {
      tenderId: tender.id,
      tenderNumber: tender.tenderNumber,
      title: tender.title,
      status: tender.status,
      customerId: tender.customerId,
      currencyCode: tender.currencyCode,
      estimatedValue: String(tender.estimatedValue),
    });
    return tender;
  }

  async update(organizationId: string, actorId: string, id: string, input: UpdateTenderInput, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    if (input.currencyCode) {
      await this.requireCurrency(input.currencyCode);
    }
    if (input.ownerUserId) {
      await this.requireOwner(organizationId, input.ownerUserId);
    }
    if (input.customerId) {
      await this.requireCustomer(organizationId, input.customerId);
    }

    const customerId = input.customerId ?? existing.customerId;
    if (input.contactId) {
      await this.requireContact(organizationId, input.contactId, customerId);
    }
    const contactId =
      input.customerId && input.customerId !== existing.customerId && input.contactId === undefined
        ? null
        : input.contactId;

    let snapshot: { exchangeRateToBase: string; estimatedValueBase: string; baseCurrencyCode: string } | undefined;
    if (input.estimatedValue !== undefined || input.currencyCode !== undefined) {
      const nextValue = input.estimatedValue ?? String(existing.estimatedValue);
      const nextCurrency = input.currencyCode ?? existing.currencyCode;
      snapshot = await this.computeSnapshot(organizationId, nextValue, nextCurrency);
    }

    const updated = await this.repository.update(organizationId, id, actorId, {
      ...input,
      contactId,
      ...snapshot,
    });
    if (!updated) {
      throw new NotFoundError("Tender not found");
    }

    await this.record(organizationId, actorId, "tenders.updated", "tender", id, meta, {
      tenderId: id,
      changes: input,
    });
    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    const removed = await this.repository.softDelete(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Tender not found");
    }
    await this.record(organizationId, actorId, "tenders.deleted", "tender", id, meta, {
      tenderId: id,
      tenderNumber: existing.tenderNumber,
      title: existing.title,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async restore(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const restored = await this.repository.restore(organizationId, id, actorId);
    if (!restored) {
      throw new NotFoundError("Deleted tender not found");
    }
    await this.record(organizationId, actorId, "tenders.restored", "tender", id, meta, { tenderId: id });
    return this.get(organizationId, id);
  }

  async listAudit(organizationId: string, id: string, limit: number, cursor?: string) {
    await this.get(organizationId, id);
    return this.audit.list(organizationId, limit, cursor, { entityType: "tender", entityId: id });
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

  private async requireCustomer(organizationId: string, customerId: string) {
    const customer = await this.repository.findCustomerForLink(organizationId, customerId);
    if (!customer) {
      throw new ValidationFailedError({ customerId: ["Choose a customer in this organization"] });
    }
    return customer;
  }

  private async requireContact(organizationId: string, contactId: string, customerId: string) {
    const contact = await this.repository.findContactForTender(organizationId, contactId);
    if (!contact) {
      throw new ValidationFailedError({ contactId: ["Choose a contact in this organization"] });
    }
    if (contact.customerId !== customerId) {
      throw new ValidationFailedError({ contactId: ["Choose a contact that belongs to the linked customer"] });
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
      module: TENDERS_MODULE,
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
  return permissions.includes("tenders:delete") || permissions.includes("tenders:restore");
}

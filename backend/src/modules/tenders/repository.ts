import { Prisma, type PrismaClient, type TenderStatus } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { allocateDocumentNumberIn } from "../../common/numbering/allocate";
import { buildTenderListWhere, type TenderListFilter } from "./list-filter";
import { decodeTenderCursor, tenderCursorWhere, type TenderSort } from "./page";

const tenderSelect = {
  id: true,
  organizationId: true,
  tenderNumber: true,
  title: true,
  description: true,
  referenceNumber: true,
  status: true,
  customerId: true,
  contactId: true,
  ownerUserId: true,
  estimatedValue: true,
  currencyCode: true,
  exchangeRateToBase: true,
  estimatedValueBase: true,
  baseCurrencyCode: true,
  submissionDeadline: true,
  expectedAwardDate: true,
  notes: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, customerNumber: true, displayName: true, status: true, email: true } },
  contact: { select: { id: true, displayName: true, email: true } },
  owner: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.TenderSelect;

export class TendersRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(
    filter: TenderListFilter,
    limit: number,
    sort: TenderSort,
    order: "asc" | "desc",
    cursor?: string,
  ) {
    const decoded = cursor ? decodeTenderCursor(cursor) : null;
    const where = buildTenderListWhere(filter);
    return this.db.tender.findMany({
      where: decoded && decoded.sort === sort ? { AND: [where, tenderCursorWhere(decoded, order)] } : where,
      orderBy: [{ [sort]: order }, { id: order }],
      take: limit + 1,
      select: tenderSelect,
    });
  }

  async findById(organizationId: string, id: string, includeDeleted = false) {
    return this.db.tender.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: tenderSelect,
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

  async listCustomerOptions(organizationId: string) {
    return this.db.customer.findMany({
      where: { organizationId, deletedAt: null, status: "ACTIVE" },
      orderBy: { displayName: "asc" },
      take: 250,
      select: { id: true, customerNumber: true, displayName: true, email: true },
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

  async findContactForTender(organizationId: string, contactId: string) {
    return this.db.contact.findFirst({
      where: { id: contactId, organizationId, deletedAt: null },
      select: { id: true, customerId: true, displayName: true },
    });
  }

  async create(organizationId: string, actorId: string, input: TenderCreateData) {
    const id = await this.transaction(async (tx) => {
      const tenderNumber = await allocateDocumentNumberIn(tx, organizationId, "TENDER");
      const created = await tx.tender.create({
        data: {
          organizationId,
          tenderNumber,
          title: input.title,
          description: input.description ?? null,
          referenceNumber: input.referenceNumber ?? null,
          status: (input.status as TenderStatus | undefined) ?? "DRAFT",
          customerId: input.customerId,
          contactId: input.contactId ?? null,
          ownerUserId: input.ownerUserId,
          estimatedValue: input.estimatedValue,
          currencyCode: input.currencyCode,
          exchangeRateToBase: input.exchangeRateToBase,
          estimatedValueBase: input.estimatedValueBase,
          baseCurrencyCode: input.baseCurrencyCode,
          submissionDeadline: input.submissionDeadline ? new Date(input.submissionDeadline) : null,
          expectedAwardDate: input.expectedAwardDate ? dateOnly(input.expectedAwardDate) : null,
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

  async update(organizationId: string, id: string, actorId: string, input: TenderUpdateData) {
    const existing = await this.findById(organizationId, id);
    if (!existing) {
      return null;
    }
    await this.db.tender.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.referenceNumber !== undefined ? { referenceNumber: input.referenceNumber ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status as TenderStatus } : {}),
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
        ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.estimatedValue !== undefined ? { estimatedValue: input.estimatedValue } : {}),
        ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
        ...(input.exchangeRateToBase !== undefined ? { exchangeRateToBase: input.exchangeRateToBase } : {}),
        ...(input.estimatedValueBase !== undefined ? { estimatedValueBase: input.estimatedValueBase } : {}),
        ...(input.baseCurrencyCode !== undefined ? { baseCurrencyCode: input.baseCurrencyCode } : {}),
        ...(input.submissionDeadline !== undefined
          ? { submissionDeadline: input.submissionDeadline ? new Date(input.submissionDeadline) : null }
          : {}),
        ...(input.expectedAwardDate !== undefined
          ? { expectedAwardDate: input.expectedAwardDate ? dateOnly(input.expectedAwardDate) : null }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        updatedById: actorId,
      },
    });
    return this.findById(organizationId, id);
  }

  async softDelete(organizationId: string, id: string, actorId: string) {
    const result = await this.db.tender.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
  }

  async restore(organizationId: string, id: string, actorId: string) {
    const result = await this.db.tender.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null, updatedById: actorId },
    });
    return result.count === 1;
  }
}

export interface TenderCreateData {
  title: string;
  description?: string;
  referenceNumber?: string;
  status?: string;
  customerId: string;
  contactId?: string;
  ownerUserId: string;
  estimatedValue: string;
  currencyCode: string;
  exchangeRateToBase: string;
  estimatedValueBase: string;
  baseCurrencyCode: string;
  submissionDeadline?: string;
  expectedAwardDate?: string;
  notes?: string;
}

export interface TenderUpdateData {
  title?: string;
  description?: string | null;
  referenceNumber?: string | null;
  status?: string;
  customerId?: string;
  contactId?: string | null;
  ownerUserId?: string;
  estimatedValue?: string;
  currencyCode?: string;
  exchangeRateToBase?: string;
  estimatedValueBase?: string;
  baseCurrencyCode?: string;
  submissionDeadline?: string | null;
  expectedAwardDate?: string | null;
  notes?: string | null;
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function utcDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

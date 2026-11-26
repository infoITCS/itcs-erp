import { Prisma, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { ConflictError } from "../../common/errors/app-error";
import { buildVendorListWhere, type VendorListFilter } from "./list-filter";
import { decodeVendorCursor, vendorCursorWhere, type VendorSort } from "./page";
import type { CreateVendorInput, UpdateVendorInput } from "./validation";

const vendorSummarySelect = {
  id: true,
  organizationId: true,
  vendorNumber: true,
  code: true,
  name: true,
  legalName: true,
  displayName: true,
  status: true,
  vendorType: true,
  category: true,
  currencyCode: true,
  paymentTermId: true,
  taxCodeId: true,
  email: true,
  phone: true,
  city: true,
  countryCode: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VendorSelect;

const vendorSelect = {
  id: true,
  organizationId: true,
  vendorNumber: true,
  code: true,
  name: true,
  legalName: true,
  displayName: true,
  status: true,
  vendorType: true,
  category: true,
  currencyCode: true,
  paymentTermId: true,
  taxCodeId: true,
  taxId: true,
  registrationNumber: true,
  website: true,
  email: true,
  phone: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  stateProvince: true,
  postalCode: true,
  countryCode: true,
  bankAccount: true,
  notes: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  currency: { select: { code: true, name: true } },
  paymentTerm: { select: { id: true, code: true, name: true, dueDays: true } },
  taxCode: { select: { id: true, code: true, name: true, rate: true } },
} satisfies Prisma.VendorSelect;

export type VendorRecord = Prisma.VendorGetPayload<{ select: typeof vendorSelect }>;

export class VendorsRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(filter: VendorListFilter, limit: number, sort: VendorSort, order: "asc" | "desc", cursor?: string) {
    const decoded = cursor ? decodeVendorCursor(cursor) : null;
    const where = buildVendorListWhere(filter);
    return this.db.vendor.findMany({
      where: decoded && decoded.sort === sort ? { AND: [where, vendorCursorWhere(decoded, order)] } : where,
      orderBy: [{ [sort]: order }, { id: order }],
      take: limit + 1,
      select: vendorSummarySelect,
    });
  }

  async findById(organizationId: string, id: string, includeDeleted = false) {
    return this.db.vendor.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: vendorSelect,
    });
  }

  async codeExists(organizationId: string, code: string, exceptId?: string): Promise<boolean> {
    const row = await this.db.vendor.findFirst({
      where: {
        organizationId,
        code,
        deletedAt: null,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true },
    });
    return row !== null;
  }

  async currencyIsActive(code: string): Promise<boolean> {
    const currency = await this.db.currency.findUnique({ where: { code }, select: { isActive: true } });
    return currency?.isActive === true;
  }

  async findPaymentTerm(organizationId: string, id: string) {
    return this.db.paymentTerm.findFirst({
      where: { id, organizationId, isActive: true },
      select: { id: true, code: true, name: true, dueDays: true },
    });
  }

  async findTaxCode(organizationId: string, id: string) {
    return this.db.taxCode.findFirst({
      where: { id, organizationId, isActive: true },
      select: { id: true, code: true, name: true, rate: true },
    });
  }

  async formOptions(organizationId: string) {
    const [currencies, paymentTerms, taxCodes] = await Promise.all([
      this.db.currency.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
        select: { code: true, name: true },
      }),
      this.db.paymentTerm.findMany({
        where: { organizationId, isActive: true },
        orderBy: [{ dueDays: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true, dueDays: true },
      }),
      this.db.taxCode.findMany({
        where: { organizationId, isActive: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true, rate: true },
      }),
    ]);
    return { currencies, paymentTerms, taxCodes };
  }

  async create(organizationId: string, actorId: string, input: CreateVendorInput) {
    try {
      return await this.transaction(async (tx) => {
        const vendorNumber = await this.nextVendorNumber(tx, organizationId);
        return tx.vendor.create({
          data: {
            organizationId,
            vendorNumber,
            code: input.code ?? null,
            name: input.name,
            legalName: input.legalName ?? null,
            displayName: input.displayName ?? null,
            status: input.status ?? "ACTIVE",
            vendorType: input.vendorType ?? null,
            category: input.category ?? null,
            currencyCode: input.currencyCode,
            paymentTermId: input.paymentTermId ?? null,
            taxCodeId: input.taxCodeId ?? null,
            taxId: input.taxId ?? null,
            registrationNumber: input.registrationNumber ?? null,
            website: input.website ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            addressLine1: input.addressLine1 ?? null,
            addressLine2: input.addressLine2 ?? null,
            city: input.city ?? null,
            stateProvince: input.stateProvince ?? null,
            postalCode: input.postalCode ?? null,
            countryCode: input.countryCode ?? null,
            bankAccount: input.bankAccount ?? null,
            notes: input.notes ?? null,
            createdById: actorId,
            updatedById: actorId,
          },
          select: vendorSelect,
        });
      });
    } catch (error) {
      throw mapConflict(error, "A vendor with this number already exists");
    }
  }

  async update(organizationId: string, id: string, actorId: string, input: UpdateVendorInput) {
    const existing = await this.findById(organizationId, id);
    if (!existing) {
      return null;
    }
    try {
      await this.db.vendor.update({
        where: { id, organizationId },
        data: {
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.vendorType !== undefined ? { vendorType: input.vendorType } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
          ...(input.paymentTermId !== undefined ? { paymentTermId: input.paymentTermId } : {}),
          ...(input.taxCodeId !== undefined ? { taxCodeId: input.taxCodeId } : {}),
          ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
          ...(input.registrationNumber !== undefined ? { registrationNumber: input.registrationNumber } : {}),
          ...(input.website !== undefined ? { website: input.website } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
          ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.stateProvince !== undefined ? { stateProvince: input.stateProvince } : {}),
          ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
          ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
          ...(input.bankAccount !== undefined ? { bankAccount: input.bankAccount } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedById: actorId,
        },
      });
      return this.findById(organizationId, id);
    } catch (error) {
      throw mapConflict(error, "A vendor with this code already exists");
    }
  }

  async softDelete(organizationId: string, id: string, actorId: string) {
    const result = await this.db.vendor.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
  }

  async restore(organizationId: string, id: string, actorId: string) {
    const result = await this.db.vendor.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null, updatedById: actorId },
    });
    return result.count === 1;
  }

  private async nextVendorNumber(tx: Prisma.TransactionClient, organizationId: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `VEN-${year}-`;
    const hex = organizationId.replaceAll("-", "");
    const high = Number.parseInt(hex.slice(0, 8), 16) | 0;
    const low = Number.parseInt(hex.slice(8, 16), 16) | 0;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${high}::int, ${low}::int)`;
    const row = await tx.vendor.findFirst({
      where: { organizationId, vendorNumber: { startsWith: prefix } },
      orderBy: { vendorNumber: "desc" },
      select: { vendorNumber: true },
    });
    const suffix = row ? Number.parseInt(row.vendorNumber.slice(prefix.length), 10) : 0;
    const next = Number.isFinite(suffix) ? suffix + 1 : 1;
    return `${prefix}${String(next).padStart(5, "0")}`;
  }
}

function mapConflict(error: unknown, message: string): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictError(message);
  }
  return error;
}

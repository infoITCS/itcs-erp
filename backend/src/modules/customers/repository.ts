import { Prisma, type AddressPurpose, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { ConflictError } from "../../common/errors/app-error";
import { allocateDocumentNumberIn } from "../../common/numbering/allocate";
import type { AddressInput, CreateCustomerInput, UpdateCustomerInput } from "./validation";
import { buildCustomerListWhere, type CustomerListFilter } from "./list-filter";
import { customerCursorWhere, decodeCustomerCursor, type CustomerSort } from "./page";
import { contactDisplayName } from "../contacts/names";

const customerSelect = {
  id: true,
  customerNumber: true,
  customerType: true,
  legalName: true,
  displayName: true,
  email: true,
  phone: true,
  website: true,
  countryCode: true,
  currencyCode: true,
  taxNumber: true,
  status: true,
  notes: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerSelect;

const addressSelect = {
  id: true,
  customerId: true,
  purpose: true,
  isPrimary: true,
  label: true,
  line1: true,
  line2: true,
  city: true,
  region: true,
  postalCode: true,
  countryCode: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerAddressSelect;

export type CustomerRecord = Prisma.CustomerGetPayload<{ select: typeof customerSelect }>;
export type AddressRecord = Prisma.CustomerAddressGetPayload<{ select: typeof addressSelect }>;

export class CustomersRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(
    filter: CustomerListFilter,
    limit: number,
    sort: CustomerSort,
    order: "asc" | "desc",
    cursor?: string,
  ) {
    const decoded = cursor ? decodeCustomerCursor(cursor) : null;
    const where = buildCustomerListWhere(filter);
    return this.db.customer.findMany({
      where: decoded && decoded.sort === sort ? { AND: [where, customerCursorWhere(decoded, order)] } : where,
      orderBy: [{ [sort]: order }, { id: order }],
      take: limit + 1,
      select: {
        ...customerSelect,
        contacts: {
          where: { isPrimary: true, deletedAt: null },
          take: 1,
          select: { id: true, displayName: true, email: true },
        },
      },
    });
  }

  async findById(organizationId: string, id: string, includeDeleted = false) {
    return this.db.customer.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: {
        ...customerSelect,
        addresses: {
          where: { deletedAt: null },
          orderBy: [{ purpose: "asc" }, { isPrimary: "desc" }],
          select: addressSelect,
        },
      },
    });
  }

  async emailExists(organizationId: string, email: string, exceptId?: string): Promise<boolean> {
    const row = await this.db.customer.findFirst({
      where: {
        organizationId,
        email,
        deletedAt: null,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true },
    });
    return row !== null;
  }

  async currencyIsActive(code: string): Promise<boolean> {
    const currency = await this.db.currency.findUnique({
      where: { code },
      select: { isActive: true },
    });
    return currency?.isActive === true;
  }

  async create(organizationId: string, actorId: string, input: CreateCustomerInput) {
    try {
      return await this.transaction(async (tx) => {
        const customerNumber = await allocateDocumentNumberIn(tx, organizationId, "CUSTOMER");
        return tx.customer.create({
          data: {
            organizationId,
            customerNumber,
            customerType: input.customerType,
            legalName: input.legalName,
            displayName: input.displayName,
            email: input.email ?? null,
            phone: input.phone ?? null,
            website: input.website ?? null,
            countryCode: input.countryCode,
            currencyCode: input.currencyCode,
            taxNumber: input.taxNumber ?? null,
            status: input.status ?? "ACTIVE",
            notes: input.notes ?? null,
            createdById: actorId,
            updatedById: actorId,
            addresses: input.addresses?.length
              ? {
                  create: input.addresses.map((address) => addressData(organizationId, actorId, address)),
                }
              : undefined,
            contacts: input.primaryContact
              ? {
                  create: {
                    organizationId,
                    firstName: input.primaryContact.firstName,
                    lastName: input.primaryContact.lastName,
                    displayName: contactDisplayName(
                      input.primaryContact.firstName,
                      input.primaryContact.lastName,
                      input.primaryContact.displayName,
                    ),
                    jobTitle: input.primaryContact.jobTitle ?? null,
                    department: input.primaryContact.department ?? null,
                    email: input.primaryContact.email ?? null,
                    phone: input.primaryContact.phone ?? null,
                    mobile: input.primaryContact.mobile ?? null,
                    isPrimary: true,
                    notes: input.primaryContact.notes ?? null,
                    createdById: actorId,
                    updatedById: actorId,
                  },
                }
              : undefined,
          },
          select: {
            ...customerSelect,
            addresses: { select: addressSelect },
            contacts: { select: { id: true, displayName: true, email: true, isPrimary: true } },
          },
        });
      });
    } catch (error) {
      throw mapConflict(error, "A customer with this number already exists");
    }
  }

  async update(organizationId: string, id: string, actorId: string, input: UpdateCustomerInput) {
    const existing = await this.findById(organizationId, id);
    if (!existing) {
      return null;
    }
    return this.db.customer.update({
      where: { id },
      data: {
        ...(input.customerType !== undefined ? { customerType: input.customerType } : {}),
        ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.email !== undefined ? { email: input.email ?? null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
        ...(input.website !== undefined ? { website: input.website ?? null } : {}),
        ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
        ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
        ...(input.taxNumber !== undefined ? { taxNumber: input.taxNumber ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        updatedById: actorId,
      },
      select: customerSelect,
    });
  }

  async softDelete(organizationId: string, id: string, actorId: string) {
    const result = await this.db.customer.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
  }

  async restore(organizationId: string, id: string, actorId: string) {
    const result = await this.db.customer.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null, updatedById: actorId },
    });
    return result.count === 1;
  }

  async listAddresses(organizationId: string, customerId: string) {
    return this.db.customerAddress.findMany({
      where: { organizationId, customerId, deletedAt: null },
      orderBy: [{ purpose: "asc" }, { isPrimary: "desc" }],
      select: addressSelect,
    });
  }

  async createAddress(organizationId: string, customerId: string, actorId: string, input: AddressInput) {
    try {
      return await this.transaction(async (tx) => {
        if (input.isPrimary) {
          await tx.customerAddress.updateMany({
            where: { customerId, organizationId, purpose: input.purpose, deletedAt: null, isPrimary: true },
            data: { isPrimary: false, updatedById: actorId },
          });
        }
        return tx.customerAddress.create({
          data: { customerId, ...addressData(organizationId, actorId, input) },
          select: addressSelect,
        });
      });
    } catch (error) {
      throw mapConflict(error, "This customer already has a primary address for that purpose");
    }
  }

  async updateAddress(
    organizationId: string,
    customerId: string,
    addressId: string,
    actorId: string,
    input: AddressInput,
  ) {
    const current = await this.db.customerAddress.findFirst({
      where: { id: addressId, customerId, organizationId, deletedAt: null },
      select: { id: true, purpose: true },
    });
    if (!current) {
      return null;
    }
    try {
      return await this.transaction(async (tx) => {
        const purpose = input.purpose;
        if (input.isPrimary) {
          await tx.customerAddress.updateMany({
            where: {
              customerId,
              organizationId,
              purpose,
              deletedAt: null,
              isPrimary: true,
              NOT: { id: addressId },
            },
            data: { isPrimary: false, updatedById: actorId },
          });
        }
        return tx.customerAddress.update({
          where: { id: addressId },
          data: {
            purpose: input.purpose,
            isPrimary: input.isPrimary ?? false,
            label: input.label ?? null,
            line1: input.line1,
            line2: input.line2 ?? null,
            city: input.city,
            region: input.region ?? null,
            postalCode: input.postalCode ?? null,
            countryCode: input.countryCode,
            updatedById: actorId,
          },
          select: addressSelect,
        });
      });
    } catch (error) {
      throw mapConflict(error, "This customer already has a primary address for that purpose");
    }
  }

  async softDeleteAddress(organizationId: string, customerId: string, addressId: string, actorId: string) {
    const existing = await this.db.customerAddress.findFirst({
      where: { id: addressId, customerId, organizationId, deletedAt: null },
      select: addressSelect,
    });
    if (!existing) {
      return null;
    }
    await this.db.customerAddress.update({
      where: { id: addressId },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return existing;
  }
}

function addressData(organizationId: string, actorId: string, input: AddressInput) {
  return {
    organizationId,
    purpose: input.purpose as AddressPurpose,
    isPrimary: input.isPrimary ?? false,
    label: input.label ?? null,
    line1: input.line1,
    line2: input.line2 ?? null,
    city: input.city,
    region: input.region ?? null,
    postalCode: input.postalCode ?? null,
    countryCode: input.countryCode,
    createdById: actorId,
    updatedById: actorId,
  };
}

function mapConflict(error: unknown, message: string): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictError(message);
  }
  return error;
}

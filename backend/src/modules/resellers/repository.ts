import { Prisma, type AddressPurpose, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { ConflictError } from "../../common/errors/app-error";
import { allocateDocumentNumberIn } from "../../common/numbering/allocate";
import { cursorFilter, decodeCursor } from "../../common/pagination/cursor";
import { contactDisplayName } from "../contacts/names";
import { buildResellerListWhere, type ResellerListFilter } from "./list-filter";
import { decodeResellerCursor, resellerCursorWhere, type ResellerSort } from "./page";
import type {
  AddressInput,
  ContactBody,
  CreateResellerInput,
  UpdateAddressInput,
  UpdateContactInput,
  UpdateResellerInput,
} from "./validation";

const countryCodes = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");

const resellerSelect = {
  id: true,
  resellerNumber: true,
  legalName: true,
  displayName: true,
  email: true,
  phone: true,
  website: true,
  countryCode: true,
  currencyCode: true,
  taxNumber: true,
  status: true,
  priceListCode: true,
  defaultDiscountPercent: true,
  defaultCommissionPercent: true,
  notes: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ResellerSelect;

const addressSelect = {
  id: true,
  resellerId: true,
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
} satisfies Prisma.ResellerAddressSelect;

const contactSelect = {
  id: true,
  resellerId: true,
  firstName: true,
  lastName: true,
  displayName: true,
  jobTitle: true,
  department: true,
  email: true,
  phone: true,
  mobile: true,
  isPrimary: true,
  status: true,
  notes: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ResellerContactSelect;

export class ResellersRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(filter: ResellerListFilter, limit: number, sort: ResellerSort, order: "asc" | "desc", cursor?: string) {
    const decoded = cursor ? decodeResellerCursor(cursor) : null;
    const where = buildResellerListWhere(filter);
    return this.db.reseller.findMany({
      where: decoded && decoded.sort === sort ? { AND: [where, resellerCursorWhere(decoded, order)] } : where,
      orderBy: [{ [sort]: order }, { id: order }],
      take: limit + 1,
      select: {
        ...resellerSelect,
        contacts: {
          where: { isPrimary: true, deletedAt: null },
          take: 1,
          select: { id: true, displayName: true, email: true },
        },
        _count: { select: { customers: { where: { deletedAt: null } } } },
      },
    });
  }

  async findById(organizationId: string, id: string, includeDeleted = false) {
    return this.db.reseller.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: {
        ...resellerSelect,
        addresses: {
          where: { deletedAt: null },
          orderBy: [{ purpose: "asc" }, { isPrimary: "desc" }],
          select: addressSelect,
        },
        contacts: {
          where: { deletedAt: null },
          orderBy: [{ isPrimary: "desc" }, { displayName: "asc" }],
          select: contactSelect,
        },
        _count: { select: { customers: { where: { deletedAt: null } } } },
      },
    });
  }

  async currencyIsActive(code: string): Promise<boolean> {
    const currency = await this.db.currency.findUnique({ where: { code }, select: { isActive: true } });
    return currency?.isActive === true;
  }

  async emailExists(organizationId: string, email: string | null | undefined, exceptId?: string): Promise<boolean> {
    if (!email) {
      return false;
    }
    const row = await this.db.reseller.findFirst({
      where: {
        organizationId,
        email: { equals: email, mode: "insensitive" },
        deletedAt: null,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true },
    });
    return row !== null;
  }

  async displayNameExists(organizationId: string, displayName: string | null | undefined, exceptId?: string): Promise<boolean> {
    if (!displayName) {
      return false;
    }
    const row = await this.db.reseller.findFirst({
      where: {
        organizationId,
        displayName: { equals: displayName, mode: "insensitive" },
        deletedAt: null,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true },
    });
    return row !== null;
  }

  async formOptions(organizationId: string) {
    const [currencies, rows] = await Promise.all([
      this.db.currency.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
        select: { code: true, name: true },
      }),
      this.db.reseller.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: [{ countryCode: "asc" }, { priceListCode: "asc" }],
        select: { countryCode: true, priceListCode: true },
      }),
    ]);
    return {
      currencies,
      countries: [...countryCodes].sort(),
      priceLists: [...new Set(rows.map((row) => row.priceListCode))].sort(),
    };
  }

  async create(organizationId: string, actorId: string, input: CreateResellerInput) {
    try {
      const id = await this.transaction(async (tx) => {
        const resellerNumber = await allocateDocumentNumberIn(tx, organizationId, "RESELLER");
        const created = await tx.reseller.create({
          data: {
            organizationId,
            resellerNumber,
            legalName: input.legalName,
            displayName: input.displayName,
            email: input.email ?? null,
            phone: input.phone ?? null,
            website: input.website ?? null,
            countryCode: input.countryCode,
            currencyCode: input.currencyCode,
            taxNumber: input.taxNumber ?? null,
            status: input.status ?? "ACTIVE",
            priceListCode: input.priceListCode ?? "STANDARD",
            defaultDiscountPercent: input.defaultDiscountPercent ?? null,
            defaultCommissionPercent: input.defaultCommissionPercent ?? null,
            notes: input.notes ?? null,
            createdById: actorId,
            updatedById: actorId,
            addresses: input.addresses?.length
              ? { create: input.addresses.map((address) => addressData(organizationId, actorId, address)) }
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
                      input.primaryContact.displayName ?? undefined,
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
          select: { id: true },
        });
        return created.id;
      });
      return this.findById(organizationId, id);
    } catch (error) {
      throw mapConflict(error, "A reseller with this number already exists");
    }
  }

  async update(organizationId: string, id: string, actorId: string, input: UpdateResellerInput) {
    const existing = await this.findById(organizationId, id);
    if (!existing) {
      return null;
    }
    await this.db.reseller.update({
      where: { id, organizationId },
      data: {
        ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.email !== undefined ? { email: input.email ?? null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
        ...(input.website !== undefined ? { website: input.website ?? null } : {}),
        ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
        ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
        ...(input.taxNumber !== undefined ? { taxNumber: input.taxNumber ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priceListCode !== undefined ? { priceListCode: input.priceListCode } : {}),
        ...(input.defaultDiscountPercent !== undefined
          ? { defaultDiscountPercent: input.defaultDiscountPercent }
          : {}),
        ...(input.defaultCommissionPercent !== undefined
          ? { defaultCommissionPercent: input.defaultCommissionPercent }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        updatedById: actorId,
      },
    });
    return this.findById(organizationId, id);
  }

  async softDelete(organizationId: string, id: string, actorId: string) {
    const result = await this.db.reseller.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
  }

  async restore(organizationId: string, id: string, actorId: string) {
    const result = await this.db.reseller.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null, updatedById: actorId },
    });
    return result.count === 1;
  }

  async listAddresses(organizationId: string, resellerId: string) {
    return this.db.resellerAddress.findMany({
      where: { organizationId, resellerId, deletedAt: null },
      orderBy: [{ purpose: "asc" }, { isPrimary: "desc" }],
      select: addressSelect,
    });
  }

  async createAddress(organizationId: string, resellerId: string, actorId: string, input: AddressInput) {
    try {
      return await this.transaction(async (tx) => {
        if (input.isPrimary) {
          await tx.resellerAddress.updateMany({
            where: { resellerId, organizationId, purpose: input.purpose, deletedAt: null, isPrimary: true },
            data: { isPrimary: false, updatedById: actorId },
          });
        }
        return tx.resellerAddress.create({
          data: { resellerId, ...addressData(organizationId, actorId, input) },
          select: addressSelect,
        });
      });
    } catch (error) {
      throw mapConflict(error, "This reseller already has a primary address for that purpose");
    }
  }

  async updateAddress(
    organizationId: string,
    resellerId: string,
    addressId: string,
    actorId: string,
    input: UpdateAddressInput,
  ) {
    const current = await this.db.resellerAddress.findFirst({
      where: { id: addressId, resellerId, organizationId, deletedAt: null },
      select: addressSelect,
    });
    if (!current) {
      return null;
    }
    const purpose = input.purpose ?? current.purpose;
    const isPrimary = input.isPrimary ?? current.isPrimary;
    try {
      return await this.transaction(async (tx) => {
        if (isPrimary) {
          await tx.resellerAddress.updateMany({
            where: {
              resellerId,
              organizationId,
              purpose,
              deletedAt: null,
              isPrimary: true,
              NOT: { id: addressId },
            },
            data: { isPrimary: false, updatedById: actorId },
          });
        }
        return tx.resellerAddress.update({
          where: { id: addressId, resellerId, organizationId },
          data: {
            purpose,
            isPrimary,
            label: input.label !== undefined ? input.label ?? null : current.label,
            line1: input.line1 ?? current.line1,
            line2: input.line2 !== undefined ? input.line2 ?? null : current.line2,
            city: input.city ?? current.city,
            region: input.region !== undefined ? input.region ?? null : current.region,
            postalCode: input.postalCode !== undefined ? input.postalCode ?? null : current.postalCode,
            countryCode: input.countryCode ?? current.countryCode,
            updatedById: actorId,
          },
          select: addressSelect,
        });
      });
    } catch (error) {
      throw mapConflict(error, "This reseller already has a primary address for that purpose");
    }
  }

  async softDeleteAddress(organizationId: string, resellerId: string, addressId: string, actorId: string) {
    const existing = await this.db.resellerAddress.findFirst({
      where: { id: addressId, resellerId, organizationId, deletedAt: null },
      select: addressSelect,
    });
    if (!existing) {
      return null;
    }
    await this.db.resellerAddress.update({
      where: { id: addressId, resellerId, organizationId },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return existing;
  }

  async listContacts(organizationId: string, resellerId: string, limit: number, cursor?: string, includeDeleted = false) {
    const decoded = cursor ? decodeCursor(cursor) : null;
    return this.db.resellerContact.findMany({
      where: {
        organizationId,
        resellerId,
        ...(includeDeleted ? {} : { deletedAt: null }),
        ...(decoded ? cursorFilter(decoded, "desc") : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: contactSelect,
    });
  }

  async findContact(organizationId: string, id: string, includeDeleted = false) {
    return this.db.resellerContact.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: contactSelect,
    });
  }

  async findPrimaryContact(organizationId: string, resellerId: string) {
    return this.db.resellerContact.findFirst({
      where: { organizationId, resellerId, deletedAt: null, isPrimary: true },
      select: { id: true },
    });
  }

  async createContact(organizationId: string, resellerId: string, actorId: string, input: ContactBody) {
    try {
      return await this.transaction(async (tx) => {
        if (input.isPrimary) {
          await tx.resellerContact.updateMany({
            where: { organizationId, resellerId, deletedAt: null, isPrimary: true },
            data: { isPrimary: false, updatedById: actorId },
          });
        }
        return tx.resellerContact.create({
          data: {
            organizationId,
            resellerId,
            firstName: input.firstName,
            lastName: input.lastName,
            displayName: contactDisplayName(input.firstName, input.lastName, input.displayName ?? undefined),
            jobTitle: input.jobTitle ?? null,
            department: input.department ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            mobile: input.mobile ?? null,
            isPrimary: input.isPrimary ?? false,
            status: input.status ?? "ACTIVE",
            notes: input.notes ?? null,
            createdById: actorId,
            updatedById: actorId,
          },
          select: contactSelect,
        });
      });
    } catch (error) {
      throw mapConflict(error, "This reseller already has a primary contact");
    }
  }

  async updateContact(organizationId: string, id: string, actorId: string, input: UpdateContactInput) {
    const existing = await this.findContact(organizationId, id);
    if (!existing) {
      return null;
    }
    const firstName = input.firstName ?? existing.firstName;
    const lastName = input.lastName ?? existing.lastName;
    try {
      return await this.transaction(async (tx) => {
        if (input.isPrimary) {
          await tx.resellerContact.updateMany({
            where: {
              organizationId,
              resellerId: existing.resellerId,
              deletedAt: null,
              isPrimary: true,
              NOT: { id },
            },
            data: { isPrimary: false, updatedById: actorId },
          });
        }
        return tx.resellerContact.update({
          where: { id, organizationId, resellerId: existing.resellerId },
          data: {
            ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
            ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
            ...(input.firstName !== undefined || input.lastName !== undefined || input.displayName !== undefined
              ? { displayName: contactDisplayName(firstName, lastName, input.displayName ?? existing.displayName) }
              : {}),
            ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle ?? null } : {}),
            ...(input.department !== undefined ? { department: input.department ?? null } : {}),
            ...(input.email !== undefined ? { email: input.email ?? null } : {}),
            ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
            ...(input.mobile !== undefined ? { mobile: input.mobile ?? null } : {}),
            ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
            updatedById: actorId,
          },
          select: contactSelect,
        });
      });
    } catch (error) {
      throw mapConflict(error, "This reseller already has a primary contact");
    }
  }

  async softDeleteContact(organizationId: string, id: string, actorId: string) {
    const existing = await this.findContact(organizationId, id);
    if (!existing) {
      return null;
    }
    await this.db.resellerContact.update({
      where: { id, organizationId, resellerId: existing.resellerId },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return existing;
  }

  async listCustomers(organizationId: string, resellerId: string, limit: number, cursor?: string) {
    const decoded = cursor ? decodeCursor(cursor) : null;
    return this.db.customer.findMany({
      where: {
        organizationId,
        resellerId,
        deletedAt: null,
        ...(decoded ? cursorFilter(decoded, "desc") : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        customerNumber: true,
        displayName: true,
        legalName: true,
        status: true,
        email: true,
        countryCode: true,
        createdAt: true,
      },
    });
  }

  async findCustomerForAssign(organizationId: string, customerId: string) {
    return this.db.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: {
        id: true,
        displayName: true,
        legalName: true,
        customerNumber: true,
        status: true,
        email: true,
        countryCode: true,
        createdAt: true,
        resellerId: true,
      },
    });
  }

  async assignCustomer(organizationId: string, resellerId: string, customerId: string, actorId: string) {
    const result = await this.db.customer.updateMany({
      where: { id: customerId, organizationId, deletedAt: null, resellerId: null },
      data: { resellerId, updatedById: actorId },
    });
    if (result.count !== 1) {
      throw new ConflictError("This customer was assigned to another reseller");
    }
    return true;
  }

  async unassignCustomer(organizationId: string, resellerId: string, customerId: string, actorId: string) {
    const result = await this.db.customer.updateMany({
      where: { id: customerId, organizationId, resellerId, deletedAt: null },
      data: { resellerId: null, updatedById: actorId },
    });
    return result.count === 1;
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

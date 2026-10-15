import { Prisma, type AddressPurpose, type PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { BaseRepository } from "../../common/database/base-repository";
import { ConflictError } from "../../common/errors/app-error";
import { allocateDocumentNumberIn } from "../../common/numbering/allocate";
import type { AddressInput, CreateAccountingCategoryInput, CreateCustomerInput, CreatePaymentTermInput, UpdateCustomerInput } from "./validation";
import { buildCustomerListWhere, type CustomerListFilter } from "./list-filter";
import { customerCursorWhere, decodeCustomerCursor, type CustomerSort } from "./page";
import { contactDisplayName } from "../contacts/names";

const customerSelect = {
  id: true,
  customerNumber: true,
  customerCode: true,
  entityType: true,
  customerType: true,
  customerCategory: true,
  industry: true,
  employeeCount: true,
  incorporationStatus: true,
  businessRegistrationDate: true,
  registrationNumber: true,
  rating: true,
  priority: true,
  sameAsBilling: true,
  leadSource: true,
  assignedSalesRepId: true,
  legalName: true,
  displayName: true,
  middleName: true,
  email: true,
  phone: true,
  website: true,
  countryCode: true,
  currencyCode: true,
  taxNumber: true,
  taxIdType: true,
  taxExemptionCode: true,
  defaultTaxCodeId: true,
  taxExempt: true,
  pricesIncludeTax: true,
  emailMarketingOptIn: true,
  creditHold: true,
  status: true,
  creditLimit: true,
  preferredPaymentMethod: true,
  preferredCommunicationChannel: true,
  paymentTermId: true,
  pricingGroupId: true,
  accountingCategoryId: true,
  openingBalance: true,
  openingBalanceDate: true,
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
  latitude: true,
  longitude: true,
  geofenceRadiusMeters: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerAddressSelect;

const customerDetailSelect = {
  ...customerSelect,
  identityDocumentType: true,
  identityDocumentNumber: true,
  accountingCategory: { select: { id: true, code: true, name: true } },
  addresses: {
    where: { deletedAt: null },
    orderBy: [{ purpose: "asc" }, { isPrimary: "desc" }],
    select: addressSelect,
  },
  contacts: {
    where: { deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      customerId: true,
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
      emailOptIn: true,
      phoneOptIn: true,
      smsOptIn: true,
      whatsappOptIn: true,
      notes: true,
      roleAssignments: { select: { role: true } },
    },
  },
} satisfies Prisma.CustomerSelect;

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
      select: customerDetailSelect,
    });
  }

  async emailExists(
    organizationId: string,
    email: string,
    exceptId?: string,
    client: PrismaClient | Prisma.TransactionClient = this.db,
  ): Promise<boolean> {
    const row = await client.customer.findFirst({
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

  async currencyIsActive(code: string): Promise<boolean> {
    const currency = await this.db.currency.findUnique({
      where: { code },
      select: { isActive: true },
    });
    return currency?.isActive === true;
  }

  async formOptions(organizationId: string) {
    const [salesReps, paymentTerms, pricingGroups, taxCodes, accountingCategories] = await Promise.all([
      this.db.user.findMany({
        where: { status: "ACTIVE", memberships: { some: { organizationId, status: "ACTIVE" } } },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      this.db.paymentTerm.findMany({
        where: { organizationId, isActive: true },
        orderBy: [{ dueDays: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true, dueDays: true, requiresPrepayment: true },
      }),
      this.db.customerPricingGroup.findMany({
        where: { organizationId, isActive: true },
        orderBy: [{ groupType: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true, groupType: true, discountPercent: true },
      }),
      this.db.taxCode.findMany({
        where: { organizationId, isActive: true },
        orderBy: [{ code: "asc" }],
        select: { id: true, code: true, name: true, rate: true },
      }),
      this.db.accountingCategory.findMany({
        where: { organizationId, isActive: true },
        orderBy: [{ code: "asc" }],
        select: { id: true, code: true, name: true },
      }),
    ]);
    return { salesReps, paymentTerms, pricingGroups, taxCodes, accountingCategories };
  }

  async createPaymentTerm(organizationId: string, input: CreatePaymentTermInput) {
    return this.db.paymentTerm.create({
      data: {
        organizationId,
        code: `CUSTOMER_${randomUUID().replaceAll("-", "").slice(0, 23).toUpperCase()}`,
        name: input.name,
        dueDays: input.dueDays,
        requiresPrepayment: input.requiresPrepayment,
      },
      select: { id: true, code: true, name: true, dueDays: true, requiresPrepayment: true },
    });
  }

  async createAccountingCategory(organizationId: string, input: CreateAccountingCategoryInput) {
    return this.db.accountingCategory.create({
      data: {
        organizationId,
        code: input.code ?? `ACCT_${randomUUID().replaceAll("-", "").slice(0, 23).toUpperCase()}`,
        name: input.name,
      },
      select: { id: true, code: true, name: true },
    });
  }

  async create(organizationId: string, actorId: string, input: CreateCustomerInput) {
    try {
      return await this.transaction((tx) => this.createIn(tx, organizationId, actorId, input));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        if (input.email && await this.emailExists(organizationId, input.email)) {
          throw new ConflictError("A customer with this email already exists");
        }
        throw new ConflictError("A customer with this number already exists");
      }
      throw mapConflict(error, "A customer with this number already exists");
    }
  }

  /**
   * Creates a customer using the caller's transaction client so other modules (e.g. opportunities
   * converting a prospect) can create a customer and link it to their own row atomically.
   */
  async createIn(tx: Prisma.TransactionClient, organizationId: string, actorId: string, input: CreateCustomerInput) {
    const customerNumber = await allocateDocumentNumberIn(tx, organizationId, "CUSTOMER");
    const contacts = input.contacts?.length
      ? input.contacts
      : input.primaryContact
        ? [{
            ...input.primaryContact,
            role: undefined,
            isPrimary: true,
            emailOptIn: false,
            phoneOptIn: false,
            smsOptIn: false,
            whatsappOptIn: false,
          }]
        : [];
    return tx.customer.create({
      data: {
        organizationId,
        customerNumber,
        customerCode: input.customerCode ?? null,
        entityType: input.entityType,
        customerType: input.customerType,
        customerCategory: input.customerCategory ?? null,
        industry: input.industry ?? null,
        employeeCount: input.employeeCount ?? null,
        incorporationStatus: input.incorporationStatus ?? null,
        businessRegistrationDate: input.businessRegistrationDate ? new Date(input.businessRegistrationDate) : null,
        registrationNumber: input.registrationNumber ?? null,
        rating: input.rating ?? null,
        priority: input.priority,
        sameAsBilling: input.sameAsBilling,
        leadSource: input.leadSource ?? null,
        assignedSalesRepId: input.assignedSalesRepId ?? null,
        legalName: input.legalName,
        displayName: input.displayName,
        middleName: input.middleName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        website: input.website ?? null,
        countryCode: input.countryCode,
        currencyCode: input.currencyCode,
        taxNumber: input.taxNumber ?? null,
        taxIdType: input.taxIdType ?? null,
        taxExemptionCode: input.taxExemptionCode ?? null,
        defaultTaxCodeId: input.defaultTaxCodeId ?? null,
        identityDocumentType: input.identityDocumentType ?? null,
        identityDocumentNumber: input.identityDocumentNumber ?? null,
        taxExempt: input.taxExempt,
        pricesIncludeTax: input.pricesIncludeTax,
        emailMarketingOptIn: input.emailMarketingOptIn,
        creditHold: input.creditHold,
        status: input.status ?? "ACTIVE",
        creditLimit: input.creditLimit ?? "0",
        preferredPaymentMethod: input.preferredPaymentMethod ?? null,
        preferredCommunicationChannel: input.preferredCommunicationChannel ?? null,
        paymentTermId: input.paymentTermId ?? null,
        pricingGroupId: input.pricingGroupId ?? null,
        accountingCategoryId: input.accountingCategoryId ?? null,
        openingBalance: input.openingBalance ?? "0",
        openingBalanceDate: input.openingBalanceDate ? new Date(input.openingBalanceDate) : null,
        notes: input.notes ?? null,
        createdById: actorId,
        updatedById: actorId,
        addresses: input.addresses?.length
          ? {
              create: input.addresses.map((address) => addressData(organizationId, actorId, address)),
            }
          : undefined,
        contacts: contacts.length
          ? {
              create: contacts.map((contact) => customerContactData(organizationId, actorId, contact)),
            }
          : undefined,
      },
      select: customerDetailSelect,
    });
  }

  async update(organizationId: string, id: string, actorId: string, input: UpdateCustomerInput) {
    const existing = await this.findById(organizationId, id);
    if (!existing) {
      return null;
    }
    try {
      return await this.transaction(async (tx) => {
        await tx.customer.update({
          where: { id },
          data: {
            ...(input.entityType !== undefined ? { entityType: input.entityType } : {}),
            ...(input.customerType !== undefined ? { customerType: input.customerType } : {}),
            ...(input.customerCategory !== undefined ? { customerCategory: input.customerCategory } : {}),
            ...(input.industry !== undefined ? { industry: input.industry ?? null } : {}),
            ...(input.employeeCount !== undefined ? { employeeCount: input.employeeCount ?? null } : {}),
            ...(input.incorporationStatus !== undefined ? { incorporationStatus: input.incorporationStatus ?? null } : {}),
            ...(input.businessRegistrationDate !== undefined ? { businessRegistrationDate: input.businessRegistrationDate ? new Date(input.businessRegistrationDate) : null } : {}),
            ...(input.registrationNumber !== undefined ? { registrationNumber: input.registrationNumber ?? null } : {}),
            ...(input.rating !== undefined ? { rating: input.rating ?? null } : {}),
            ...(input.priority !== undefined ? { priority: input.priority } : {}),
            ...(input.customerCode !== undefined ? { customerCode: input.customerCode ?? null } : {}),
            ...(input.sameAsBilling !== undefined ? { sameAsBilling: input.sameAsBilling } : {}),
            ...(input.leadSource !== undefined ? { leadSource: input.leadSource ?? null } : {}),
            ...(input.assignedSalesRepId !== undefined ? { assignedSalesRepId: input.assignedSalesRepId ?? null } : {}),
            ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
            ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
            ...(input.middleName !== undefined ? { middleName: input.middleName ?? null } : {}),
            ...(input.email !== undefined ? { email: input.email ?? null } : {}),
            ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
            ...(input.website !== undefined ? { website: input.website ?? null } : {}),
            ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
            ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
            ...(input.taxNumber !== undefined ? { taxNumber: input.taxNumber ?? null } : {}),
            ...(input.taxIdType !== undefined ? { taxIdType: input.taxIdType ?? null } : {}),
            ...(input.taxExemptionCode !== undefined ? { taxExemptionCode: input.taxExemptionCode ?? null } : {}),
            ...(input.defaultTaxCodeId !== undefined ? { defaultTaxCodeId: input.defaultTaxCodeId ?? null } : {}),
            ...(input.identityDocumentType !== undefined ? { identityDocumentType: input.identityDocumentType ?? null } : {}),
            ...(input.identityDocumentNumber !== undefined ? { identityDocumentNumber: input.identityDocumentNumber ?? null } : {}),
            ...(input.taxExempt !== undefined ? { taxExempt: input.taxExempt } : {}),
            ...(input.pricesIncludeTax !== undefined ? { pricesIncludeTax: input.pricesIncludeTax } : {}),
            ...(input.emailMarketingOptIn !== undefined ? { emailMarketingOptIn: input.emailMarketingOptIn } : {}),
            ...(input.creditHold !== undefined ? { creditHold: input.creditHold } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.creditLimit !== undefined ? { creditLimit: input.creditLimit } : {}),
            ...(input.preferredPaymentMethod !== undefined ? { preferredPaymentMethod: input.preferredPaymentMethod ?? null } : {}),
            ...(input.preferredCommunicationChannel !== undefined ? { preferredCommunicationChannel: input.preferredCommunicationChannel ?? null } : {}),
            ...(input.paymentTermId !== undefined ? { paymentTermId: input.paymentTermId ?? null } : {}),
            ...(input.pricingGroupId !== undefined ? { pricingGroupId: input.pricingGroupId ?? null } : {}),
            ...(input.accountingCategoryId !== undefined ? { accountingCategoryId: input.accountingCategoryId ?? null } : {}),
            ...(input.openingBalance !== undefined ? { openingBalance: input.openingBalance } : {}),
            ...(input.openingBalanceDate !== undefined
              ? { openingBalanceDate: input.openingBalanceDate ? new Date(input.openingBalanceDate) : null }
              : {}),
            ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
            updatedById: actorId,
          },
        });
        if (input.addresses !== undefined) {
          await syncCustomerAddresses(tx, organizationId, id, actorId, input.addresses);
        }
        if (input.contacts !== undefined) {
          await syncCustomerContacts(tx, organizationId, id, actorId, input.contacts);
        }
        return tx.customer.findFirst({ where: { id, organizationId }, select: customerDetailSelect });
      });
    } catch (error) {
      throw mapConflict(error, "A customer with this email already exists");
    }
  }

  async softDelete(organizationId: string, id: string, actorId: string) {
    const result = await this.db.customer.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
  }

  async permanentlyDelete(organizationId: string, id: string) {
    return this.transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id, organizationId, deletedAt: { not: null } },
        select: { id: true, customerNumber: true, displayName: true },
      });
      if (!customer) {
        return null;
      }

      const documentCount = await tx.customerDocument.count({ where: { organizationId, customerId: id } });
      if (documentCount > 0) {
        throw new ConflictError("Remove this customer's stored documents before permanently deleting the customer");
      }

      await tx.customerAddress.deleteMany({ where: { organizationId, customerId: id } });
      await tx.contact.deleteMany({ where: { organizationId, customerId: id } });
      await tx.customerNote.deleteMany({ where: { organizationId, customerId: id } });
      await tx.customerActivity.deleteMany({ where: { organizationId, customerId: id } });
      await tx.customerSupportTicket.deleteMany({ where: { organizationId, customerId: id } });
      const deleted = await tx.customer.deleteMany({ where: { id, organizationId, deletedAt: { not: null } } });
      if (deleted.count !== 1) {
        throw new ConflictError("Customer was restored before permanent deletion; reload and try again");
      }
      return customer;
    });
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
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            geofenceRadiusMeters: input.geofenceRadiusMeters ?? null,
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

type CustomerFormContact = NonNullable<CreateCustomerInput["contacts"]>[number];
type CustomerFormAddress = NonNullable<CreateCustomerInput["addresses"]>[number];

function addressData(organizationId: string, actorId: string, input: AddressInput | CustomerFormAddress) {
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
    ...("latitude" in input ? { latitude: input.latitude, longitude: input.longitude } : {}),
    ...("geofenceRadiusMeters" in input ? { geofenceRadiusMeters: input.geofenceRadiusMeters } : {}),
    createdById: actorId,
    updatedById: actorId,
  };
}

function customerContactData(organizationId: string, actorId: string, input: CustomerFormContact) {
  return {
    organizationId,
    firstName: input.firstName,
    lastName: input.lastName,
    ...customerContactFields(input),
    createdById: actorId,
    updatedById: actorId,
    roleAssignments: input.role ? { create: [{ role: input.role }] } : undefined,
  };
}

function customerContactFields(input: CustomerFormContact) {
  return {
    displayName: contactDisplayName(input.firstName, input.lastName, input.displayName),
    jobTitle: input.jobTitle ?? null,
    department: input.department ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    mobile: input.mobile ?? null,
    isPrimary: input.isPrimary,
    emailOptIn: input.emailOptIn,
    phoneOptIn: input.phoneOptIn,
    smsOptIn: input.smsOptIn,
    whatsappOptIn: input.whatsappOptIn,
    notes: input.notes ?? null,
  };
}

async function syncCustomerAddresses(
  tx: Prisma.TransactionClient,
  organizationId: string,
  customerId: string,
  actorId: string,
  addresses: CustomerFormAddress[],
) {
  const existing = await tx.customerAddress.findMany({
    where: { organizationId, customerId, deletedAt: null },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((address) => address.id));
  const submittedIds = new Set(addresses.flatMap((address) => address.id ? [address.id] : []));
  const removedIds = existing.filter((address) => !submittedIds.has(address.id)).map((address) => address.id);
  if (removedIds.length) {
    await tx.customerAddress.updateMany({
      where: { organizationId, customerId, id: { in: removedIds } },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
  }

  const primaryPurposes = [...new Set(addresses.filter((address) => address.isPrimary).map((address) => address.purpose))];
  if (primaryPurposes.length) {
    await tx.customerAddress.updateMany({
      where: {
        organizationId,
        customerId,
        deletedAt: null,
        isPrimary: true,
        OR: primaryPurposes.map((purpose) => ({ purpose })),
      },
      data: { isPrimary: false, updatedById: actorId },
    });
  }

  for (const address of addresses) {
    const data = addressFields(address);
    if (address.id) {
      if (!existingIds.has(address.id)) {
        throw new ConflictError("An address does not belong to this customer");
      }
      await tx.customerAddress.update({ where: { id: address.id }, data: { ...data, updatedById: actorId } });
    } else {
      await tx.customerAddress.create({
        data: { ...data, organizationId, customerId, createdById: actorId, updatedById: actorId },
      });
    }
  }
}

async function syncCustomerContacts(
  tx: Prisma.TransactionClient,
  organizationId: string,
  customerId: string,
  actorId: string,
  contacts: CustomerFormContact[],
) {
  const existing = await tx.contact.findMany({
    where: { organizationId, customerId, deletedAt: null },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((contact) => contact.id));
  const submittedIds = new Set(contacts.flatMap((contact) => contact.id ? [contact.id] : []));
  const removedIds = existing.filter((contact) => !submittedIds.has(contact.id)).map((contact) => contact.id);
  if (removedIds.length) {
    await tx.contact.updateMany({
      where: { organizationId, customerId, id: { in: removedIds } },
      data: { deletedAt: new Date(), isPrimary: false, updatedById: actorId },
    });
  }
  if (contacts.some((contact) => contact.isPrimary)) {
    await tx.contact.updateMany({
      where: { organizationId, customerId, deletedAt: null, isPrimary: true },
      data: { isPrimary: false, updatedById: actorId },
    });
  }

  for (const contact of contacts) {
    let contactId = contact.id;
    if (contactId) {
      if (!existingIds.has(contactId)) {
        throw new ConflictError("A contact does not belong to this customer");
      }
      await tx.contact.update({
        where: { id: contactId },
        data: { firstName: contact.firstName, lastName: contact.lastName, ...customerContactFields(contact), updatedById: actorId },
      });
      await tx.customerContactRoleAssignment.deleteMany({ where: { contactId } });
    } else {
      const created = await tx.contact.create({
        data: { customerId, ...customerContactData(organizationId, actorId, contact) },
        select: { id: true },
      });
      contactId = created.id;
    }
    if (contact.role) {
      await tx.customerContactRoleAssignment.create({ data: { contactId, role: contact.role } });
    }
  }
}

function addressFields(input: CustomerFormAddress) {
  return {
    purpose: input.purpose as AddressPurpose,
    isPrimary: input.isPrimary ?? false,
    label: input.label ?? null,
    line1: input.line1,
    line2: input.line2 ?? null,
    city: input.city,
    region: input.region ?? null,
    postalCode: input.postalCode ?? null,
    countryCode: input.countryCode,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    geofenceRadiusMeters: input.geofenceRadiusMeters ?? null,
  };
}

function mapConflict(error: unknown, message: string): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictError(message);
  }
  return error;
}

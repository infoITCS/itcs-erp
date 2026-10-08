import type { Prisma } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import { assertDecimalString } from "../../common/money/decimal";
import { toCursorPage } from "../../common/pagination/cursor";
import type { AuditWriter } from "../audit-logs/types";
import type { RequestMeta } from "../auth/types";
import { toResellerPage, type ResellerSort } from "./page";
import type { ResellersRepository } from "./repository";
import type {
  AddressInput,
  ContactBody,
  ContactListQuery,
  CreateResellerInput,
  ResellerListQuery,
  UpdateContactInput,
  UpdateResellerInput,
} from "./validation";

const RESELLERS = "resellers";
const PERCENT_SCALE = 4;

export class ResellersService {
  constructor(
    private readonly repository: ResellersRepository,
    private readonly audit: AuditWriter,
  ) {}

  async list(organizationId: string, query: ResellerListQuery, permissions: string[]) {
    if (query.includeDeleted && !canSeeDeleted(permissions)) {
      throw new ForbiddenError();
    }
    const sort = (query.sort ?? "createdAt") as ResellerSort;
    const rows = await this.repository.list(
      {
        organizationId,
        q: query.q,
        status: query.status,
        country: query.country,
        from: query.from,
        to: query.to,
        includeDeleted: query.includeDeleted,
      },
      query.limit,
      sort,
      query.order,
      query.cursor,
    );
    return toResellerPage(rows, query.limit, sort);
  }

  async get(organizationId: string, id: string) {
    const reseller = await this.repository.findById(organizationId, id);
    if (!reseller) {
      throw new NotFoundError("Reseller not found");
    }
    return reseller;
  }

  async create(organizationId: string, actorId: string, input: CreateResellerInput, meta: RequestMeta) {
    await this.requireCurrency(input.currencyCode);
    const discount = normalizePercent(input.defaultDiscountPercent, "defaultDiscountPercent");
    const commission = normalizePercent(input.defaultCommissionPercent, "defaultCommissionPercent");
    const reseller = await this.repository.create(organizationId, actorId, {
      ...input,
      defaultDiscountPercent: discount,
      defaultCommissionPercent: commission,
    });
    if (!reseller) {
      throw new NotFoundError("Reseller not found");
    }
    await this.record(organizationId, actorId, "resellers.created", "reseller", reseller.id, meta, {
      resellerId: reseller.id,
      resellerNumber: reseller.resellerNumber,
      displayName: reseller.displayName,
      status: reseller.status,
      priceListCode: reseller.priceListCode,
    });
    for (const address of reseller.addresses) {
      await this.record(organizationId, actorId, "resellers.address.created", "reseller_address", address.id, meta, {
        resellerId: reseller.id,
        purpose: address.purpose,
      });
    }
    for (const contact of reseller.contacts) {
      await this.record(organizationId, actorId, "resellers.contact.created", "reseller_contact", contact.id, meta, {
        resellerId: reseller.id,
        displayName: contact.displayName,
        isPrimary: contact.isPrimary,
      });
    }
    return reseller;
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    input: UpdateResellerInput,
    meta: RequestMeta,
  ) {
    if (input.currencyCode) {
      await this.requireCurrency(input.currencyCode);
    }
    const existing = await this.get(organizationId, id);
    const normalized: UpdateResellerInput = {
      ...input,
      defaultDiscountPercent:
        input.defaultDiscountPercent === undefined || input.defaultDiscountPercent === null
          ? input.defaultDiscountPercent
          : normalizePercent(input.defaultDiscountPercent, "defaultDiscountPercent"),
      defaultCommissionPercent:
        input.defaultCommissionPercent === undefined || input.defaultCommissionPercent === null
          ? input.defaultCommissionPercent
          : normalizePercent(input.defaultCommissionPercent, "defaultCommissionPercent"),
    };

    const updated = await this.repository.update(organizationId, id, actorId, normalized);
    if (!updated) {
      throw new NotFoundError("Reseller not found");
    }

    if (input.status && input.status !== existing.status) {
      await this.record(
        organizationId,
        actorId,
        "resellers.status.changed",
        "reseller",
        id,
        meta,
        { resellerId: id, status: input.status },
        { status: existing.status },
      );
    }

    const pricingChanged =
      (input.priceListCode !== undefined && input.priceListCode !== existing.priceListCode) ||
      input.defaultDiscountPercent !== undefined ||
      input.defaultCommissionPercent !== undefined;
    if (pricingChanged) {
      await this.record(
        organizationId,
        actorId,
        "resellers.pricing.changed",
        "reseller",
        id,
        meta,
        {
          resellerId: id,
          priceListCode: updated.priceListCode,
          defaultDiscountPercent: updated.defaultDiscountPercent?.toString() ?? null,
          defaultCommissionPercent: updated.defaultCommissionPercent?.toString() ?? null,
        },
        {
          priceListCode: existing.priceListCode,
          defaultDiscountPercent: existing.defaultDiscountPercent?.toString() ?? null,
          defaultCommissionPercent: existing.defaultCommissionPercent?.toString() ?? null,
        },
      );
    }

    const otherFields = { ...input };
    delete otherFields.status;
    delete otherFields.priceListCode;
    delete otherFields.defaultDiscountPercent;
    delete otherFields.defaultCommissionPercent;
    if (Object.values(otherFields).some((value) => value !== undefined)) {
      await this.record(organizationId, actorId, "resellers.updated", "reseller", id, meta, {
        resellerId: id,
        changes: otherFields,
      });
    }
    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    const removed = await this.repository.softDelete(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Reseller not found");
    }
    await this.record(organizationId, actorId, "resellers.deleted", "reseller", id, meta, {
      resellerId: id,
      displayName: existing.displayName,
      resellerNumber: existing.resellerNumber,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async restore(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const restored = await this.repository.restore(organizationId, id, actorId);
    if (!restored) {
      throw new NotFoundError("Deleted reseller not found");
    }
    await this.record(organizationId, actorId, "resellers.restored", "reseller", id, meta, { resellerId: id });
    return this.get(organizationId, id);
  }

  async listAddresses(organizationId: string, resellerId: string) {
    await this.get(organizationId, resellerId);
    return this.repository.listAddresses(organizationId, resellerId);
  }

  async createAddress(
    organizationId: string,
    actorId: string,
    resellerId: string,
    input: AddressInput,
    meta: RequestMeta,
  ) {
    await this.get(organizationId, resellerId);
    const address = await this.repository.createAddress(organizationId, resellerId, actorId, input);
    await this.record(organizationId, actorId, "resellers.address.created", "reseller_address", address.id, meta, {
      resellerId,
      purpose: address.purpose,
      isPrimary: address.isPrimary,
    });
    return address;
  }

  async updateAddress(
    organizationId: string,
    actorId: string,
    resellerId: string,
    addressId: string,
    input: AddressInput,
    meta: RequestMeta,
  ) {
    await this.get(organizationId, resellerId);
    const before = (await this.repository.listAddresses(organizationId, resellerId)).find((row) => row.id === addressId);
    const address = await this.repository.updateAddress(organizationId, resellerId, addressId, actorId, input);
    if (!address || !before) {
      throw new NotFoundError("Address not found");
    }
    await this.record(
      organizationId,
      actorId,
      "resellers.address.updated",
      "reseller_address",
      address.id,
      meta,
      { resellerId, purpose: address.purpose, isPrimary: address.isPrimary },
      { purpose: before.purpose, line1: before.line1, isPrimary: before.isPrimary },
    );
    return address;
  }

  async removeAddress(
    organizationId: string,
    actorId: string,
    resellerId: string,
    addressId: string,
    meta: RequestMeta,
  ) {
    await this.get(organizationId, resellerId);
    const address = await this.repository.softDeleteAddress(organizationId, resellerId, addressId, actorId);
    if (!address) {
      throw new NotFoundError("Address not found");
    }
    await this.record(organizationId, actorId, "resellers.address.deleted", "reseller_address", addressId, meta, {
      resellerId,
      purpose: address.purpose,
    });
    return { id: addressId, deletedAt: new Date().toISOString() };
  }

  async listContacts(organizationId: string, resellerId: string, query: ContactListQuery, permissions: string[]) {
    if (query.includeDeleted && !canSeeDeleted(permissions)) {
      throw new ForbiddenError();
    }
    await this.get(organizationId, resellerId);
    const rows = await this.repository.listContacts(
      organizationId,
      resellerId,
      query.limit,
      query.cursor,
      query.includeDeleted,
    );
    return toCursorPage(rows, query.limit);
  }

  async createContact(
    organizationId: string,
    actorId: string,
    resellerId: string,
    input: ContactBody,
    meta: RequestMeta,
  ) {
    await this.get(organizationId, resellerId);
    const previousPrimary = input.isPrimary
      ? await this.repository.findPrimaryContact(organizationId, resellerId)
      : null;
    const contact = await this.repository.createContact(organizationId, resellerId, actorId, input);
    await this.record(organizationId, actorId, "resellers.contact.created", "reseller_contact", contact.id, meta, {
      resellerId,
      displayName: contact.displayName,
      isPrimary: contact.isPrimary,
    });
    if (input.isPrimary && previousPrimary && previousPrimary.id !== contact.id) {
      await this.record(organizationId, actorId, "resellers.contact.updated", "reseller_contact", contact.id, meta, {
        resellerId,
        contactId: contact.id,
        previousContactId: previousPrimary.id,
        isPrimary: true,
      });
    }
    return contact;
  }

  async updateContact(
    organizationId: string,
    actorId: string,
    id: string,
    input: UpdateContactInput,
    meta: RequestMeta,
  ) {
    const existing = await this.repository.findContact(organizationId, id);
    if (!existing) {
      throw new NotFoundError("Contact not found");
    }
    const contact = await this.repository.updateContact(organizationId, id, actorId, input);
    if (!contact) {
      throw new NotFoundError("Contact not found");
    }
    await this.record(
      organizationId,
      actorId,
      "resellers.contact.updated",
      "reseller_contact",
      contact.id,
      meta,
      {
        resellerId: contact.resellerId,
        displayName: contact.displayName,
        status: contact.status,
        isPrimary: contact.isPrimary,
      },
      { displayName: existing.displayName, status: existing.status, isPrimary: existing.isPrimary },
    );
    return contact;
  }

  async removeContact(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.repository.softDeleteContact(organizationId, id, actorId);
    if (!existing) {
      throw new NotFoundError("Contact not found");
    }
    await this.record(organizationId, actorId, "resellers.contact.deleted", "reseller_contact", id, meta, {
      resellerId: existing.resellerId,
      displayName: existing.displayName,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async listCustomers(organizationId: string, resellerId: string, limit: number, cursor?: string) {
    await this.get(organizationId, resellerId);
    const rows = await this.repository.listCustomers(organizationId, resellerId, limit, cursor);
    return toCursorPage(rows, limit);
  }

  async assignCustomer(
    organizationId: string,
    actorId: string,
    resellerId: string,
    customerId: string,
    meta: RequestMeta,
  ) {
    const reseller = await this.get(organizationId, resellerId);
    if (reseller.status !== "ACTIVE") {
      throw new ValidationFailedError({
        customerId: ["Only an active reseller can receive new customer assignments"],
      });
    }
    const customer = await this.repository.findCustomerForAssign(organizationId, customerId);
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }
    if (customer.resellerId && customer.resellerId !== resellerId) {
      throw new ConflictError("This customer is already assigned to another reseller");
    }
    if (customer.resellerId === resellerId) {
      return customer;
    }
    const assigned = await this.repository.assignCustomer(organizationId, resellerId, customerId, actorId);
    if (!assigned) {
      throw new NotFoundError("Customer not found");
    }
    await this.record(organizationId, actorId, "resellers.customer.assigned", "customer", customerId, meta, {
      resellerId,
      customerId,
      customerNumber: customer.customerNumber,
      displayName: customer.displayName,
    });
    return { ...customer, resellerId };
  }

  async unassignCustomer(
    organizationId: string,
    actorId: string,
    resellerId: string,
    customerId: string,
    meta: RequestMeta,
  ) {
    await this.get(organizationId, resellerId);
    const customer = await this.repository.findCustomerForAssign(organizationId, customerId);
    if (!customer || customer.resellerId !== resellerId) {
      throw new NotFoundError("Customer assignment not found");
    }
    const removed = await this.repository.unassignCustomer(organizationId, resellerId, customerId, actorId);
    if (!removed) {
      throw new NotFoundError("Customer assignment not found");
    }
    await this.record(organizationId, actorId, "resellers.customer.unassigned", "customer", customerId, meta, {
      resellerId,
      customerId,
      customerNumber: customer.customerNumber,
      displayName: customer.displayName,
    });
    return { id: customerId, resellerId: null };
  }

  private async requireCurrency(code: string) {
    if (!(await this.repository.currencyIsActive(code))) {
      throw new ValidationFailedError({ currencyCode: ["Choose an active currency"] });
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
      module: RESELLERS,
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
  return permissions.includes("resellers:delete") || permissions.includes("resellers:restore");
}

function normalizePercent(value: string | undefined, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = assertDecimalString(value, PERCENT_SCALE, field);
  const amount = Number(normalized);
  if (amount < 0 || amount > 100) {
    throw new ValidationFailedError({ [field]: ["Use a percentage between 0 and 100"] });
  }
  return normalized;
}

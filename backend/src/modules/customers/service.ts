import type { Prisma } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import type { AuditWriter } from "../audit-logs/types";
import type { RequestMeta } from "../auth/types";
import type { CustomersRepository } from "./repository";
import { toCustomerPage, type CustomerSort } from "./page";
import type { AddressInput, CreateCustomerInput, CustomerListQuery, UpdateCustomerInput } from "./validation";

const CUSTOMERS = "customers";

export class CustomersService {
  constructor(
    private readonly repository: CustomersRepository,
    private readonly audit: AuditWriter,
  ) {}

  async list(organizationId: string, query: CustomerListQuery, permissions: string[]) {
    if (query.includeDeleted && !canSeeDeleted(permissions)) {
      throw new ForbiddenError();
    }
    const sort = (query.sort ?? "createdAt") as CustomerSort;
    const rows = await this.repository.list(
      {
        organizationId,
        q: query.q,
        status: query.status,
        customerType: query.customerType,
        country: query.country,
        currency: query.currency,
        from: query.from,
        to: query.to,
        includeDeleted: query.includeDeleted,
      },
      query.limit,
      sort,
      query.order,
      query.cursor,
    );
    return toCustomerPage(rows, query.limit, sort);
  }

  async get(organizationId: string, id: string) {
    const customer = await this.repository.findById(organizationId, id);
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }
    return customer;
  }

  async create(organizationId: string, actorId: string, input: CreateCustomerInput, meta: RequestMeta) {
    await this.requireCurrency(input.currencyCode);
    const possibleDuplicate = input.email
      ? await this.repository.emailExists(organizationId, input.email)
      : false;
    const customer = await this.repository.create(organizationId, actorId, input);
    await this.record(organizationId, actorId, "customers.created", "customer", customer.id, meta, {
      customerId: customer.id,
      customerNumber: customer.customerNumber,
      displayName: customer.displayName,
      status: customer.status,
    });
    for (const address of customer.addresses) {
      await this.record(organizationId, actorId, "customers.address.created", "customer_address", address.id, meta, {
        customerId: customer.id,
        purpose: address.purpose,
      });
    }
    for (const contact of customer.contacts) {
      await this.record(organizationId, actorId, "contacts.created", "contact", contact.id, meta, {
        customerId: customer.id,
        displayName: contact.displayName,
        isPrimary: contact.isPrimary,
      });
    }
    return { customer, possibleDuplicate };
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    input: UpdateCustomerInput,
    meta: RequestMeta,
  ) {
    if (input.currencyCode) {
      await this.requireCurrency(input.currencyCode);
    }
    const existing = await this.get(organizationId, id);
    const updated = await this.repository.update(organizationId, id, actorId, input);
    if (!updated) {
      throw new NotFoundError("Customer not found");
    }
    if (input.status && input.status !== existing.status) {
      await this.record(
        organizationId,
        actorId,
        "customers.status.changed",
        "customer",
        id,
        meta,
        { customerId: id, status: input.status },
        { status: existing.status },
      );
    }
    const otherFields = { ...input };
    delete otherFields.status;
    if (Object.values(otherFields).some((value) => value !== undefined)) {
      await this.record(organizationId, actorId, "customers.updated", "customer", id, meta, {
        customerId: id,
        changes: otherFields,
      });
    }
    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    const removed = await this.repository.softDelete(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Customer not found");
    }
    await this.record(organizationId, actorId, "customers.deleted", "customer", id, meta, {
      customerId: id,
      displayName: existing.displayName,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async restore(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const restored = await this.repository.restore(organizationId, id, actorId);
    if (!restored) {
      throw new NotFoundError("Deleted customer not found");
    }
    await this.record(organizationId, actorId, "customers.restored", "customer", id, meta, { customerId: id });
    return this.get(organizationId, id);
  }

  async listAddresses(organizationId: string, customerId: string) {
    await this.get(organizationId, customerId);
    return this.repository.listAddresses(organizationId, customerId);
  }

  async createAddress(
    organizationId: string,
    actorId: string,
    customerId: string,
    input: AddressInput,
    meta: RequestMeta,
  ) {
    await this.get(organizationId, customerId);
    const address = await this.repository.createAddress(organizationId, customerId, actorId, input);
    await this.record(organizationId, actorId, "customers.address.created", "customer_address", address.id, meta, {
      customerId,
      purpose: address.purpose,
      isPrimary: address.isPrimary,
    });
    return address;
  }

  async updateAddress(
    organizationId: string,
    actorId: string,
    customerId: string,
    addressId: string,
    input: AddressInput,
    meta: RequestMeta,
  ) {
    await this.get(organizationId, customerId);
    const before = (await this.repository.listAddresses(organizationId, customerId)).find((row) => row.id === addressId);
    const address = await this.repository.updateAddress(organizationId, customerId, addressId, actorId, input);
    if (!address || !before) {
      throw new NotFoundError("Address not found");
    }
    await this.record(
      organizationId,
      actorId,
      "customers.address.updated",
      "customer_address",
      address.id,
      meta,
      { customerId, purpose: address.purpose, isPrimary: address.isPrimary },
      { purpose: before.purpose, line1: before.line1, isPrimary: before.isPrimary },
    );
    return address;
  }

  async removeAddress(
    organizationId: string,
    actorId: string,
    customerId: string,
    addressId: string,
    meta: RequestMeta,
  ) {
    await this.get(organizationId, customerId);
    const address = await this.repository.softDeleteAddress(organizationId, customerId, addressId, actorId);
    if (!address) {
      throw new NotFoundError("Address not found");
    }
    await this.record(organizationId, actorId, "customers.address.deleted", "customer_address", addressId, meta, {
      customerId,
      purpose: address.purpose,
    });
    return { id: addressId, deletedAt: new Date().toISOString() };
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
      module: action.startsWith("contacts.") ? "contacts" : CUSTOMERS,
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
  return permissions.includes("customers:delete") || permissions.includes("customers:restore");
}

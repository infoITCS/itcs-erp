import type { Prisma } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import type { AuditWriter } from "../audit-logs/types";
import type { RequestMeta } from "../auth/types";
import type { CustomersRepository } from "./repository";
import { toCustomerPage, type CustomerSort } from "./page";
import type { AddressInput, CreateAccountingCategoryInput, CreateCustomerInput, CreatePaymentTermInput, CustomerListQuery, UpdateCustomerInput } from "./validation";

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

  async formOptions(organizationId: string) {
    return this.repository.formOptions(organizationId);
  }

  async createPaymentTerm(organizationId: string, actorId: string, input: CreatePaymentTermInput, meta: RequestMeta) {
    const term = await this.repository.createPaymentTerm(organizationId, input);
    await this.record(organizationId, actorId, "customers.payment_term.created", "payment_term", term.id, meta, {
      code: term.code,
      name: term.name,
      dueDays: term.dueDays,
      requiresPrepayment: term.requiresPrepayment,
    });
    return term;
  }

  async createAccountingCategory(organizationId: string, actorId: string, input: CreateAccountingCategoryInput, meta: RequestMeta) {
    const category = await this.repository.createAccountingCategory(organizationId, input);
    await this.record(organizationId, actorId, "customers.accounting_category.created", "accounting_category", category.id, meta, {
      code: category.code,
      name: category.name,
    });
    return category;
  }

  /**
   * Same reference checks as {@link create}, without writing a row.
   * Callers that insert inside their own transaction (prospect conversion) run this first,
   * then {@link createWithin}.
   */
  async validateCreate(organizationId: string, input: CreateCustomerInput) {
    await this.requireCurrency(input.currencyCode);
    await this.requireFormReferences(organizationId, input);
  }

  async emailTaken(
    organizationId: string,
    email: string,
    client?: Prisma.TransactionClient,
  ): Promise<boolean> {
    return this.repository.emailExists(organizationId, email, undefined, client);
  }

  /** Inserts a customer on the caller's transaction, including document-number allocation. */
  async createWithin(
    tx: Prisma.TransactionClient,
    organizationId: string,
    actorId: string,
    input: CreateCustomerInput,
  ) {
    if (input.email && (await this.repository.emailExists(organizationId, input.email, undefined, tx))) {
      throw new ConflictError("A customer with this email already exists");
    }
    return this.repository.createIn(tx, organizationId, actorId, input);
  }

  async create(organizationId: string, actorId: string, input: CreateCustomerInput, meta: RequestMeta) {
    await this.validateCreate(organizationId, input);
    if (input.email && await this.repository.emailExists(organizationId, input.email)) {
      throw new ConflictError("A customer with this email already exists");
    }
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
    return { customer, possibleDuplicate: false };
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
    await this.requireFormReferences(organizationId, input);
    const existing = await this.get(organizationId, id);
    if (input.email && await this.repository.emailExists(organizationId, input.email, id)) {
      throw new ConflictError("A customer with this email already exists");
    }
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
    if (otherFields.identityDocumentNumber !== undefined) {
      otherFields.identityDocumentNumber = otherFields.identityDocumentNumber ? "[REDACTED]" : null;
    }
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

  async permanentlyRemove(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const removed = await this.repository.permanentlyDelete(organizationId, id);
    if (!removed) {
      throw new NotFoundError("Deleted customer not found");
    }
    await this.record(organizationId, actorId, "customers.permanently_deleted", "customer", id, meta, {
      customerId: id,
      customerNumber: removed.customerNumber,
      displayName: removed.displayName,
    });
    return { id };
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

  private async requireFormReferences(
    organizationId: string,
    input: { assignedSalesRepId?: string | null; paymentTermId?: string | null; pricingGroupId?: string | null; defaultTaxCodeId?: string | null; accountingCategoryId?: string | null },
  ) {
    if (!input.assignedSalesRepId && !input.paymentTermId && !input.pricingGroupId && !input.defaultTaxCodeId && !input.accountingCategoryId) {
      return;
    }
    const options = await this.repository.formOptions(organizationId);
    const errors: Record<string, string[]> = {};
    if (input.assignedSalesRepId && !options.salesReps.some((user) => user.id === input.assignedSalesRepId)) {
      errors.assignedSalesRepId = ["Choose an active sales representative in this organization"];
    }
    if (input.paymentTermId && !options.paymentTerms.some((term) => term.id === input.paymentTermId)) {
      errors.paymentTermId = ["Choose an active payment term"];
    }
    if (input.pricingGroupId && !options.pricingGroups.some((group) => group.id === input.pricingGroupId)) {
      errors.pricingGroupId = ["Choose an active pricing group"];
    }
    if (input.defaultTaxCodeId && !options.taxCodes.some((taxCode) => taxCode.id === input.defaultTaxCodeId)) {
      errors.defaultTaxCodeId = ["Choose an active tax code in this organization"];
    }
    if (input.accountingCategoryId && !options.accountingCategories.some((category) => category.id === input.accountingCategoryId)) {
      errors.accountingCategoryId = ["Choose an active accounting category in this organization"];
    }
    if (Object.keys(errors).length) {
      throw new ValidationFailedError(errors);
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

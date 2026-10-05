import type { Prisma } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import { toCursorPage } from "../../common/pagination/cursor";
import type { AuditWriter } from "../audit-logs/types";
import type { RequestMeta } from "../auth/types";
import type { ContactsRepository } from "./repository";
import type { ContactBody, ContactListQuery, UpdateContactInput } from "./validation";

export class ContactsService {
  constructor(
    private readonly repository: ContactsRepository,
    private readonly audit: AuditWriter,
  ) {}

  async list(organizationId: string, customerId: string, query: ContactListQuery, permissions: string[]) {
    if (query.includeDeleted && !permissions.includes("contacts:delete") && !permissions.includes("contacts:restore")) {
      throw new ForbiddenError();
    }
    if (!(await this.repository.customerIsActive(organizationId, customerId))) {
      throw new NotFoundError("Customer not found");
    }
    const rows = await this.repository.list(organizationId, customerId, query.limit, query.cursor, query.includeDeleted);
    return toCursorPage(rows, query.limit);
  }

  async get(organizationId: string, id: string) {
    const contact = await this.repository.findById(organizationId, id);
    if (!contact) {
      throw new NotFoundError("Contact not found");
    }
    return contact;
  }

  async create(
    organizationId: string,
    actorId: string,
    customerId: string,
    input: ContactBody,
    meta: RequestMeta,
  ) {
    if (!(await this.repository.customerIsActive(organizationId, customerId))) {
      throw new NotFoundError("Customer not found");
    }
    const previousPrimary = input.isPrimary ? await this.repository.findPrimary(organizationId, customerId) : null;
    const contact = await this.repository.create(organizationId, customerId, actorId, input);
    await this.record(organizationId, actorId, "contacts.created", contact.id, meta, {
      customerId,
      displayName: contact.displayName,
      isPrimary: contact.isPrimary,
    });
    if (input.isPrimary && previousPrimary && previousPrimary.id !== contact.id) {
      await this.record(organizationId, actorId, "contacts.primary.changed", contact.id, meta, {
        customerId,
        contactId: contact.id,
        previousContactId: previousPrimary.id,
      });
    }
    return contact;
  }

  async update(organizationId: string, actorId: string, id: string, input: UpdateContactInput, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    const contact = await this.repository.update(organizationId, id, actorId, input);
    if (!contact) {
      throw new NotFoundError("Contact not found");
    }
    await this.record(
      organizationId,
      actorId,
      "contacts.updated",
      contact.id,
      meta,
      { customerId: contact.customerId, displayName: contact.displayName, status: contact.status, isPrimary: contact.isPrimary },
      { displayName: existing.displayName, status: existing.status, isPrimary: existing.isPrimary },
    );
    if (input.isPrimary && !existing.isPrimary) {
      await this.record(organizationId, actorId, "contacts.primary.changed", contact.id, meta, {
        customerId: contact.customerId,
        contactId: contact.id,
        previousContactId: null,
      });
    }
    return contact;
  }

  async remove(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.repository.softDelete(organizationId, id, actorId);
    if (!existing) {
      throw new NotFoundError("Contact not found");
    }
    await this.record(organizationId, actorId, "contacts.deleted", id, meta, {
      customerId: existing.customerId,
      displayName: existing.displayName,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async restore(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const contact = await this.repository.restore(organizationId, id, actorId);
    if (!contact) {
      throw new NotFoundError("Deleted contact not found");
    }
    await this.record(organizationId, actorId, "contacts.restored", id, meta, {
      customerId: contact.customerId,
      displayName: contact.displayName,
    });
    return contact;
  }

  private record(
    organizationId: string,
    actorId: string,
    action: string,
    entityId: string,
    meta: RequestMeta,
    newValues: Prisma.InputJsonValue,
    oldValues?: Prisma.InputJsonValue,
  ) {
    return this.audit.record({
      organizationId,
      userId: actorId,
      action,
      module: "contacts",
      entityType: "contact",
      entityId,
      oldValues,
      newValues,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }
}

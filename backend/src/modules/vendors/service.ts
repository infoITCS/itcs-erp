import type { Prisma } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import type { AuditWriter } from "../audit-logs/types";
import type { RequestMeta } from "../auth/types";
import { toVendorPage, type VendorSort } from "./page";
import type { VendorsRepository } from "./repository";
import { VENDORS_MODULE, VENDOR_STATUSES, VENDOR_STATUS_LABELS } from "./types";
import type { CreateVendorInput, UpdateVendorInput, VendorListQuery } from "./validation";

export class VendorsService {
  constructor(
    private readonly repository: VendorsRepository,
    private readonly audit: AuditWriter,
  ) {}

  async list(organizationId: string, query: VendorListQuery, permissions: string[]) {
    if (query.includeDeleted && !canSeeDeleted(permissions)) {
      throw new ForbiddenError();
    }
    const sort = (query.sort ?? "createdAt") as VendorSort;
    const rows = await this.repository.list(
      {
        organizationId,
        q: query.q,
        status: query.status,
        currencyCode: query.currencyCode,
        paymentTermId: query.paymentTermId,
        from: query.from,
        to: query.to,
        includeDeleted: query.includeDeleted,
      },
      query.limit,
      sort,
      query.order,
      query.cursor,
    );
    return toVendorPage(rows, query.limit, sort);
  }

  async get(organizationId: string, id: string) {
    const vendor = await this.repository.findById(organizationId, id);
    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }
    return vendor;
  }

  async formOptions(organizationId: string) {
    const options = await this.repository.formOptions(organizationId);
    return {
      ...options,
      statuses: VENDOR_STATUSES.map((status) => ({ value: status, label: VENDOR_STATUS_LABELS[status] })),
    };
  }

  async create(organizationId: string, actorId: string, input: CreateVendorInput, meta: RequestMeta) {
    await this.requireCurrency(input.currencyCode);
    if (input.paymentTermId) {
      await this.requirePaymentTerm(organizationId, input.paymentTermId);
    }
    if (input.taxCodeId) {
      await this.requireTaxCode(organizationId, input.taxCodeId);
    }
    if (input.code && (await this.repository.codeExists(organizationId, input.code))) {
      throw new ConflictError("A vendor with this code already exists");
    }
    const vendor = await this.repository.create(organizationId, actorId, input);
    await this.record(organizationId, actorId, "vendors.created", "vendor", vendor.id, meta, {
      vendorId: vendor.id,
      vendorNumber: vendor.vendorNumber,
      code: vendor.code,
      name: vendor.name,
      status: vendor.status,
    });
    return vendor;
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    input: UpdateVendorInput,
    meta: RequestMeta,
  ) {
    const existing = await this.get(organizationId, id);
    if (input.currencyCode) {
      await this.requireCurrency(input.currencyCode);
    }
    if (input.paymentTermId) {
      await this.requirePaymentTerm(organizationId, input.paymentTermId);
    }
    if (input.taxCodeId) {
      await this.requireTaxCode(organizationId, input.taxCodeId);
    }
    if (input.code && (await this.repository.codeExists(organizationId, input.code, id))) {
      throw new ConflictError("A vendor with this code already exists");
    }
    const updated = await this.repository.update(organizationId, id, actorId, input);
    if (!updated) {
      throw new NotFoundError("Vendor not found");
    }
    if (input.status && input.status !== existing.status) {
      await this.record(
        organizationId,
        actorId,
        "vendors.status.changed",
        "vendor",
        id,
        meta,
        { vendorId: id, status: input.status },
        { status: existing.status },
      );
    }
    const otherFields = { ...input };
    delete otherFields.status;
    if (Object.values(otherFields).some((value) => value !== undefined)) {
      await this.record(organizationId, actorId, "vendors.updated", "vendor", id, meta, {
        vendorId: id,
        changes: otherFields,
      });
    }
    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    const removed = await this.repository.softDelete(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Vendor not found");
    }
    await this.record(organizationId, actorId, "vendors.deleted", "vendor", id, meta, {
      vendorId: id,
      vendorNumber: existing.vendorNumber,
      name: existing.name,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async restore(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const restored = await this.repository.restore(organizationId, id, actorId);
    if (!restored) {
      throw new NotFoundError("Deleted vendor not found");
    }
    await this.record(organizationId, actorId, "vendors.restored", "vendor", id, meta, { vendorId: id });
    return this.get(organizationId, id);
  }

  private async requireCurrency(code: string) {
    if (!(await this.repository.currencyIsActive(code))) {
      throw new ValidationFailedError({ currencyCode: ["Choose an active currency"] });
    }
  }

  private async requirePaymentTerm(organizationId: string, id: string) {
    if (!(await this.repository.findPaymentTerm(organizationId, id))) {
      throw new ValidationFailedError({ paymentTermId: ["Choose an active payment term in this organization"] });
    }
  }

  private async requireTaxCode(organizationId: string, id: string) {
    if (!(await this.repository.findTaxCode(organizationId, id))) {
      throw new ValidationFailedError({ taxCodeId: ["Choose an active tax code in this organization"] });
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
      module: VENDORS_MODULE,
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
  return permissions.includes("vendors:delete") || permissions.includes("vendors:restore");
}

import { NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import type { AuditWriter } from "../audit-logs/types";
import type { RequestMeta } from "../auth/types";
import type { OrganizationsRepository } from "./repository";

export interface UpdateOrganizationInput {
  name?: string;
  baseCurrencyCode?: string;
}

export class OrganizationsService {
  constructor(
    private readonly repository: OrganizationsRepository,
    private readonly audit: AuditWriter,
  ) {}

  async listForUser(userId: string) {
    const memberships = await this.repository.listForUser(userId);
    return memberships.map((membership) => membership.organization);
  }

  async update(
    organizationId: string,
    actorId: string,
    input: UpdateOrganizationInput,
    meta: RequestMeta,
  ) {
    const existing = await this.repository.findForUser(actorId, organizationId);
    if (!existing) {
      throw new NotFoundError("Organization not found");
    }

    if (
      input.baseCurrencyCode &&
      !(await this.repository.currencyExists(input.baseCurrencyCode))
    ) {
      throw new ValidationFailedError({
        baseCurrencyCode: ["Choose an active currency"],
      });
    }

    const updated = await this.repository.update(organizationId, input);
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: "organizations.updated",
      module: "organizations",
      entityType: "organization",
      entityId: organizationId,
      oldValues: {
        name: existing.name,
        baseCurrencyCode: existing.baseCurrencyCode,
      },
      newValues: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.baseCurrencyCode !== undefined
          ? { baseCurrencyCode: input.baseCurrencyCode }
          : {}),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async archive(
    organizationId: string,
    actorId: string,
    meta: RequestMeta,
  ): Promise<void> {
    const existing = await this.repository.findForUser(actorId, organizationId);
    if (!existing) {
      throw new NotFoundError("Organization not found");
    }

    await this.repository.archive(organizationId);
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: "organizations.deleted",
      module: "organizations",
      entityType: "organization",
      entityId: organizationId,
      oldValues: {
        name: existing.name,
        code: existing.code,
        status: existing.status,
      },
      newValues: { status: "INACTIVE", archived: true },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }
}

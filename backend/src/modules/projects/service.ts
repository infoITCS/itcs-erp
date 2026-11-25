import type { Prisma } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import type { AuditLogsService } from "../audit-logs/service";
import type { RequestMeta } from "../auth/types";
import { buildProjectActivity, emptyCustomerActivityRows } from "./activity";
import { toProjectPage, type ProjectSort } from "./page";
import type { ProjectsRepository } from "./repository";
import { PROJECTS_MODULE, PROJECT_STATUSES } from "./types";
import type { CreateProjectInput, ProjectListQuery, UpdateProjectInput } from "./validation";

export class ProjectsService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly audit: AuditLogsService,
  ) {}

  async list(organizationId: string, query: ProjectListQuery, permissions: string[]) {
    if (query.includeDeleted && !permissions.includes("projects:delete")) {
      throw new ForbiddenError();
    }
    const sort = (query.sort ?? "createdAt") as ProjectSort;
    const rows = await this.repository.list(
      {
        organizationId,
        q: query.q,
        status: query.status,
        customerId: query.customerId,
        ownerUserId: query.ownerUserId,
        from: query.from,
        to: query.to,
        includeDeleted: query.includeDeleted,
      },
      query.limit,
      sort,
      query.order,
      query.cursor,
    );
    return toProjectPage(rows, query.limit, sort);
  }

  async get(organizationId: string, id: string) {
    const project = await this.repository.findById(organizationId, id);
    if (!project) {
      throw new NotFoundError("Project not found");
    }
    return project;
  }

  async activity(
    organizationId: string,
    id: string,
    access: { permissions: string[]; roles: string[] },
  ) {
    const project = await this.get(organizationId, id);
    const links = {
      leadId: project.leadId ?? null,
      opportunityId: project.opportunityId ?? null,
      quoteId: project.quoteId ?? null,
      salesOrderId: project.salesOrderId ?? null,
      invoiceId: project.invoiceId ?? null,
      contactId: project.contactId ?? null,
    };
    if (!project.customerId) {
      return buildProjectActivity(emptyCustomerActivityRows(), links, access);
    }
    const rows = await this.repository.listCustomerActivity(organizationId, project.customerId);
    return buildProjectActivity(rows, links, access);
  }

  async financials(
    organizationId: string,
    id: string,
    access: { permissions: string[]; roles: string[] },
  ) {
    const activity = await this.activity(organizationId, id, access);
    return activity.financials;
  }

  async formOptions(organizationId: string) {
    const [customers, contacts, owners, currencies] = await Promise.all([
      this.repository.listCustomerOptions(organizationId),
      this.repository.listContactOptions(organizationId),
      this.repository.listOwnerOptions(organizationId),
      this.repository.listCurrencyOptions(),
    ]);
    return { customers, contacts, owners, currencies, statuses: PROJECT_STATUSES };
  }

  async create(organizationId: string, actorId: string, input: CreateProjectInput, meta: RequestMeta) {
    const currencyCode = input.currencyCode ?? "PKR";
    await this.requireCurrency(currencyCode);
    const ownerUserId = input.ownerUserId ?? actorId;
    await this.requireOwner(organizationId, ownerUserId);
    await this.validateCustomerAndContact(organizationId, input.customerId, input.contactId);

    const project = await this.repository.create(organizationId, actorId, {
      ...input,
      currencyCode,
      ownerUserId,
    });
    if (!project) {
      throw new NotFoundError("Project not found");
    }

    await this.record(organizationId, actorId, "projects.created", "project", project.id, meta, {
      projectId: project.id,
      projectNumber: project.projectNumber,
      name: project.name,
      status: project.status,
      customerId: project.customerId,
    });
    return project;
  }

  async update(organizationId: string, actorId: string, id: string, input: UpdateProjectInput, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    if (input.currencyCode) {
      await this.requireCurrency(input.currencyCode);
    }
    if (input.ownerUserId) {
      await this.requireOwner(organizationId, input.ownerUserId);
    }
    if (input.invoiceId) {
      const [invoice, linkedProject] = await Promise.all([
        this.repository.findInvoiceForLink(organizationId, input.invoiceId),
        this.repository.findProjectForInvoice(organizationId, input.invoiceId, id),
      ]);
      if (!invoice) {
        throw new ValidationFailedError({ invoiceId: ["Choose an invoice in this organization"] });
      }
      if (linkedProject) {
        throw new ValidationFailedError({
          invoiceId: [`This invoice is already linked to project ${linkedProject.projectNumber}`],
        });
      }
    }

    const customerId = input.customerId === undefined ? existing.customerId : input.customerId;
    const contactId = input.contactId === undefined ? existing.contactId : input.contactId;
    const nextContactId = customerId ? contactId : null;
    await this.validateCustomerAndContact(organizationId, customerId, nextContactId);

    const updated = await this.repository.update(organizationId, id, actorId, {
      ...input,
      contactId: nextContactId,
    });
    if (!updated) {
      throw new NotFoundError("Project not found");
    }

    await this.record(organizationId, actorId, "projects.updated", "project", id, meta, {
      projectId: id,
      changes: input,
    });
    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    const removed = await this.repository.softDelete(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Project not found");
    }
    await this.record(organizationId, actorId, "projects.deleted", "project", id, meta, {
      projectId: id,
      projectNumber: existing.projectNumber,
      name: existing.name,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async listAudit(organizationId: string, id: string, limit: number, cursor?: string) {
    await this.get(organizationId, id);
    return this.audit.list(organizationId, limit, cursor, { entityType: "project", entityId: id });
  }

  private async validateCustomerAndContact(
    organizationId: string,
    customerId: string | null | undefined,
    contactId: string | null | undefined,
  ) {
    if (customerId) {
      const customer = await this.repository.findCustomerForLink(organizationId, customerId);
      if (!customer) {
        throw new ValidationFailedError({ customerId: ["Choose a customer in this organization"] });
      }
    }
    if (contactId) {
      if (!customerId) {
        throw new ValidationFailedError({ contactId: ["Choose a customer before selecting a contact"] });
      }
      const contact = await this.repository.findContactForLink(organizationId, contactId);
      if (!contact || contact.customerId !== customerId) {
        throw new ValidationFailedError({ contactId: ["Choose a contact that belongs to this customer"] });
      }
    }
  }

  private async requireCurrency(code: string) {
    if (!(await this.repository.currencyIsActive(code))) {
      throw new ValidationFailedError({ currencyCode: ["Choose an active currency"] });
    }
  }

  private async requireOwner(organizationId: string, userId: string) {
    if (!(await this.repository.findActiveOrgUser(organizationId, userId))) {
      throw new ValidationFailedError({ ownerUserId: ["Choose an active user in this organization"] });
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
      module: PROJECTS_MODULE,
      entityType,
      entityId,
      oldValues,
      newValues,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }
}

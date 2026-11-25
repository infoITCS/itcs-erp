import { DocumentType, Prisma, type PrismaClient, type ProjectStatus } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { allocateDocumentNumberIn } from "../../common/numbering/allocate";
import type { CustomerActivityRows } from "./activity";
import { buildProjectListWhere, type ProjectListFilter } from "./list-filter";
import { decodeProjectCursor, projectCursorWhere, type ProjectSort } from "./page";

const projectSelect = {
  id: true,
  organizationId: true,
  projectNumber: true,
  name: true,
  description: true,
  status: true,
  customerId: true,
  contactId: true,
  ownerUserId: true,
  leadId: true,
  opportunityId: true,
  quoteId: true,
  salesOrderId: true,
  invoiceId: true,
  customerContactName: true,
  customerContactEmail: true,
  customerContactPhone: true,
  supplierCompany: true,
  supplierContactName: true,
  supplierContactEmail: true,
  supplierContactPhone: true,
  currencyCode: true,
  startDate: true,
  dueDate: true,
  notes: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

export class ProjectsRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(
    filter: ProjectListFilter,
    limit: number,
    sort: ProjectSort,
    order: "asc" | "desc",
    cursor?: string,
  ) {
    const decoded = cursor ? decodeProjectCursor(cursor) : null;
    const where = buildProjectListWhere(filter);
    return this.db.project.findMany({
      where: decoded && decoded.sort === sort ? { AND: [where, projectCursorWhere(decoded, order)] } : where,
      orderBy: [{ [sort]: order }, { id: order }],
      take: limit + 1,
      select: projectSelect,
    });
  }

  async findById(organizationId: string, id: string, includeDeleted = false) {
    return this.db.project.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: projectSelect,
    });
  }

  async listCustomerOptions(organizationId: string) {
    return this.db.customer.findMany({
      where: { organizationId, deletedAt: null, status: "ACTIVE" },
      orderBy: { displayName: "asc" },
      take: 250,
      select: { id: true, customerNumber: true, displayName: true, email: true, currencyCode: true },
    });
  }

  async listContactOptions(organizationId: string, customerId?: string) {
    return this.db.contact.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: "ACTIVE",
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { displayName: "asc" },
      take: 250,
      select: { id: true, customerId: true, displayName: true, email: true, phone: true },
    });
  }

  async listOwnerOptions(organizationId: string) {
    return this.db.user.findMany({
      where: { status: "ACTIVE", memberships: { some: { organizationId, status: "ACTIVE" } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
    });
  }

  async listCurrencyOptions() {
    return this.db.currency.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { code: true, name: true },
    });
  }

  async findCustomerForLink(organizationId: string, customerId: string) {
    return this.db.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { id: true, displayName: true, customerNumber: true, currencyCode: true },
    });
  }

  async findContactForLink(organizationId: string, contactId: string) {
    return this.db.contact.findFirst({
      where: { id: contactId, organizationId, deletedAt: null },
      select: { id: true, customerId: true, displayName: true },
    });
  }

  async findInvoiceForLink(organizationId: string, invoiceId: string) {
    return this.db.invoice.findFirst({
      where: { id: invoiceId, organizationId, deletedAt: null },
      select: { id: true, invoiceNumber: true },
    });
  }

  async findProjectForInvoice(organizationId: string, invoiceId: string, excludeProjectId: string) {
    return this.db.project.findFirst({
      where: { organizationId, invoiceId, id: { not: excludeProjectId } },
      select: { id: true, name: true, projectNumber: true },
    });
  }

  async listCustomerActivity(organizationId: string, customerId: string): Promise<CustomerActivityRows> {
    const scoped = { organizationId, deletedAt: null };
    const [customer, leads, opportunities, tenders, quotes, salesOrders, invoices, payments, contacts] =
      await Promise.all([
        this.db.customer.findFirst({
          where: { id: customerId, organizationId, deletedAt: null },
          select: { id: true, customerNumber: true, displayName: true, email: true, currencyCode: true },
        }),
        this.db.lead.findMany({
          where: { ...scoped, convertedCustomerId: customerId },
          orderBy: { createdAt: "desc" },
          take: 250,
          select: {
            id: true,
            leadNumber: true,
            displayName: true,
            companyName: true,
            status: true,
            estimatedValue: true,
            currencyCode: true,
            createdAt: true,
            convertedCustomerId: true,
          },
        }),
        this.db.opportunity.findMany({
          where: {
            ...scoped,
            OR: [{ customerId }, { lead: { convertedCustomerId: customerId } }],
          },
          orderBy: { createdAt: "desc" },
          take: 250,
          select: {
            id: true,
            opportunityNumber: true,
            title: true,
            stage: true,
            estimatedValue: true,
            currencyCode: true,
            expectedCloseDate: true,
            createdAt: true,
            leadId: true,
          },
        }),
        this.db.tender.findMany({
          where: { ...scoped, customerId },
          orderBy: { createdAt: "desc" },
          take: 250,
          select: {
            id: true,
            tenderNumber: true,
            title: true,
            status: true,
            estimatedValue: true,
            currencyCode: true,
            submissionDeadline: true,
            createdAt: true,
          },
        }),
        this.db.quote.findMany({
          where: { ...scoped, customerId },
          orderBy: { createdAt: "desc" },
          take: 250,
          select: {
            id: true,
            quoteNumber: true,
            status: true,
            total: true,
            currencyCode: true,
            issueDate: true,
            customerReference: true,
            createdAt: true,
          },
        }),
        this.db.salesOrder.findMany({
          where: { ...scoped, customerId },
          orderBy: { createdAt: "desc" },
          take: 250,
          select: {
            id: true,
            salesOrderNumber: true,
            status: true,
            total: true,
            currencyCode: true,
            orderDate: true,
            customerReference: true,
            sourceQuoteId: true,
            createdAt: true,
          },
        }),
        this.db.invoice.findMany({
          where: { ...scoped, customerId },
          orderBy: { createdAt: "desc" },
          take: 250,
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
            amountPaid: true,
            currencyCode: true,
            issueDate: true,
            dueDate: true,
            customerReference: true,
            sourceSalesOrderId: true,
            createdAt: true,
          },
        }),
        this.db.payment.findMany({
          where: { ...scoped, customerId },
          orderBy: { receivedDate: "desc" },
          take: 250,
          select: {
            id: true,
            paymentNumber: true,
            amount: true,
            currencyCode: true,
            receivedDate: true,
            invoiceId: true,
            method: true,
            reference: true,
            createdAt: true,
          },
        }),
        this.db.contact.findMany({
          where: { ...scoped, customerId },
          orderBy: { displayName: "asc" },
          take: 250,
          select: {
            id: true,
            displayName: true,
            email: true,
            phone: true,
            status: true,
            createdAt: true,
          },
        }),
      ]);

    return {
      customer,
      leads,
      opportunities,
      tenders,
      quotes,
      salesOrders,
      invoices,
      payments,
      contacts,
    };
  }

  async findActiveOrgUser(organizationId: string, userId: string) {
    return this.db.user.findFirst({
      where: { id: userId, status: "ACTIVE", memberships: { some: { organizationId, status: "ACTIVE" } } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
  }

  async currencyIsActive(code: string): Promise<boolean> {
    const currency = await this.db.currency.findUnique({ where: { code }, select: { isActive: true } });
    return currency?.isActive === true;
  }

  async create(organizationId: string, actorId: string, input: ProjectCreateData) {
    const id = await this.transaction(async (tx) => {
      const projectNumber = await allocateDocumentNumberIn(tx, organizationId, DocumentType.PROJECT);
      const created = await tx.project.create({
        data: {
          organizationId,
          projectNumber,
          name: input.name,
          description: input.description ?? null,
          status: (input.status as ProjectStatus | undefined) ?? "PLANNED",
          customerId: input.customerId ?? null,
          contactId: input.contactId ?? null,
          ownerUserId: input.ownerUserId ?? actorId,
          customerContactName: input.customerContactName ?? null,
          customerContactEmail: input.customerContactEmail ?? null,
          customerContactPhone: input.customerContactPhone ?? null,
          supplierCompany: input.supplierCompany ?? null,
          supplierContactName: input.supplierContactName ?? null,
          supplierContactEmail: input.supplierContactEmail ?? null,
          supplierContactPhone: input.supplierContactPhone ?? null,
          currencyCode: input.currencyCode,
          startDate: input.startDate ? dateOnly(input.startDate) : null,
          dueDate: input.dueDate ? dateOnly(input.dueDate) : null,
          notes: input.notes ?? null,
          createdById: actorId,
          updatedById: actorId,
        },
        select: { id: true },
      });
      return created.id;
    });
    return this.findById(organizationId, id);
  }

  async update(organizationId: string, id: string, actorId: string, input: ProjectUpdateData) {
    const existing = await this.findById(organizationId, id);
    if (!existing) {
      return null;
    }
    await this.db.project.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status as ProjectStatus } : {}),
        ...(input.customerId !== undefined ? { customerId: input.customerId ?? null } : {}),
        ...(input.contactId !== undefined ? { contactId: input.contactId ?? null } : {}),
        ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.invoiceId !== undefined ? { invoiceId: input.invoiceId ?? null } : {}),
        ...(input.customerContactName !== undefined ? { customerContactName: input.customerContactName ?? null } : {}),
        ...(input.customerContactEmail !== undefined ? { customerContactEmail: input.customerContactEmail ?? null } : {}),
        ...(input.customerContactPhone !== undefined ? { customerContactPhone: input.customerContactPhone ?? null } : {}),
        ...(input.supplierCompany !== undefined ? { supplierCompany: input.supplierCompany ?? null } : {}),
        ...(input.supplierContactName !== undefined ? { supplierContactName: input.supplierContactName ?? null } : {}),
        ...(input.supplierContactEmail !== undefined ? { supplierContactEmail: input.supplierContactEmail ?? null } : {}),
        ...(input.supplierContactPhone !== undefined ? { supplierContactPhone: input.supplierContactPhone ?? null } : {}),
        ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate ? dateOnly(input.startDate) : null } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? dateOnly(input.dueDate) : null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        updatedById: actorId,
      },
    });
    return this.findById(organizationId, id);
  }

  async softDelete(organizationId: string, id: string, actorId: string) {
    const result = await this.db.project.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
  }
}

export interface ProjectCreateData {
  name: string;
  description?: string;
  status?: string;
  customerId?: string;
  contactId?: string;
  ownerUserId?: string;
  customerContactName?: string;
  customerContactEmail?: string;
  customerContactPhone?: string;
  supplierCompany?: string;
  supplierContactName?: string;
  supplierContactEmail?: string;
  supplierContactPhone?: string;
  currencyCode: string;
  startDate?: string;
  dueDate?: string;
  notes?: string;
}

export interface ProjectUpdateData {
  name?: string;
  description?: string | null;
  status?: string;
  customerId?: string | null;
  contactId?: string | null;
  ownerUserId?: string | null;
  invoiceId?: string | null;
  customerContactName?: string | null;
  customerContactEmail?: string | null;
  customerContactPhone?: string | null;
  supplierCompany?: string | null;
  supplierContactName?: string | null;
  supplierContactEmail?: string | null;
  supplierContactPhone?: string | null;
  currencyCode?: string;
  startDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

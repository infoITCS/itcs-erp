import type { Prisma, PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { allocateDocumentNumberIn } from "../../common/numbering/allocate";
import { cursorFilter, decodeCursor, toCursorPage } from "../../common/pagination/cursor";
import { buildInvoiceListWhere, type InvoiceListFilter } from "./list-filter";

const lineSelect = {
  id: true,
  productId: true,
  productCode: true,
  productName: true,
  description: true,
  unitOfMeasure: true,
  quantity: true,
  unitPrice: true,
  discountPercent: true,
  taxCodeId: true,
  taxCode: true,
  taxRate: true,
  lineSubtotal: true,
  lineDiscount: true,
  lineTax: true,
  lineTotal: true,
  sortOrder: true,
} satisfies Prisma.InvoiceLineSelect;

const invoiceListSelect = {
  id: true,
  organizationId: true,
  invoiceNumber: true,
  sourceSalesOrderId: true,
  customerId: true,
  contactId: true,
  opportunityId: true,
  ownerUserId: true,
  status: true,
  issueDate: true,
  dueDate: true,
  customerReference: true,
  currencyCode: true,
  exchangeRateToBase: true,
  baseCurrencyCode: true,
  paymentTermId: true,
  subtotal: true,
  discountTotal: true,
  taxTotal: true,
  total: true,
  totalBase: true,
  amountPaid: true,
  notes: true,
  terms: true,
  sentAt: true,
  paidAt: true,
  voidedAt: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, customerNumber: true, displayName: true, email: true, status: true } },
  contact: { select: { id: true, displayName: true, email: true } },
  opportunity: { select: { id: true, opportunityNumber: true, title: true, stage: true } },
  sourceSalesOrder: { select: { id: true, salesOrderNumber: true, status: true, total: true } },
  owner: { select: { id: true, firstName: true, lastName: true, email: true } },
  currency: { select: { code: true, symbol: true } },
  paymentTerm: { select: { id: true, code: true, name: true, dueDays: true } },
  _count: { select: { lines: true } },
} satisfies Prisma.InvoiceSelect;

const invoiceDetailSelect = {
  ...invoiceListSelect,
  lines: { orderBy: { sortOrder: "asc" }, select: lineSelect },
} satisfies Prisma.InvoiceSelect;

export type InvoiceLineWriteData = Omit<Prisma.InvoiceLineUncheckedCreateWithoutInvoiceInput, "organizationId">;

export interface InvoiceWriteData {
  sourceSalesOrderId?: string | null;
  customerId: string;
  contactId?: string | null;
  opportunityId?: string | null;
  ownerUserId: string;
  issueDate: string;
  dueDate?: string | null;
  customerReference?: string | null;
  currencyCode: string;
  exchangeRateToBase?: string | null;
  baseCurrencyCode?: string | null;
  paymentTermId?: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  totalBase?: string | null;
  amountPaid?: string;
  notes?: string | null;
  terms?: string | null;
  lines: InvoiceLineWriteData[];
}

export class InvoicesRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(filter: InvoiceListFilter, limit: number, order: "asc" | "desc", cursor?: string) {
    const decoded = cursor ? decodeCursor(cursor) : null;
    const where = buildInvoiceListWhere(filter);
    const rows = await this.db.invoice.findMany({
      where: decoded ? { AND: [where, cursorFilter(decoded, order)] } : where,
      orderBy: [{ createdAt: order }, { id: order }],
      take: limit + 1,
      select: invoiceListSelect,
    });
    return toCursorPage(rows, limit);
  }

  async findById(organizationId: string, id: string, includeDeleted = false) {
    return this.db.invoice.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: invoiceDetailSelect,
    });
  }

  async findSalesOrder(organizationId: string, salesOrderId: string) {
    return this.db.salesOrder.findFirst({
      where: { id: salesOrderId, organizationId, deletedAt: null },
      select: { id: true, salesOrderNumber: true, customerId: true, currencyCode: true, status: true },
    });
  }

  async findCustomer(organizationId: string, customerId: string) {
    return this.db.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: {
        id: true,
        customerNumber: true,
        displayName: true,
        status: true,
        currencyCode: true,
        paymentTermId: true,
      },
    });
  }

  async findContact(organizationId: string, customerId: string, contactId: string) {
    return this.db.contact.findFirst({
      where: { id: contactId, customerId, organizationId, deletedAt: null },
      select: { id: true, displayName: true, customerId: true },
    });
  }

  async findOpportunity(organizationId: string, opportunityId: string) {
    return this.db.opportunity.findFirst({
      where: { id: opportunityId, organizationId, deletedAt: null },
      select: { id: true, customerId: true, contactId: true },
    });
  }

  async findPaymentTerm(organizationId: string, paymentTermId: string) {
    return this.db.paymentTerm.findFirst({
      where: { id: paymentTermId, organizationId, isActive: true },
      select: { id: true, code: true, name: true, dueDays: true },
    });
  }

  async findOrganization(organizationId: string) {
    return this.db.organization.findUnique({
      where: { id: organizationId },
      select: { baseCurrencyCode: true },
    });
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

  async findExchangeRateValue(
    organizationId: string,
    baseCurrencyCode: string,
    quoteCurrencyCode: string,
    asOf: Date = utcDateOnly(new Date()),
  ): Promise<string | null> {
    const row = await this.db.exchangeRate.findFirst({
      where: { organizationId, baseCurrencyCode, quoteCurrencyCode, isActive: true, effectiveDate: { lte: asOf } },
      orderBy: { effectiveDate: "desc" },
      select: { rate: true },
    });
    return row ? row.rate.toString() : null;
  }

  async findProductsByIds(organizationId: string, ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    return this.db.product.findMany({
      where: { organizationId, id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        taxCodeId: true,
        unitOfMeasure: { select: { code: true } },
        taxCode: { select: { id: true, code: true, rate: true } },
      },
    });
  }

  async findTaxCodesByIds(organizationId: string, ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    return this.db.taxCode.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true, code: true, rate: true },
    });
  }

  async formOptions(organizationId: string) {
    const [customers, owners, currencies, paymentTerms, taxCodes, products, salesOrders] = await Promise.all([
      this.db.customer.findMany({
        where: { organizationId, deletedAt: null, status: "ACTIVE" },
        orderBy: { displayName: "asc" },
        take: 500,
        select: { id: true, customerNumber: true, displayName: true, currencyCode: true, paymentTermId: true },
      }),
      this.db.user.findMany({
        where: { status: "ACTIVE", memberships: { some: { organizationId, status: "ACTIVE" } } },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      this.db.currency.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
        select: { code: true, name: true, symbol: true },
      }),
      this.db.paymentTerm.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true, dueDays: true },
      }),
      this.db.taxCode.findMany({
        where: { organizationId, isActive: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true, rate: true },
      }),
      this.db.product.findMany({
        where: { organizationId, deletedAt: null, status: "ACTIVE" },
        orderBy: { name: "asc" },
        take: 500,
        select: {
          id: true,
          code: true,
          name: true,
          taxCodeId: true,
          unitOfMeasure: { select: { code: true } },
          taxCode: { select: { id: true, code: true, rate: true } },
        },
      }),
      this.db.salesOrder.findMany({
        where: { organizationId, deletedAt: null, status: { in: ["CONFIRMED", "PROCESSING", "FULFILLED"] } },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, salesOrderNumber: true, customerId: true, currencyCode: true, total: true },
      }),
    ]);

    return {
      customers,
      owners,
      currencies,
      paymentTerms,
      taxCodes,
      salesOrders,
      products: products.map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        taxCodeId: product.taxCodeId,
        unitOfMeasure: product.unitOfMeasure.code,
        taxCode: product.taxCode?.code ?? null,
        taxRate: product.taxCode?.rate.toFixed(4) ?? "0.0000",
      })),
    };
  }

  async create(organizationId: string, actorId: string, input: InvoiceWriteData) {
    const id = await this.transaction(async (tx) => {
      const invoiceNumber = await allocateDocumentNumberIn(tx, organizationId, "INVOICE");
      const created = await tx.invoice.create({
        data: {
          organizationId,
          invoiceNumber,
          sourceSalesOrderId: input.sourceSalesOrderId ?? null,
          customerId: input.customerId,
          contactId: input.contactId ?? null,
          opportunityId: input.opportunityId ?? null,
          ownerUserId: input.ownerUserId,
          status: "DRAFT",
          issueDate: dateOnly(input.issueDate),
          dueDate: input.dueDate ? dateOnly(input.dueDate) : null,
          customerReference: input.customerReference ?? null,
          currencyCode: input.currencyCode,
          exchangeRateToBase: input.exchangeRateToBase ?? null,
          baseCurrencyCode: input.baseCurrencyCode ?? null,
          paymentTermId: input.paymentTermId ?? null,
          subtotal: input.subtotal,
          discountTotal: input.discountTotal,
          taxTotal: input.taxTotal,
          total: input.total,
          totalBase: input.totalBase ?? null,
          amountPaid: input.amountPaid ?? "0",
          notes: input.notes ?? null,
          terms: input.terms ?? null,
          createdById: actorId,
          updatedById: actorId,
          lines: {
            create: input.lines.map((line) => ({ ...line, organizationId })),
          },
        },
        select: { id: true },
      });
      return created.id;
    });
    return this.findById(organizationId, id);
  }

  async update(organizationId: string, id: string, actorId: string, input: InvoiceWriteData) {
    const updated = await this.transaction(async (tx) => {
      const existing = await tx.invoice.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) {
        return false;
      }
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id, organizationId } });
      await tx.invoice.update({
        where: { id },
        data: {
          customerId: input.customerId,
          contactId: input.contactId ?? null,
          opportunityId: input.opportunityId ?? null,
          ownerUserId: input.ownerUserId,
          issueDate: dateOnly(input.issueDate),
          dueDate: input.dueDate ? dateOnly(input.dueDate) : null,
          customerReference: input.customerReference ?? null,
          currencyCode: input.currencyCode,
          exchangeRateToBase: input.exchangeRateToBase ?? null,
          baseCurrencyCode: input.baseCurrencyCode ?? null,
          paymentTermId: input.paymentTermId ?? null,
          subtotal: input.subtotal,
          discountTotal: input.discountTotal,
          taxTotal: input.taxTotal,
          total: input.total,
          totalBase: input.totalBase ?? null,
          amountPaid: input.amountPaid ?? "0",
          notes: input.notes ?? null,
          terms: input.terms ?? null,
          updatedById: actorId,
          lines: {
            create: input.lines.map((line) => ({ ...line, organizationId })),
          },
        },
      });
      return true;
    });
    return updated ? this.findById(organizationId, id) : null;
  }

  async softDelete(organizationId: string, id: string, actorId: string) {
    const result = await this.db.invoice.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
  }

  async restore(organizationId: string, id: string, actorId: string) {
    const result = await this.db.invoice.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null, updatedById: actorId },
    });
    return result.count === 1;
  }

  async changeStatus(
    organizationId: string,
    id: string,
    actorId: string,
    status: "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID",
    amountPaid?: string,
  ) {
    const now = new Date();
    const result = await this.db.invoice.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: {
        status,
        updatedById: actorId,
        ...(amountPaid !== undefined ? { amountPaid } : {}),
        ...(status === "SENT" ? { sentAt: now } : {}),
        ...(status === "PAID" ? { paidAt: now } : {}),
        ...(status === "VOID" ? { voidedAt: now } : {}),
      },
    });
    return result.count === 1;
  }
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function utcDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

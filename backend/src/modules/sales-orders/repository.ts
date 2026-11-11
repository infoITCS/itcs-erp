import type { Prisma, PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { ConflictError } from "../../common/errors/app-error";
import { allocateDocumentNumberIn } from "../../common/numbering/allocate";
import { cursorFilter, decodeCursor, toCursorPage } from "../../common/pagination/cursor";
import { addDays, today } from "../../common/sales/totals";
import { buildSalesOrderListWhere, type SalesOrderListFilter } from "./list-filter";

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
} satisfies Prisma.SalesOrderLineSelect;

const salesOrderListSelect = {
  id: true,
  organizationId: true,
  salesOrderNumber: true,
  sourceQuoteId: true,
  customerId: true,
  contactId: true,
  opportunityId: true,
  ownerUserId: true,
  status: true,
  orderDate: true,
  expectedDeliveryDate: true,
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
  notes: true,
  terms: true,
  confirmedAt: true,
  fulfilledAt: true,
  cancelledAt: true,
  closedAt: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, customerNumber: true, displayName: true, email: true, status: true } },
  contact: { select: { id: true, displayName: true, email: true } },
  opportunity: { select: { id: true, opportunityNumber: true, title: true, stage: true } },
  sourceQuote: { select: { id: true, quoteNumber: true, status: true, total: true } },
  owner: { select: { id: true, firstName: true, lastName: true, email: true } },
  currency: { select: { code: true, symbol: true } },
  paymentTerm: { select: { id: true, code: true, name: true, dueDays: true } },
  _count: { select: { lines: true, invoices: true } },
} satisfies Prisma.SalesOrderSelect;

const salesOrderDetailSelect = {
  ...salesOrderListSelect,
  lines: { orderBy: { sortOrder: "asc" }, select: lineSelect },
  invoices: {
    orderBy: { createdAt: "desc" },
    select: { id: true, invoiceNumber: true, status: true, issueDate: true, dueDate: true, total: true },
  },
} satisfies Prisma.SalesOrderSelect;

export type SalesOrderLineWriteData = Omit<
  Prisma.SalesOrderLineUncheckedCreateWithoutSalesOrderInput,
  "organizationId"
>;

export interface SalesOrderWriteData {
  sourceQuoteId?: string | null;
  customerId: string;
  contactId?: string | null;
  opportunityId?: string | null;
  ownerUserId: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
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
  notes?: string | null;
  terms?: string | null;
  lines: SalesOrderLineWriteData[];
}

export class SalesOrdersRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(filter: SalesOrderListFilter, limit: number, order: "asc" | "desc", cursor?: string) {
    const decoded = cursor ? decodeCursor(cursor) : null;
    const where = buildSalesOrderListWhere(filter);
    const rows = await this.db.salesOrder.findMany({
      where: decoded ? { AND: [where, cursorFilter(decoded, order)] } : where,
      orderBy: [{ createdAt: order }, { id: order }],
      take: limit + 1,
      select: salesOrderListSelect,
    });
    return toCursorPage(rows, limit);
  }

  async findById(organizationId: string, id: string, includeDeleted = false) {
    return this.db.salesOrder.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: salesOrderDetailSelect,
    });
  }

  async findQuote(organizationId: string, quoteId: string) {
    return this.db.quote.findFirst({
      where: { id: quoteId, organizationId, deletedAt: null },
      select: { id: true, quoteNumber: true, customerId: true, currencyCode: true },
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
        creditHold: true,
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
      select: { id: true, customerId: true, contactId: true, opportunityNumber: true },
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
    const [customers, owners, currencies, paymentTerms, taxCodes, products, quotes] = await Promise.all([
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
      this.db.quote.findMany({
        where: { organizationId, deletedAt: null, status: { in: ["ACCEPTED", "SENT"] } },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, quoteNumber: true, customerId: true, currencyCode: true, total: true },
      }),
    ]);

    return {
      customers,
      owners,
      currencies,
      paymentTerms,
      taxCodes,
      quotes,
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

  async create(organizationId: string, actorId: string, input: SalesOrderWriteData) {
    const id = await this.transaction(async (tx) => {
      const salesOrderNumber = await allocateDocumentNumberIn(tx, organizationId, "SALES_ORDER");
      const created = await tx.salesOrder.create({
        data: {
          organizationId,
          salesOrderNumber,
          sourceQuoteId: input.sourceQuoteId ?? null,
          customerId: input.customerId,
          contactId: input.contactId ?? null,
          opportunityId: input.opportunityId ?? null,
          ownerUserId: input.ownerUserId,
          status: "DRAFT",
          orderDate: dateOnly(input.orderDate),
          expectedDeliveryDate: input.expectedDeliveryDate ? dateOnly(input.expectedDeliveryDate) : null,
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

  async update(organizationId: string, id: string, actorId: string, input: SalesOrderWriteData) {
    const updated = await this.transaction(async (tx) => {
      const existing = await tx.salesOrder.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) {
        return false;
      }
      await tx.salesOrderLine.deleteMany({ where: { salesOrderId: id, organizationId } });
      await tx.salesOrder.update({
        where: { id },
        data: {
          customerId: input.customerId,
          contactId: input.contactId ?? null,
          opportunityId: input.opportunityId ?? null,
          ownerUserId: input.ownerUserId,
          orderDate: dateOnly(input.orderDate),
          expectedDeliveryDate: input.expectedDeliveryDate ? dateOnly(input.expectedDeliveryDate) : null,
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
    const result = await this.db.salesOrder.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
  }

  async restore(organizationId: string, id: string, actorId: string) {
    const result = await this.db.salesOrder.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null, updatedById: actorId },
    });
    return result.count === 1;
  }

  async changeStatus(
    organizationId: string,
    id: string,
    actorId: string,
    status: "CONFIRMED" | "PROCESSING" | "FULFILLED" | "CLOSED" | "CANCELLED",
  ) {
    const now = new Date();
    const result = await this.db.salesOrder.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: {
        status,
        updatedById: actorId,
        ...(status === "CONFIRMED" ? { confirmedAt: now } : {}),
        ...(status === "FULFILLED" ? { fulfilledAt: now } : {}),
        ...(status === "CANCELLED" ? { cancelledAt: now } : {}),
        ...(status === "CLOSED" ? { closedAt: now } : {}),
      },
    });
    return result.count === 1;
  }

  async convertToInvoice(
    organizationId: string,
    id: string,
    actorId: string,
    input: { issueDate?: string; dueDate?: string },
  ) {
    return this.transaction(async (tx) => {
      const order = await tx.salesOrder.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: {
          id: true,
          salesOrderNumber: true,
          status: true,
          customerId: true,
          contactId: true,
          opportunityId: true,
          ownerUserId: true,
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
          notes: true,
          terms: true,
          paymentTerm: { select: { dueDays: true } },
          lines: { orderBy: { sortOrder: "asc" } },
        },
      });
      if (!order) {
        throw new ConflictError("The sales order no longer exists");
      }
      if (!["CONFIRMED", "PROCESSING", "FULFILLED"].includes(order.status)) {
        throw new ConflictError("Only a confirmed sales order can be invoiced");
      }

      const issueDate = input.issueDate ?? today();
      const dueDate = input.dueDate ?? addDays(issueDate, order.paymentTerm?.dueDays ?? 30);
      const invoiceNumber = await allocateDocumentNumberIn(tx, organizationId, "INVOICE");

      const created = await tx.invoice.create({
        data: {
          organizationId,
          invoiceNumber,
          sourceSalesOrderId: order.id,
          customerId: order.customerId,
          contactId: order.contactId,
          opportunityId: order.opportunityId,
          ownerUserId: order.ownerUserId,
          status: "DRAFT",
          issueDate: dateOnly(issueDate),
          dueDate: dateOnly(dueDate),
          customerReference: order.customerReference,
          currencyCode: order.currencyCode,
          exchangeRateToBase: order.exchangeRateToBase,
          baseCurrencyCode: order.baseCurrencyCode,
          paymentTermId: order.paymentTermId,
          subtotal: order.subtotal,
          discountTotal: order.discountTotal,
          taxTotal: order.taxTotal,
          total: order.total,
          totalBase: order.totalBase,
          notes: order.notes,
          terms: order.terms,
          createdById: actorId,
          updatedById: actorId,
          lines: {
            create: order.lines.map((line) => ({
              organizationId,
              productId: line.productId,
              productCode: line.productCode,
              productName: line.productName,
              description: line.description,
              unitOfMeasure: line.unitOfMeasure,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountPercent: line.discountPercent,
              taxCodeId: line.taxCodeId,
              taxCode: line.taxCode,
              taxRate: line.taxRate,
              lineSubtotal: line.lineSubtotal,
              lineDiscount: line.lineDiscount,
              lineTax: line.lineTax,
              lineTotal: line.lineTotal,
              sortOrder: line.sortOrder,
            })),
          },
        },
        select: { id: true, invoiceNumber: true, issueDate: true, dueDate: true },
      });

      return created;
    });
  }
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function utcDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

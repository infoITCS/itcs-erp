import { Prisma } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import { computeCurrencySnapshot } from "../opportunities/currency-snapshot";
import type { AuditLogsService } from "../audit-logs/service";
import type { RequestMeta } from "../auth/types";
import { computeDocumentMoney, computeLineMoney, today } from "../../common/sales/totals";
import type { SalesLineInput } from "../../common/sales/validation";
import type { SalesOrdersRepository, SalesOrderLineWriteData } from "./repository";
import {
  SALES_ORDER_STATUSES,
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDERS_MODULE,
  assertSalesOrderTransition,
} from "./types";
import type {
  ChangeSalesOrderStatusInput,
  ConvertSalesOrderInput,
  CreateSalesOrderInput,
  SalesOrderListQuery,
  UpdateSalesOrderInput,
} from "./validation";

export class SalesOrdersService {
  constructor(
    private readonly repository: SalesOrdersRepository,
    private readonly audit: AuditLogsService,
  ) {}

  async list(organizationId: string, query: SalesOrderListQuery, permissions: string[]) {
    if (query.includeDeleted && !canSeeDeleted(permissions)) {
      throw new ForbiddenError();
    }
    return this.repository.list(
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
      query.order,
      query.cursor,
    );
  }

  async get(organizationId: string, id: string) {
    const order = await this.repository.findById(organizationId, id);
    if (!order) {
      throw new NotFoundError("Sales order not found");
    }
    return order;
  }

  async formOptions(organizationId: string) {
    const options = await this.repository.formOptions(organizationId);
    return {
      ...options,
      statuses: SALES_ORDER_STATUSES.map((status) => ({ value: status, label: SALES_ORDER_STATUS_LABELS[status] })),
    };
  }

  async create(organizationId: string, actorId: string, input: CreateSalesOrderInput, meta: RequestMeta) {
    const orderDate = input.orderDate ?? today();
    if (input.expectedDeliveryDate && input.expectedDeliveryDate < orderDate) {
      throw new ValidationFailedError({
        expectedDeliveryDate: ["The delivery date cannot be before the order date"],
      });
    }

    const customer = await this.requireCustomer(organizationId, input.customerId);
    const currencyCode = input.currencyCode ?? customer.currencyCode;
    await this.requireCurrency(currencyCode);
    const ownerUserId = input.ownerUserId ?? actorId;
    await this.requireOwner(organizationId, ownerUserId);
    await this.requireContact(organizationId, customer.id, input.contactId);
    await this.requireOpportunity(organizationId, input.opportunityId);
    if (input.paymentTermId) {
      await this.requirePaymentTerm(organizationId, input.paymentTermId);
    }
    if (input.sourceQuoteId) {
      const quote = await this.repository.findQuote(organizationId, input.sourceQuoteId);
      if (!quote) {
        throw new ValidationFailedError({ sourceQuoteId: ["Choose a valid quote"] });
      }
    }

    const lines = await this.buildLines(organizationId, input.lines);
    const money = computeDocumentMoney(lines);
    const snapshot = await this.computeSnapshot(organizationId, money.total, currencyCode, orderDate);

    const order = await this.repository.create(organizationId, actorId, {
      sourceQuoteId: input.sourceQuoteId,
      customerId: customer.id,
      contactId: input.contactId,
      opportunityId: input.opportunityId,
      ownerUserId,
      orderDate,
      expectedDeliveryDate: input.expectedDeliveryDate,
      customerReference: input.customerReference,
      currencyCode,
      exchangeRateToBase: snapshot.exchangeRateToBase,
      baseCurrencyCode: snapshot.baseCurrencyCode,
      paymentTermId: input.paymentTermId,
      subtotal: money.subtotal,
      discountTotal: money.discountTotal,
      taxTotal: money.taxTotal,
      total: money.total,
      totalBase: snapshot.estimatedValueBase,
      notes: input.notes,
      terms: input.terms,
      lines,
    });
    if (!order) {
      throw new NotFoundError("Sales order not found");
    }

    await this.record(organizationId, actorId, "sales-orders.created", "sales-order", order.id, meta, {
      salesOrderId: order.id,
      salesOrderNumber: order.salesOrderNumber,
      customerId: order.customerId,
      status: order.status,
      total: order.total.toString(),
    });
    return order;
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    input: UpdateSalesOrderInput,
    meta: RequestMeta,
  ) {
    const existing = await this.get(organizationId, id);
    if (existing.status !== "DRAFT") {
      throw new ValidationFailedError({ status: ["Only a draft sales order can be edited"] });
    }

    const customerId = input.customerId ?? existing.customerId;
    const customer = await this.requireCustomer(organizationId, customerId);
    const currencyCode = input.currencyCode ?? existing.currencyCode;
    await this.requireCurrency(currencyCode);
    const ownerUserId = input.ownerUserId ?? existing.ownerUserId;
    await this.requireOwner(organizationId, ownerUserId);

    const orderDate = input.orderDate ?? isoDate(existing.orderDate)!;
    const expectedDeliveryDate = resolveNullable(
      input.expectedDeliveryDate,
      isoDate(existing.expectedDeliveryDate),
    );
    if (expectedDeliveryDate && expectedDeliveryDate < orderDate) {
      throw new ValidationFailedError({
        expectedDeliveryDate: ["The delivery date cannot be before the order date"],
      });
    }

    const contactId = resolveNullable(input.contactId, existing.contactId);
    const opportunityId = resolveNullable(input.opportunityId, existing.opportunityId);
    const paymentTermId = resolveNullable(input.paymentTermId, existing.paymentTermId);
    await this.requireContact(organizationId, customer.id, contactId ?? undefined);
    await this.requireOpportunity(organizationId, opportunityId ?? undefined);
    if (paymentTermId) {
      await this.requirePaymentTerm(organizationId, paymentTermId);
    }

    const lines = await this.buildLines(
      organizationId,
      input.lines ??
        existing.lines.map((line) => ({
          productId: line.productId ?? undefined,
          productCode: line.productCode ?? undefined,
          productName: line.productName,
          description: line.description ?? undefined,
          unitOfMeasure: line.unitOfMeasure ?? undefined,
          quantity: line.quantity.toFixed(4),
          unitPrice: line.unitPrice.toFixed(4),
          discountPercent: line.discountPercent.toFixed(4),
          taxCodeId: line.taxCodeId ?? undefined,
          taxRate: line.taxRate.toFixed(4),
        })),
    );
    const money = computeDocumentMoney(lines);
    const snapshot = await this.computeSnapshot(organizationId, money.total, currencyCode, orderDate);

    const updated = await this.repository.update(organizationId, id, actorId, {
      customerId: customer.id,
      contactId,
      opportunityId,
      ownerUserId,
      orderDate,
      expectedDeliveryDate,
      customerReference: resolveNullable(input.customerReference, existing.customerReference),
      currencyCode,
      exchangeRateToBase: snapshot.exchangeRateToBase,
      baseCurrencyCode: snapshot.baseCurrencyCode,
      paymentTermId,
      subtotal: money.subtotal,
      discountTotal: money.discountTotal,
      taxTotal: money.taxTotal,
      total: money.total,
      totalBase: snapshot.estimatedValueBase,
      notes: resolveNullable(input.notes, existing.notes),
      terms: resolveNullable(input.terms, existing.terms),
      lines,
    });
    if (!updated) {
      throw new NotFoundError("Sales order not found");
    }

    await this.record(organizationId, actorId, "sales-orders.updated", "sales-order", id, meta, {
      salesOrderId: id,
      fields: Object.keys(input),
    });
    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    if (existing.invoices.length > 0) {
      throw new ConflictError("A sales order with an invoice cannot be deleted");
    }
    const removed = await this.repository.softDelete(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Sales order not found");
    }
    await this.record(organizationId, actorId, "sales-orders.deleted", "sales-order", id, meta, {
      salesOrderId: id,
      salesOrderNumber: existing.salesOrderNumber,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async restore(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const restored = await this.repository.restore(organizationId, id, actorId);
    if (!restored) {
      throw new NotFoundError("Deleted sales order not found");
    }
    await this.record(organizationId, actorId, "sales-orders.restored", "sales-order", id, meta, {
      salesOrderId: id,
    });
    return this.get(organizationId, id);
  }

  async changeStatus(
    organizationId: string,
    actorId: string,
    id: string,
    input: ChangeSalesOrderStatusInput,
    meta: RequestMeta,
  ) {
    const existing = await this.get(organizationId, id);
    assertSalesOrderTransition(existing.status, input.status);
    const updated = await this.repository.changeStatus(organizationId, id, actorId, input.status);
    if (!updated) {
      throw new NotFoundError("Sales order not found");
    }
    await this.record(
      organizationId,
      actorId,
      "sales-orders.status.changed",
      "sales-order",
      id,
      meta,
      { salesOrderId: id, status: input.status },
      { status: existing.status },
    );
    return this.get(organizationId, id);
  }

  async convertToInvoice(
    organizationId: string,
    actorId: string,
    id: string,
    input: ConvertSalesOrderInput,
    meta: RequestMeta,
  ) {
    const existing = await this.get(organizationId, id);
    if (!["CONFIRMED", "PROCESSING", "FULFILLED"].includes(existing.status)) {
      throw new ValidationFailedError({ status: ["Only a confirmed sales order can be invoiced"] });
    }
    if (input?.issueDate && input.dueDate && input.dueDate < input.issueDate) {
      throw new ValidationFailedError({ dueDate: ["The due date cannot be before the issue date"] });
    }
    const invoice = await this.repository.convertToInvoice(organizationId, id, actorId, {
      issueDate: input?.issueDate,
      dueDate: input?.dueDate,
    });
    await this.record(organizationId, actorId, "sales-orders.invoiced", "sales-order", id, meta, {
      salesOrderId: id,
      salesOrderNumber: existing.salesOrderNumber,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    });
    return { salesOrder: await this.get(organizationId, id), invoice };
  }

  async listAudit(organizationId: string, id: string, limit: number, cursor?: string) {
    await this.get(organizationId, id);
    return this.audit.list(organizationId, limit, cursor, { entityType: "sales-order", entityId: id });
  }

  private async buildLines(organizationId: string, input: SalesLineInput[]): Promise<SalesOrderLineWriteData[]> {
    const productIds = unique(input.flatMap((line) => (line.productId ? [line.productId] : [])));
    const products = await this.repository.findProductsByIds(organizationId, productIds);
    const productMap = new Map(products.map((product) => [product.id, product]));

    const taxIds = unique(
      input.flatMap((line) => [
        ...(line.taxCodeId ? [line.taxCodeId] : []),
        ...(line.productId ? [productMap.get(line.productId)?.taxCodeId].filter(isString) : []),
      ]),
    );
    const taxCodes = await this.repository.findTaxCodesByIds(organizationId, taxIds);
    const taxMap = new Map(taxCodes.map((taxCode) => [taxCode.id, taxCode]));

    return input.map((line, index) => {
      const product = line.productId ? productMap.get(line.productId) : undefined;
      const productName = line.productName ?? product?.name;
      if (!productName) {
        throw new ValidationFailedError({ lines: [`Line ${index + 1}: choose a valid product`] });
      }

      const taxCodeId = line.taxCodeId ?? product?.taxCodeId ?? null;
      const taxCode = taxCodeId ? taxMap.get(taxCodeId) : undefined;
      const taxRate = line.taxRate ?? taxCode?.rate.toFixed(4);
      if (taxCodeId && taxRate === undefined) {
        throw new ValidationFailedError({ lines: [`Line ${index + 1}: choose a valid tax code`] });
      }

      const money = computeLineMoney({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        taxRate: taxRate ?? "0",
      });

      return {
        productId: product?.id ?? line.productId ?? null,
        productCode: line.productCode ?? product?.code ?? null,
        productName,
        description: line.description ?? null,
        unitOfMeasure: line.unitOfMeasure ?? product?.unitOfMeasure.code ?? null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent ?? "0",
        taxCodeId,
        taxCode: taxCode?.code ?? null,
        taxRate: taxRate ?? "0",
        lineSubtotal: money.lineSubtotal,
        lineDiscount: money.lineDiscount,
        lineTax: money.lineTax,
        lineTotal: money.lineTotal,
        sortOrder: index,
      };
    });
  }

  private async computeSnapshot(
    organizationId: string,
    total: string,
    currencyCode: string,
    asOf: string,
  ) {
    const organization = await this.repository.findOrganization(organizationId);
    if (!organization) {
      throw new NotFoundError("Organization not found");
    }
    return computeCurrencySnapshot(total, currencyCode, organization.baseCurrencyCode, (base, quote) =>
      this.repository.findExchangeRateValue(organizationId, base, quote, dateOnly(asOf)),
    );
  }

  private async requireCustomer(organizationId: string, customerId: string) {
    const customer = await this.repository.findCustomer(organizationId, customerId);
    if (!customer) {
      throw new ValidationFailedError({ customerId: ["Choose an active customer"] });
    }
    if (customer.status !== "ACTIVE") {
      throw new ValidationFailedError({ customerId: ["This customer is not active"] });
    }
    return customer;
  }

  private async requireContact(organizationId: string, customerId: string, contactId?: string) {
    if (!contactId) {
      return;
    }
    const contact = await this.repository.findContact(organizationId, customerId, contactId);
    if (!contact) {
      throw new ValidationFailedError({ contactId: ["Choose a contact that belongs to this customer"] });
    }
  }

  private async requireOpportunity(organizationId: string, opportunityId?: string) {
    if (!opportunityId) {
      return;
    }
    const opportunity = await this.repository.findOpportunity(organizationId, opportunityId);
    if (!opportunity) {
      throw new ValidationFailedError({ opportunityId: ["Choose a valid opportunity"] });
    }
  }

  private async requirePaymentTerm(organizationId: string, paymentTermId: string) {
    const term = await this.repository.findPaymentTerm(organizationId, paymentTermId);
    if (!term) {
      throw new ValidationFailedError({ paymentTermId: ["Choose an active payment term"] });
    }
  }

  private async requireOwner(organizationId: string, ownerUserId: string) {
    if (!(await this.repository.findActiveOrgUser(organizationId, ownerUserId))) {
      throw new ValidationFailedError({ ownerUserId: ["Choose an active user in this organization"] });
    }
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
      module: SALES_ORDERS_MODULE,
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
  return permissions.includes("sales-orders:delete") || permissions.includes("sales-orders:restore");
}

function resolveNullable<T>(incoming: T | null | undefined, current: T | null): T | null {
  if (incoming === undefined) {
    return current;
  }
  return incoming;
}

function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isString(value: string | null | undefined): value is string {
  return typeof value === "string";
}

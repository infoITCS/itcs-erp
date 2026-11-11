import { Prisma } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import { computeCurrencySnapshot } from "../opportunities/currency-snapshot";
import type { AuditLogsService } from "../audit-logs/service";
import type { RequestMeta } from "../auth/types";
import { computeDocumentMoney, computeLineMoney, today } from "../../common/sales/totals";
import type { SalesLineInput } from "../../common/sales/validation";
import type { QuotesRepository, QuoteLineWriteData } from "./repository";
import { assertQuoteTransition, QUOTE_STATUSES, QUOTE_STATUS_LABELS, QUOTES_MODULE } from "./types";
import type {
  ChangeQuoteStatusInput,
  ConvertQuoteInput,
  CreateQuoteInput,
  QuoteListQuery,
  UpdateQuoteInput,
} from "./validation";

export class QuotesService {
  constructor(
    private readonly repository: QuotesRepository,
    private readonly audit: AuditLogsService,
  ) {}

  async list(organizationId: string, query: QuoteListQuery, permissions: string[]) {
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
    const quote = await this.repository.findById(organizationId, id);
    if (!quote) {
      throw new NotFoundError("Quote not found");
    }
    return quote;
  }

  async formOptions(organizationId: string) {
    const options = await this.repository.formOptions(organizationId);
    return {
      ...options,
      statuses: QUOTE_STATUSES.map((status) => ({ value: status, label: QUOTE_STATUS_LABELS[status] })),
    };
  }

  async create(organizationId: string, actorId: string, input: CreateQuoteInput, meta: RequestMeta) {
    const issueDate = input.issueDate ?? today();
    if (input.validUntil && input.validUntil < issueDate) {
      throw new ValidationFailedError({ validUntil: ["The validity date cannot be before the issue date"] });
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

    const lines = await this.buildLines(organizationId, input.lines);
    const money = computeDocumentMoney(lines);
    const snapshot = await this.computeSnapshot(organizationId, money.total, currencyCode, issueDate);

    const quote = await this.repository.create(organizationId, actorId, {
      customerId: customer.id,
      contactId: input.contactId,
      opportunityId: input.opportunityId,
      ownerUserId,
      issueDate,
      validUntil: input.validUntil,
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
    if (!quote) {
      throw new NotFoundError("Quote not found");
    }

    await this.record(organizationId, actorId, "quotes.created", "quote", quote.id, meta, {
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      customerId: quote.customerId,
      status: quote.status,
      total: quote.total.toString(),
    });
    return quote;
  }

  async update(organizationId: string, actorId: string, id: string, input: UpdateQuoteInput, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    if (existing.status !== "DRAFT") {
      throw new ValidationFailedError({ status: ["Only a draft quote can be edited"] });
    }

    const customerId = input.customerId ?? existing.customerId;
    const customer = await this.requireCustomer(organizationId, customerId);
    const currencyCode = input.currencyCode ?? existing.currencyCode;
    await this.requireCurrency(currencyCode);
    const ownerUserId = input.ownerUserId ?? existing.ownerUserId;
    await this.requireOwner(organizationId, ownerUserId);

    const issueDate = input.issueDate ?? isoDate(existing.issueDate)!;
    const validUntil = resolveNullable(input.validUntil, isoDate(existing.validUntil));
    if (validUntil && validUntil < issueDate) {
      throw new ValidationFailedError({ validUntil: ["The validity date cannot be before the issue date"] });
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
    const snapshot = await this.computeSnapshot(organizationId, money.total, currencyCode, issueDate);

    const updated = await this.repository.update(organizationId, id, actorId, {
      customerId: customer.id,
      contactId,
      opportunityId,
      ownerUserId,
      issueDate,
      validUntil,
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
      throw new NotFoundError("Quote not found");
    }

    await this.record(organizationId, actorId, "quotes.updated", "quote", id, meta, {
      quoteId: id,
      fields: Object.keys(input),
    });
    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    if (existing.status === "ACCEPTED" || existing.salesOrders.length > 0) {
      throw new ConflictError("An accepted quote with a sales order cannot be deleted");
    }
    const removed = await this.repository.softDelete(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Quote not found");
    }
    await this.record(organizationId, actorId, "quotes.deleted", "quote", id, meta, {
      quoteId: id,
      quoteNumber: existing.quoteNumber,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async restore(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const restored = await this.repository.restore(organizationId, id, actorId);
    if (!restored) {
      throw new NotFoundError("Deleted quote not found");
    }
    await this.record(organizationId, actorId, "quotes.restored", "quote", id, meta, { quoteId: id });
    return this.get(organizationId, id);
  }

  async changeStatus(
    organizationId: string,
    actorId: string,
    id: string,
    input: ChangeQuoteStatusInput,
    meta: RequestMeta,
  ) {
    const existing = await this.get(organizationId, id);
    assertQuoteTransition(existing.status, input.status);
    const updated = await this.repository.changeStatus(organizationId, id, actorId, input.status);
    if (!updated) {
      throw new NotFoundError("Quote not found");
    }
    await this.record(
      organizationId,
      actorId,
      "quotes.status.changed",
      "quote",
      id,
      meta,
      { quoteId: id, status: input.status },
      { status: existing.status },
    );
    return this.get(organizationId, id);
  }

  async convertToOrder(
    organizationId: string,
    actorId: string,
    id: string,
    input: ConvertQuoteInput,
    meta: RequestMeta,
  ) {
    const existing = await this.get(organizationId, id);
    if (existing.status !== "DRAFT" && existing.status !== "SENT") {
      throw new ValidationFailedError({
        status: ["Only a draft or sent quote can be converted to a sales order"],
      });
    }
    const order = await this.repository.convertToOrder(organizationId, id, actorId, {
      orderDate: input?.orderDate,
      expectedDeliveryDate: input?.expectedDeliveryDate,
    });
    await this.record(organizationId, actorId, "quotes.converted", "quote", id, meta, {
      quoteId: id,
      quoteNumber: existing.quoteNumber,
      salesOrderId: order.id,
      salesOrderNumber: order.salesOrderNumber,
    });
    return { quote: await this.get(organizationId, id), salesOrder: order };
  }

  async listAudit(organizationId: string, id: string, limit: number, cursor?: string) {
    await this.get(organizationId, id);
    return this.audit.list(organizationId, limit, cursor, { entityType: "quote", entityId: id });
  }

  private async buildLines(organizationId: string, input: SalesLineInput[]): Promise<QuoteLineWriteData[]> {
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
      module: QUOTES_MODULE,
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
  return permissions.includes("quotes:delete") || permissions.includes("quotes:restore");
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

import { Prisma } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import { computeCurrencySnapshot } from "../opportunities/currency-snapshot";
import type { AuditLogsService } from "../audit-logs/service";
import type { RequestMeta } from "../auth/types";
import { computeDocumentMoney, computeLineMoney, today } from "../../common/sales/totals";
import type { SalesLineInput } from "../../common/sales/validation";
import type { InvoicesRepository, InvoiceLineWriteData } from "./repository";
import { INVOICES_MODULE, INVOICE_STATUSES, INVOICE_STATUS_LABELS, assertInvoiceTransition } from "./types";
import type {
  ChangeInvoiceStatusInput,
  CreateInvoiceInput,
  InvoiceListQuery,
  UpdateInvoiceInput,
} from "./validation";

export class InvoicesService {
  constructor(
    private readonly repository: InvoicesRepository,
    private readonly audit: AuditLogsService,
  ) {}

  async list(organizationId: string, query: InvoiceListQuery, permissions: string[]) {
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
    const invoice = await this.repository.findById(organizationId, id);
    if (!invoice) {
      throw new NotFoundError("Invoice not found");
    }
    return invoice;
  }

  async formOptions(organizationId: string) {
    const options = await this.repository.formOptions(organizationId);
    return {
      ...options,
      statuses: INVOICE_STATUSES.map((status) => ({ value: status, label: INVOICE_STATUS_LABELS[status] })),
    };
  }

  async create(organizationId: string, actorId: string, input: CreateInvoiceInput, meta: RequestMeta) {
    const issueDate = input.issueDate ?? today();
    const customer = await this.requireCustomer(organizationId, input.customerId);
    const currencyCode = input.currencyCode ?? customer.currencyCode;
    await this.requireCurrency(currencyCode);
    const ownerUserId = input.ownerUserId ?? actorId;
    await this.requireOwner(organizationId, ownerUserId);
    await this.requireContact(organizationId, customer.id, input.contactId);
    await this.requireOpportunity(organizationId, input.opportunityId);

    const paymentTerm = input.paymentTermId
      ? await this.requirePaymentTerm(organizationId, input.paymentTermId)
      : null;
    const dueDate = input.dueDate ?? (paymentTerm ? addDays(issueDate, paymentTerm.dueDays) : null);
    if (dueDate && dueDate < issueDate) {
      throw new ValidationFailedError({ dueDate: ["The due date cannot be before the issue date"] });
    }

    if (input.sourceSalesOrderId) {
      const salesOrder = await this.repository.findSalesOrder(organizationId, input.sourceSalesOrderId);
      if (!salesOrder) {
        throw new ValidationFailedError({ sourceSalesOrderId: ["Choose a valid sales order"] });
      }
    }

    const lines = await this.buildLines(organizationId, input.lines);
    const money = computeDocumentMoney(lines);
    const snapshot = await this.computeSnapshot(organizationId, money.total, currencyCode, issueDate);

    const invoice = await this.repository.create(organizationId, actorId, {
      sourceSalesOrderId: input.sourceSalesOrderId,
      customerId: customer.id,
      contactId: input.contactId,
      opportunityId: input.opportunityId,
      ownerUserId,
      issueDate,
      dueDate,
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
    if (!invoice) {
      throw new NotFoundError("Invoice not found");
    }

    await this.record(organizationId, actorId, "invoices.created", "invoice", invoice.id, meta, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      status: invoice.status,
      total: invoice.total.toString(),
    });
    return invoice;
  }

  async update(organizationId: string, actorId: string, id: string, input: UpdateInvoiceInput, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    if (existing.status !== "DRAFT") {
      throw new ValidationFailedError({ status: ["Only a draft invoice can be edited"] });
    }

    const customerId = input.customerId ?? existing.customerId;
    const customer = await this.requireCustomer(organizationId, customerId);
    const currencyCode = input.currencyCode ?? existing.currencyCode;
    await this.requireCurrency(currencyCode);
    const ownerUserId = input.ownerUserId ?? existing.ownerUserId;
    await this.requireOwner(organizationId, ownerUserId);

    const issueDate = input.issueDate ?? isoDate(existing.issueDate)!;
    const dueDate = resolveNullable(input.dueDate, isoDate(existing.dueDate));
    if (dueDate && dueDate < issueDate) {
      throw new ValidationFailedError({ dueDate: ["The due date cannot be before the issue date"] });
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
    if (Number(existing.amountPaid) > Number(money.total)) {
      throw new ValidationFailedError({
        lines: ["The invoice total cannot be lower than the amount already paid"],
      });
    }
    const snapshot = await this.computeSnapshot(organizationId, money.total, currencyCode, issueDate);

    const updated = await this.repository.update(organizationId, id, actorId, {
      customerId: customer.id,
      contactId,
      opportunityId,
      ownerUserId,
      issueDate,
      dueDate,
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
      amountPaid: existing.amountPaid.toFixed(4),
      notes: resolveNullable(input.notes, existing.notes),
      terms: resolveNullable(input.terms, existing.terms),
      lines,
    });
    if (!updated) {
      throw new NotFoundError("Invoice not found");
    }

    await this.record(organizationId, actorId, "invoices.updated", "invoice", id, meta, {
      invoiceId: id,
      fields: Object.keys(input),
    });
    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    if (!["DRAFT", "VOID"].includes(existing.status) || Number(existing.amountPaid) > 0) {
      throw new ConflictError("Only an unpaid draft or void invoice can be deleted");
    }
    const removed = await this.repository.softDelete(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Invoice not found");
    }
    await this.record(organizationId, actorId, "invoices.deleted", "invoice", id, meta, {
      invoiceId: id,
      invoiceNumber: existing.invoiceNumber,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async restore(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const restored = await this.repository.restore(organizationId, id, actorId);
    if (!restored) {
      throw new NotFoundError("Deleted invoice not found");
    }
    await this.record(organizationId, actorId, "invoices.restored", "invoice", id, meta, { invoiceId: id });
    return this.get(organizationId, id);
  }

  async changeStatus(
    organizationId: string,
    actorId: string,
    id: string,
    input: ChangeInvoiceStatusInput,
    meta: RequestMeta,
  ) {
    const existing = await this.get(organizationId, id);
    assertInvoiceTransition(existing.status, input.status);

    const total = Number(existing.total);
    let amountPaid = input.amountPaid;
    if (input.status === "PAID") {
      amountPaid = amountPaid ?? existing.total.toFixed(4);
    }
    if (amountPaid !== undefined) {
      const paid = Number(amountPaid);
      if (paid > total) {
        throw new ValidationFailedError({ amountPaid: ["The paid amount cannot exceed the invoice total"] });
      }
      if (input.status === "PARTIALLY_PAID" && (paid <= 0 || paid >= total)) {
        throw new ValidationFailedError({
          amountPaid: ["A partial payment must be greater than zero and less than the invoice total"],
        });
      }
    }
    if (input.status === "PARTIALLY_PAID" && amountPaid === undefined) {
      throw new ValidationFailedError({ amountPaid: ["Enter the amount received"] });
    }

    const updated = await this.repository.changeStatus(
      organizationId,
      id,
      actorId,
      input.status,
      amountPaid,
    );
    if (!updated) {
      throw new NotFoundError("Invoice not found");
    }

    await this.record(
      organizationId,
      actorId,
      "invoices.status.changed",
      "invoice",
      id,
      meta,
      { invoiceId: id, status: input.status, amountPaid: amountPaid ?? null },
      { status: existing.status },
    );
    return this.get(organizationId, id);
  }

  async listAudit(organizationId: string, id: string, limit: number, cursor?: string) {
    await this.get(organizationId, id);
    return this.audit.list(organizationId, limit, cursor, { entityType: "invoice", entityId: id });
  }

  private async buildLines(organizationId: string, input: SalesLineInput[]): Promise<InvoiceLineWriteData[]> {
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

  private async computeSnapshot(organizationId: string, total: string, currencyCode: string, asOf: string) {
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
    return term;
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
      module: INVOICES_MODULE,
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
  return permissions.includes("invoices:delete") || permissions.includes("invoices:restore");
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

function addDays(date: string, days: number): string {
  const base = new Date(`${date}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isString(value: string | null | undefined): value is string {
  return typeof value === "string";
}

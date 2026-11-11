import { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import { today } from "../../common/sales/totals";
import type { AuditLogsService } from "../audit-logs/service";
import type { RequestMeta } from "../auth/types";
import type { PaymentsRepository } from "./repository";
import {
  PAYMENTS_MODULE,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from "./types";
import type { CreatePaymentInput, PaymentListQuery, UpdatePaymentInput } from "./validation";

export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository,
    private readonly audit: AuditLogsService,
  ) {}

  async list(organizationId: string, query: PaymentListQuery) {
    return this.repository.list(
      {
        organizationId,
        q: query.q,
        method: query.method,
        invoiceId: query.invoiceId,
        customerId: query.customerId,
        from: query.from,
        to: query.to,
      },
      query.limit,
      query.order,
      query.cursor,
    );
  }

  async get(organizationId: string, id: string) {
    const payment = await this.repository.findById(organizationId, id);
    if (!payment) {
      throw new NotFoundError("Payment not found");
    }
    return payment;
  }

  async formOptions(organizationId: string) {
    const invoices = await this.repository.formOptions(organizationId);
    return {
      invoices: invoices
        .map((invoice) => ({
          ...invoice,
          balance: new Prisma.Decimal(invoice.total).sub(invoice.amountPaid).toFixed(4),
        }))
        .filter((invoice) => Number(invoice.balance) > 0),
      methods: PAYMENT_METHODS.map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] })),
    };
  }

  async create(organizationId: string, actorId: string, input: CreatePaymentInput, meta: RequestMeta) {
    const invoice = await this.requirePayableInvoice(organizationId, input.invoiceId);
    const amount = new Prisma.Decimal(input.amount);
    const balance = new Prisma.Decimal(invoice.total).sub(invoice.amountPaid);
    if (amount.gt(balance)) {
      throw new ValidationFailedError({
        amount: [`The amount cannot exceed the outstanding balance of ${balance.toFixed(4)}`],
      });
    }

    const payment = await this.repository.create(organizationId, actorId, {
      invoiceId: invoice.id,
      receivedDate: input.receivedDate ?? today(),
      method: input.method,
      amount: input.amount,
      reference: input.reference,
      notes: input.notes,
    });
    if (!payment) {
      throw new NotFoundError("Invoice not found");
    }

    await this.record(organizationId, actorId, "payments.created", "payment", payment.id, meta, {
      paymentId: payment.id,
      paymentNumber: payment.paymentNumber,
      invoiceId: payment.invoiceId,
      amount: payment.amount.toString(),
      method: payment.method,
    });
    return payment;
  }

  async update(organizationId: string, actorId: string, id: string, input: UpdatePaymentInput, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    const invoice = await this.repository.findInvoiceForPayment(organizationId, existing.invoiceId);
    if (!invoice) {
      throw new ConflictError("The linked invoice is no longer available");
    }
    if (invoice.status === "VOID") {
      throw new ConflictError("A payment cannot be edited when its invoice is void");
    }

    if (input.amount !== undefined) {
      const available = new Prisma.Decimal(invoice.total)
        .sub(invoice.amountPaid)
        .add(new Prisma.Decimal(existing.amount));
      if (new Prisma.Decimal(input.amount).gt(available)) {
        throw new ValidationFailedError({
          amount: [`The amount cannot exceed the available balance of ${available.toFixed(4)}`],
        });
      }
    }

    const payment = await this.repository.update(organizationId, id, actorId, input);
    if (!payment) {
      throw new NotFoundError("Payment not found");
    }

    await this.record(
      organizationId,
      actorId,
      "payments.updated",
      "payment",
      id,
      meta,
      { paymentId: id, fields: Object.keys(input), amount: payment.amount.toString() },
      {
        amount: existing.amount.toString(),
        method: existing.method,
        receivedDate: existing.receivedDate.toISOString().slice(0, 10),
      },
    );
    return payment;
  }

  async remove(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.get(organizationId, id);
    const removed = await this.repository.softDelete(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Payment not found");
    }

    await this.record(organizationId, actorId, "payments.deleted", "payment", id, meta, {
      paymentId: id,
      paymentNumber: existing.paymentNumber,
      invoiceId: existing.invoiceId,
      amount: existing.amount.toString(),
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async listAudit(organizationId: string, id: string, limit: number, cursor?: string) {
    await this.get(organizationId, id);
    return this.audit.list(organizationId, limit, cursor, { entityType: "payment", entityId: id });
  }

  private async requirePayableInvoice(organizationId: string, invoiceId: string) {
    const invoice = await this.repository.findInvoiceForPayment(organizationId, invoiceId);
    if (!invoice) {
      throw new ValidationFailedError({ invoiceId: ["Choose a valid invoice"] });
    }
    if (invoice.status === "DRAFT") {
      throw new ValidationFailedError({ invoiceId: ["Send the invoice before recording a payment"] });
    }
    if (invoice.status === "PAID") {
      throw new ValidationFailedError({ invoiceId: ["This invoice is already fully paid"] });
    }
    if (invoice.status === "VOID") {
      throw new ValidationFailedError({ invoiceId: ["A void invoice cannot receive payments"] });
    }
    return invoice;
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
      module: PAYMENTS_MODULE,
      entityType,
      entityId,
      oldValues,
      newValues,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }
}

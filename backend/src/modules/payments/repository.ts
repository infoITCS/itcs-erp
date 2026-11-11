import { Prisma, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { allocateDocumentNumberIn } from "../../common/numbering/allocate";
import { cursorFilter, decodeCursor, toCursorPage } from "../../common/pagination/cursor";
import { buildPaymentListWhere, type PaymentListFilter } from "./list-filter";
import { applyPaymentDelta } from "./status";
import type { PaymentMethodValue } from "./types";

const paymentListSelect = {
  id: true,
  organizationId: true,
  paymentNumber: true,
  invoiceId: true,
  customerId: true,
  receivedDate: true,
  method: true,
  amount: true,
  currencyCode: true,
  reference: true,
  notes: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      issueDate: true,
      dueDate: true,
      total: true,
      amountPaid: true,
      currencyCode: true,
    },
  },
  customer: {
    select: { id: true, customerNumber: true, displayName: true, email: true, status: true },
  },
  currency: { select: { code: true, symbol: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  updatedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.PaymentSelect;

const paymentDetailSelect = {
  ...paymentListSelect,
} satisfies Prisma.PaymentSelect;

export interface PaymentWriteData {
  invoiceId: string;
  receivedDate: string;
  method: PaymentMethodValue;
  amount: string;
  reference?: string | null;
  notes?: string | null;
}

export interface PaymentUpdateData {
  receivedDate?: string;
  method?: PaymentMethodValue;
  amount?: string;
  reference?: string | null;
  notes?: string | null;
}

export class PaymentsRepository extends BaseRepository {
  constructor(db: PrismaClient) {
    super(db);
  }

  async list(filter: PaymentListFilter, limit: number, order: "asc" | "desc", cursor?: string) {
    const decoded = cursor ? decodeCursor(cursor) : null;
    const where = buildPaymentListWhere(filter);
    const rows = await this.db.payment.findMany({
      where: decoded ? { AND: [where, cursorFilter(decoded, order)] } : where,
      orderBy: [{ createdAt: order }, { id: order }],
      take: limit + 1,
      select: paymentListSelect,
    });
    return toCursorPage(rows, limit);
  }

  async findById(organizationId: string, id: string) {
    return this.db.payment.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: paymentDetailSelect,
    });
  }

  async findInvoiceForPayment(organizationId: string, invoiceId: string) {
    return this.db.invoice.findFirst({
      where: { id: invoiceId, organizationId, deletedAt: null },
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        currencyCode: true,
        status: true,
        issueDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        customer: { select: { id: true, customerNumber: true, displayName: true } },
      },
    });
  }

  async formOptions(organizationId: string) {
    return this.db.invoice.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
      },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      take: 500,
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        currencyCode: true,
        status: true,
        issueDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        customer: { select: { id: true, customerNumber: true, displayName: true } },
      },
    });
  }

  async create(organizationId: string, actorId: string, input: PaymentWriteData) {
    const id = await this.transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: input.invoiceId, organizationId, deletedAt: null },
        select: { id: true, customerId: true, currencyCode: true },
      });
      if (!invoice || invoice.customerId === null) {
        return null;
      }

      const paymentNumber = await allocateDocumentNumberIn(tx, organizationId, "PAYMENT");
      const created = await tx.payment.create({
        data: {
          organizationId,
          paymentNumber,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          receivedDate: dateOnly(input.receivedDate),
          method: input.method,
          amount: input.amount,
          currencyCode: invoice.currencyCode,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          createdById: actorId,
          updatedById: actorId,
        },
        select: { id: true },
      });

      await this.recalculateInvoice(tx, organizationId, invoice.id, new Prisma.Decimal(input.amount));
      return created.id;
    });

    return id ? this.findById(organizationId, id) : null;
  }

  async update(organizationId: string, id: string, actorId: string, input: PaymentUpdateData) {
    const updated = await this.transaction(async (tx) => {
      const existing = await tx.payment.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { id: true, invoiceId: true, amount: true },
      });
      if (!existing) {
        return false;
      }

      await tx.payment.update({
        where: { id },
        data: {
          ...(input.receivedDate ? { receivedDate: dateOnly(input.receivedDate) } : {}),
          ...(input.method ? { method: input.method } : {}),
          ...(input.amount ? { amount: input.amount } : {}),
          ...(input.reference !== undefined ? { reference: input.reference } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedById: actorId,
        },
      });

      const nextAmount = new Prisma.Decimal(input.amount ?? existing.amount);
      const delta = nextAmount.sub(new Prisma.Decimal(existing.amount));
      if (!delta.isZero()) {
        await this.recalculateInvoice(tx, organizationId, existing.invoiceId, delta);
      }
      return true;
    });

    return updated ? this.findById(organizationId, id) : null;
  }

  async softDelete(organizationId: string, id: string, actorId: string) {
    return this.transaction(async (tx) => {
      const existing = await tx.payment.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { id: true, invoiceId: true, amount: true },
      });
      if (!existing) {
        return false;
      }

      await tx.payment.update({
        where: { id },
        data: { deletedAt: new Date(), updatedById: actorId },
      });
      await this.recalculateInvoice(
        tx,
        organizationId,
        existing.invoiceId,
        new Prisma.Decimal(existing.amount).neg(),
      );
      return true;
    });
  }

  private async recalculateInvoice(
    tx: Prisma.TransactionClient,
    organizationId: string,
    invoiceId: string,
    delta: Prisma.Decimal,
  ) {
    await tx.$queryRaw`
      SELECT id
      FROM invoices
      WHERE id = ${invoiceId}::uuid
        AND organization_id = ${organizationId}::uuid
      FOR UPDATE
    `;

    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, organizationId, deletedAt: null },
      select: { id: true, status: true, total: true, amountPaid: true, dueDate: true },
    });
    if (!invoice) {
      return;
    }
    if (invoice.status === "VOID") {
      let paid = new Prisma.Decimal(invoice.amountPaid).add(delta);
      if (paid.isNegative()) {
        paid = new Prisma.Decimal(0);
      }
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { amountPaid: paid.toFixed(4) },
      });
      return;
    }

    const result = applyPaymentDelta({
      currentStatus: invoice.status,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      delta,
      dueDate: invoice.dueDate,
      asOf: new Date(),
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: result.amountPaid,
        status: result.status,
        ...(result.status === "PAID" ? { paidAt: new Date() } : { paidAt: null }),
      },
    });
  }
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

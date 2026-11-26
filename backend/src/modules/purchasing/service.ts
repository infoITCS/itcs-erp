import { Prisma } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationFailedError } from "../../common/errors/app-error";
import { computeCurrencySnapshot } from "../opportunities/currency-snapshot";
import type { AuditWriter } from "../audit-logs/types";
import type { RequestMeta } from "../auth/types";
import { applyInventoryMovement, type DecimalLike } from "../inventory/valuation";
import { DEFAULT_LOCATION } from "../inventory/types";
import { addDays, computeDocumentMoney, computeLineMoney, today } from "../../common/sales/totals";
import { applyVendorBillPaymentDelta, purchaseOrderStatusAfterReceipt, sumAmounts } from "./money";
import type {
  BillApprovalPayload,
  OrderRow,
  PaymentWriteData,
  ProductSummary,
  PurchasingRepository,
  ReceiptPostingPayload,
} from "./repository";
import type { DecimalLike as PurchasingDecimal } from "./repository";
import {
  DEFAULT_EXPENSE_ACCOUNT,
  DEFAULT_LIABILITY_ACCOUNT,
  GOODS_RECEIPT_STATUSES,
  GOODS_RECEIPT_STATUS_LABELS,
  GOODS_RECEIPT_STATUS_TRANSITIONS,
  PURCHASE_ORDER_STATUSES,
  PURCHASE_ORDER_STATUS_LABELS,
  PURCHASE_ORDER_STATUS_TRANSITIONS,
  PURCHASING_MODULE,
  VENDOR_BILL_STATUSES,
  VENDOR_BILL_STATUS_LABELS,
  VENDOR_BILL_STATUS_TRANSITIONS,
  VENDOR_PAYMENT_METHODS,
  VENDOR_PAYMENT_METHOD_LABELS,
  VENDOR_PAYMENT_STATUSES,
  VENDOR_PAYMENT_STATUS_LABELS,
  VENDOR_PAYMENT_STATUS_TRANSITIONS,
  assertGoodsReceiptTransition,
  assertPurchaseOrderTransition,
  assertVendorBillTransition,
  assertVendorPaymentTransition,
  statusOptions,
  transitionOptions,
} from "./types";
import type {
  ChangeOrderStatusInput,
  CreateBillInput,
  CreateOrderInput,
  CreatePaymentInput,
  CreateReceiptInput,
  PurchasingLineInput,
  UpdateBillInput,
  UpdateOrderInput,
  UpdatePaymentInput,
} from "./validation";
import type { LineSnapshot } from "./repository";

type PermissionSet = string[];

function decimal(value: DecimalLike | PurchasingDecimal | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined) {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(value.toString());
}

function resolveNullable<T>(incoming: T | null | undefined, current: T | null): T | null {
  return incoming === undefined ? current : incoming;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export class PurchasingService {
  constructor(
    private readonly repository: PurchasingRepository,
    private readonly audit: AuditWriter,
  ) {}

  async listOrders(organizationId: string, query: Parameters<PurchasingRepository["listOrders"]>[1], permissions: PermissionSet) {
    if (query.includeDeleted && !canSeeDeleted(permissions, "purchasing")) {
      throw new ForbiddenError();
    }
    return this.repository.listOrders(organizationId, query);
  }

  async listReceipts(
    organizationId: string,
    query: Parameters<PurchasingRepository["listReceipts"]>[1],
    permissions: PermissionSet,
  ) {
    if (query.includeDeleted && !canSeeDeleted(permissions, "purchasing")) {
      throw new ForbiddenError();
    }
    return this.repository.listReceipts(organizationId, query);
  }

  async listBills(organizationId: string, query: Parameters<PurchasingRepository["listBills"]>[1], permissions: PermissionSet) {
    if (query.includeDeleted && !canSeeDeleted(permissions, "purchasing")) {
      throw new ForbiddenError();
    }
    return this.repository.listBills(organizationId, query);
  }

  async listPayments(
    organizationId: string,
    query: Parameters<PurchasingRepository["listPayments"]>[1],
    permissions: PermissionSet,
  ) {
    if (query.includeDeleted && !canSeeDeleted(permissions, "purchasing")) {
      throw new ForbiddenError();
    }
    return this.repository.listPayments(organizationId, query);
  }

  async formOptions(organizationId: string) {
    const options = await this.repository.formOptions(organizationId);
    return {
      ...options,
      bills: options.bills.map((bill) => ({
        ...bill,
        balance: decimal(bill.total).sub(decimal(bill.amountPaid)).toFixed(4),
      })),
      statuses: statusOptions(PURCHASE_ORDER_STATUSES, PURCHASE_ORDER_STATUS_LABELS),
      orderStatuses: statusOptions(PURCHASE_ORDER_STATUSES, PURCHASE_ORDER_STATUS_LABELS),
      orderTransitions: transitionOptions(PURCHASE_ORDER_STATUS_TRANSITIONS, PURCHASE_ORDER_STATUSES),
      receiptStatuses: statusOptions(GOODS_RECEIPT_STATUSES, GOODS_RECEIPT_STATUS_LABELS),
      receiptTransitions: transitionOptions(GOODS_RECEIPT_STATUS_TRANSITIONS, GOODS_RECEIPT_STATUSES),
      billStatuses: statusOptions(VENDOR_BILL_STATUSES, VENDOR_BILL_STATUS_LABELS),
      billTransitions: transitionOptions(VENDOR_BILL_STATUS_TRANSITIONS, VENDOR_BILL_STATUSES),
      paymentStatuses: statusOptions(VENDOR_PAYMENT_STATUSES, VENDOR_PAYMENT_STATUS_LABELS),
      paymentTransitions: transitionOptions(VENDOR_PAYMENT_STATUS_TRANSITIONS, VENDOR_PAYMENT_STATUSES),
      paymentMethods: VENDOR_PAYMENT_METHODS.map((method) => ({
        value: method,
        label: VENDOR_PAYMENT_METHOD_LABELS[method],
      })),
    };
  }

  async getOrder(organizationId: string, id: string) {
    const order = await this.repository.findOrder(organizationId, id);
    if (!order) {
      throw new NotFoundError("Purchase order not found");
    }
    return order;
  }

  async createOrder(
    organizationId: string,
    actorId: string,
    input: CreateOrderInput,
    meta: RequestMeta,
  ) {
    const orderDate = input.orderDate ?? today();
    if (input.expectedDeliveryDate && input.expectedDeliveryDate < orderDate) {
      throw new ValidationFailedError({
        expectedDeliveryDate: ["The expected delivery date cannot be before the order date"],
      });
    }

    const vendor = await this.requireVendor(organizationId, input.vendorId);
    const currencyCode = input.currencyCode ?? vendor.currencyCode ?? (await this.baseCurrency(organizationId));
    await this.requireCurrency(currencyCode);
    await this.requireOwner(organizationId, input.ownerUserId ?? actorId);
    if (input.paymentTermId) {
      await this.requirePaymentTerm(organizationId, input.paymentTermId);
    }

    const lines = await this.buildLines(organizationId, input.lines);
    const money = computeDocumentMoney(lines);
    const snapshot = await this.computeSnapshot(organizationId, money.total, currencyCode, orderDate);

    const order = await this.repository.createOrder(organizationId, actorId, {
      vendorId: vendor.id,
      ownerUserId: input.ownerUserId ?? actorId,
      orderDate,
      expectedDeliveryDate: input.expectedDeliveryDate ?? null,
      vendorReference: input.vendorReference ?? null,
      currencyCode,
      exchangeRateToBase: snapshot.exchangeRateToBase,
      baseCurrencyCode: snapshot.baseCurrencyCode,
      paymentTermId: input.paymentTermId ?? null,
      subtotal: money.subtotal,
      discountTotal: money.discountTotal,
      taxTotal: money.taxTotal,
      total: money.total,
      totalBase: snapshot.estimatedValueBase,
      notes: input.notes ?? null,
      terms: input.terms ?? null,
      lines,
    });
    if (!order) {
      throw new NotFoundError("Purchase order not found");
    }

    await this.record(organizationId, actorId, "purchasing.order.created", "purchase-order", order.id, meta, {
      purchaseOrderId: order.id,
      purchaseOrderNumber: order.purchaseOrderNumber,
      vendorId: order.vendorId,
      status: order.status,
      total: order.total.toString(),
    });
    return order;
  }

  async updateOrder(
    organizationId: string,
    actorId: string,
    id: string,
    input: UpdateOrderInput,
    meta: RequestMeta,
  ) {
    const existing = await this.getOrder(organizationId, id);
    if (existing.status !== "DRAFT") {
      throw new ValidationFailedError({ status: ["Only a draft purchase order can be edited"] });
    }

    const vendor = await this.requireVendor(organizationId, input.vendorId ?? existing.vendorId);
    const currencyCode = input.currencyCode ?? existing.currencyCode;
    await this.requireCurrency(currencyCode);
    await this.requireOwner(organizationId, input.ownerUserId ?? existing.ownerUserId);

    const orderDate = input.orderDate ?? existing.orderDate.toISOString().slice(0, 10);
    const expectedDeliveryDate = resolveNullable(
      input.expectedDeliveryDate,
      existing.expectedDeliveryDate ? existing.expectedDeliveryDate.toISOString().slice(0, 10) : null,
    );
    if (expectedDeliveryDate && expectedDeliveryDate < orderDate) {
      throw new ValidationFailedError({
        expectedDeliveryDate: ["The expected delivery date cannot be before the order date"],
      });
    }

    const paymentTermId = resolveNullable(input.paymentTermId, existing.paymentTermId);
    if (paymentTermId) {
      await this.requirePaymentTerm(organizationId, paymentTermId);
    }

    const lines = await this.buildLines(
      organizationId,
      input.lines ?? existing.lines.map((line) => this.lineToInput(line)),
    );
    const money = computeDocumentMoney(lines);
    const snapshot = await this.computeSnapshot(organizationId, money.total, currencyCode, orderDate);

    const updated = await this.repository.updateOrder(organizationId, id, actorId, {
      vendorId: vendor.id,
      ownerUserId: input.ownerUserId ?? existing.ownerUserId,
      orderDate,
      expectedDeliveryDate,
      vendorReference: resolveNullable(input.vendorReference, existing.vendorReference),
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
      throw new NotFoundError("Purchase order not found");
    }

    await this.record(organizationId, actorId, "purchasing.order.updated", "purchase-order", id, meta, {
      purchaseOrderId: id,
      fields: Object.keys(input),
    });
    return updated;
  }

  async removeOrder(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.getOrder(organizationId, id);
    if (existing.status !== "DRAFT") {
      throw new ValidationFailedError({ status: ["Only a draft purchase order can be deleted"] });
    }
    const removed = await this.repository.softDeleteOrder(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Purchase order not found");
    }
    await this.record(organizationId, actorId, "purchasing.order.deleted", "purchase-order", id, meta, {
      purchaseOrderId: id,
      purchaseOrderNumber: existing.purchaseOrderNumber,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async restoreOrder(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const restored = await this.repository.restoreOrder(organizationId, id, actorId);
    if (!restored) {
      throw new NotFoundError("Deleted purchase order not found");
    }
    await this.record(organizationId, actorId, "purchasing.order.restored", "purchase-order", id, meta, {
      purchaseOrderId: id,
    });
    return this.getOrder(organizationId, id);
  }

  async changeOrderStatus(
    organizationId: string,
    actorId: string,
    id: string,
    input: ChangeOrderStatusInput,
    meta: RequestMeta,
    permissions: PermissionSet,
  ) {
    const requiresApproval = input.status === "APPROVED" || input.status === "SENT";
    const required = requiresApproval ? "purchasing:approve" : "purchasing:update";
    if (!permissions.includes(required)) {
      throw new ForbiddenError();
    }

    const existing = await this.getOrder(organizationId, id);
    assertPurchaseOrderTransition(existing.status, input.status);
    const updated = await this.repository.changeOrderStatus(organizationId, id, actorId, input.status);
    if (!updated) {
      throw new NotFoundError("Purchase order not found");
    }

    await this.record(
      organizationId,
      actorId,
      "purchasing.order.status.changed",
      "purchase-order",
      id,
      meta,
      {
        purchaseOrderId: id,
        purchaseOrderNumber: existing.purchaseOrderNumber,
        status: input.status,
        ...(input.reason ? { reason: input.reason } : {}),
      },
      { status: existing.status },
    );
    return this.getOrder(organizationId, id);
  }

  async getReceipt(organizationId: string, id: string) {
    const receipt = await this.repository.findReceipt(organizationId, id);
    if (!receipt) {
      throw new NotFoundError("Goods receipt not found");
    }
    return receipt;
  }

  async createReceipt(
    organizationId: string,
    actorId: string,
    input: CreateReceiptInput,
    meta: RequestMeta,
  ) {
    const order = await this.getOrder(organizationId, input.purchaseOrderId);
    if (!["APPROVED", "SENT", "PARTIALLY_RECEIVED"].includes(order.status)) {
      throw new ValidationFailedError({
        purchaseOrderId: ["Only an approved, sent, or partially received order can be received"],
      });
    }

    const purchaseOrderLineIds = unique(input.lines.map((line) => line.purchaseOrderLineId));
    if (purchaseOrderLineIds.length !== input.lines.length) {
      throw new ValidationFailedError({ lines: ["Each purchase order line can only be received once per receipt"] });
    }

    const orderLines = new Map(order.lines.map((line) => [line.id, line]));
    const products = await this.repository.findProductsByIds(
      organizationId,
      unique(order.lines.flatMap((line) => (line.productId ? [line.productId] : []))),
    );
    const productMap = new Map(products.map((product) => [product.id, product]));
    const pending = await this.repository.sumPendingReceiptQuantities(organizationId, purchaseOrderLineIds);

    const lines = input.lines.map((line, index) => {
      const orderLine = orderLines.get(line.purchaseOrderLineId);
      if (!orderLine) {
        throw new ValidationFailedError({
          lines: [`Line ${index + 1}: choose a line from this purchase order`],
        });
      }
      const available = decimal(orderLine.quantity)
        .sub(decimal(orderLine.receivedQuantity))
        .sub(decimal(pending.get(orderLine.id) ?? "0"));
      if (decimal(line.receivedQuantity).gt(available)) {
        throw new ValidationFailedError({
          lines: [`Line ${index + 1}: only ${available.toFixed(4)} can still be received`],
        });
      }
      const product = orderLine.productId ? productMap.get(orderLine.productId) : undefined;
      return {
        purchaseOrderLineId: orderLine.id,
        productId: orderLine.productId ?? null,
        productCode: orderLine.productCode ?? product?.code ?? null,
        productName: orderLine.productName ?? product?.name ?? "Product",
        description: orderLine.description ?? null,
        unitOfMeasure: orderLine.unitOfMeasure ?? product?.unitOfMeasure?.code ?? null,
        orderedQuantity: orderLine.quantity.toString(),
        receivedQuantity: line.receivedQuantity,
        unitCost: orderLine.unitPrice.toString(),
        lineTotal: decimal(line.receivedQuantity).mul(decimal(orderLine.unitPrice)).toFixed(4),
        location: line.location ?? product?.receivingLocation ?? DEFAULT_LOCATION,
        sortOrder: index,
      };
    });

    const receipt = await this.repository.createReceipt(organizationId, actorId, {
      purchaseOrderId: order.id,
      vendorId: order.vendorId,
      receiptDate: input.receiptDate ?? today(),
      vendorReference: input.vendorReference ?? null,
      currencyCode: order.currencyCode,
      notes: input.notes ?? null,
      lines,
    });
    if (!receipt) {
      throw new NotFoundError("Goods receipt not found");
    }

    await this.record(organizationId, actorId, "purchasing.receipt.created", "goods-receipt", receipt.id, meta, {
      goodsReceiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      purchaseOrderId: order.id,
      status: receipt.status,
    });
    return receipt;
  }

  async postReceipt(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const receipt = await this.getReceipt(organizationId, id);
    assertGoodsReceiptTransition(receipt.status, "POSTED");
    const order = await this.getOrder(organizationId, receipt.purchaseOrderId);
    if (!["APPROVED", "SENT", "PARTIALLY_RECEIVED"].includes(order.status)) {
      throw new ValidationFailedError({ status: ["This purchase order can no longer receive goods"] });
    }

    const purchaseOrderLineIds = unique(receipt.lines.map((line) => line.purchaseOrderLineId));
    const pending = await this.repository.sumPendingReceiptQuantities(
      organizationId,
      purchaseOrderLineIds,
      receipt.id,
    );
    const orderLines = new Map(order.lines.map((line) => [line.id, line]));

    const lineUpdates: ReceiptPostingPayload["lineUpdates"] = [];
    const movements: ReceiptPostingPayload["movements"] = [];
    const balances = new Map<
      string,
      { organizationId: string; productId: string; location: string; quantity: string; averageCost: string }
    >();

    for (const line of receipt.lines) {
      const orderLine = orderLines.get(line.purchaseOrderLineId);
      if (!orderLine || !line.productId) {
        throw new ValidationFailedError({ lines: ["The receipt references an invalid purchase order line"] });
      }
      const available = decimal(orderLine.quantity)
        .sub(decimal(orderLine.receivedQuantity))
        .sub(decimal(pending.get(orderLine.id) ?? "0"));
      if (decimal(line.receivedQuantity).gt(available)) {
        throw new ValidationFailedError({
          lines: [`Only ${available.toFixed(4)} can still be received for this purchase order line`],
        });
      }

      const key = `${line.productId}:${line.location}`;
      const previous =
        balances.get(key) ?? (await this.repository.findBalance(organizationId, line.productId, line.location));
      const applied = applyInventoryMovement(previous, line.receivedQuantity, line.unitCost, false);
      balances.set(key, {
        organizationId,
        productId: line.productId,
        location: line.location,
        quantity: applied.quantity,
        averageCost: applied.averageCost,
      });
      movements.push({
        organizationId,
        productId: line.productId,
        movementType: "PURCHASE_RECEIPT",
        quantity: line.receivedQuantity.toString(),
        unitCost: line.unitCost.toString(),
        location: line.location,
        referenceType: "GOODS_RECEIPT",
        referenceId: receipt.id,
        balanceAfter: applied.balanceAfter,
        createdById: actorId,
      });
      lineUpdates.push({
        id: orderLine.id,
        receivedQuantity: decimal(orderLine.receivedQuantity).add(decimal(line.receivedQuantity)).toFixed(4),
      });
    }

    const amountReceived = lineUpdates.reduce((sum, update) => {
      const orderLine = orderLines.get(update.id);
      return orderLine ? sum.add(decimal(update.receivedQuantity).mul(decimal(orderLine.unitPrice))) : sum;
    }, new Prisma.Decimal(0));
    const status = purchaseOrderStatusAfterReceipt(
      order.lines.map((line) => ({
        quantity: line.quantity,
        receivedQuantity: lineUpdates.find((update) => update.id === line.id)?.receivedQuantity ?? line.receivedQuantity,
      })),
    );

    const posted = await this.repository.postReceipt(organizationId, actorId, id, {
      status,
      amountReceived: amountReceived.toFixed(4),
      lineUpdates,
      movements,
      balances: [...balances.values()],
    });
    if (!posted) {
      throw new NotFoundError("Goods receipt not found");
    }

    await this.record(organizationId, actorId, "purchasing.receipt.posted", "goods-receipt", id, meta, {
      goodsReceiptId: id,
      receiptNumber: receipt.receiptNumber,
      purchaseOrderId: order.id,
      status,
      movementCount: movements.length,
    });
    return posted;
  }

  async removeReceipt(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.getReceipt(organizationId, id);
    if (existing.status !== "DRAFT") {
      throw new ValidationFailedError({ status: ["Only a draft goods receipt can be deleted"] });
    }
    const removed = await this.repository.softDeleteReceipt(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Goods receipt not found");
    }
    await this.record(organizationId, actorId, "purchasing.receipt.deleted", "goods-receipt", id, meta, {
      goodsReceiptId: id,
      receiptNumber: existing.receiptNumber,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async restoreReceipt(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const restored = await this.repository.restoreReceipt(organizationId, id, actorId);
    if (!restored) {
      throw new NotFoundError("Deleted goods receipt not found");
    }
    await this.record(organizationId, actorId, "purchasing.receipt.restored", "goods-receipt", id, meta, {
      goodsReceiptId: id,
    });
    return this.getReceipt(organizationId, id);
  }

  async getBill(organizationId: string, id: string) {
    const bill = await this.repository.findBill(organizationId, id);
    if (!bill) {
      throw new NotFoundError("Vendor bill not found");
    }
    return bill;
  }

  async createBill(organizationId: string, actorId: string, input: CreateBillInput, meta: RequestMeta) {
    const vendor = await this.requireVendor(organizationId, input.vendorId);
    let order: OrderRow | null = null;
    if (input.purchaseOrderId) {
      order = await this.getOrder(organizationId, input.purchaseOrderId);
      if (order.vendorId !== vendor.id) {
        throw new ValidationFailedError({ vendorId: ["The vendor does not match the purchase order"] });
      }
      if (order.status === "CANCELLED") {
        throw new ValidationFailedError({ purchaseOrderId: ["A cancelled purchase order cannot be billed"] });
      }
    }

    const billDate = input.billDate ?? today();
    if (input.dueDate && input.dueDate < billDate) {
      throw new ValidationFailedError({ dueDate: ["The due date cannot be before the bill date"] });
    }
    const paymentTerm = input.paymentTermId ? await this.requirePaymentTerm(organizationId, input.paymentTermId) : null;
    const dueDate = input.dueDate ?? (paymentTerm ? addDays(billDate, paymentTerm.dueDays) : null);
    const currencyCode = input.currencyCode ?? order?.currencyCode ?? vendor.currencyCode ?? (await this.baseCurrency(organizationId));
    await this.requireCurrency(currencyCode);

    const lineInputs =
      input.lines ?? order?.lines.map((line) => this.lineToInput(line)) ?? [];
    if (lineInputs.length === 0) {
      throw new ValidationFailedError({ lines: ["Provide at least one bill line"] });
    }
    const lines = await this.buildLines(organizationId, lineInputs);
    const money = computeDocumentMoney(lines);
    const snapshot = await this.computeSnapshot(organizationId, money.total, currencyCode, billDate);

    const bill = await this.repository.createBill(organizationId, actorId, {
      purchaseOrderId: order?.id ?? null,
      vendorId: vendor.id,
      ownerUserId: actorId,
      billDate,
      dueDate,
      vendorReference: input.vendorReference ?? null,
      currencyCode,
      exchangeRateToBase: snapshot.exchangeRateToBase,
      baseCurrencyCode: snapshot.baseCurrencyCode,
      paymentTermId: paymentTerm?.id ?? null,
      expenseAccount: input.expenseAccount ?? DEFAULT_EXPENSE_ACCOUNT,
      liabilityAccount: input.liabilityAccount ?? DEFAULT_LIABILITY_ACCOUNT,
      subtotal: money.subtotal,
      discountTotal: money.discountTotal,
      taxTotal: money.taxTotal,
      total: money.total,
      totalBase: snapshot.estimatedValueBase,
      notes: input.notes ?? null,
      lines,
    });
    if (!bill) {
      throw new NotFoundError("Vendor bill not found");
    }

    await this.record(organizationId, actorId, "purchasing.bill.created", "vendor-bill", bill.id, meta, {
      vendorBillId: bill.id,
      billNumber: bill.billNumber,
      vendorId: bill.vendorId,
      purchaseOrderId: bill.purchaseOrderId,
      status: bill.status,
      total: bill.total.toString(),
    });
    return bill;
  }

  async updateBill(
    organizationId: string,
    actorId: string,
    id: string,
    input: UpdateBillInput,
    meta: RequestMeta,
  ) {
    const existing = await this.getBill(organizationId, id);
    if (existing.status !== "DRAFT") {
      throw new ValidationFailedError({ status: ["Only a draft vendor bill can be edited"] });
    }

    const vendor = await this.requireVendor(organizationId, input.vendorId ?? existing.vendorId);
    if (existing.purchaseOrderId) {
      const order = await this.getOrder(organizationId, existing.purchaseOrderId);
      if (order.vendorId !== vendor.id) {
        throw new ValidationFailedError({ vendorId: ["The vendor does not match the purchase order"] });
      }
    }
    const billDate = input.billDate ?? existing.billDate.toISOString().slice(0, 10);
    const dueDate = resolveNullable(input.dueDate, existing.dueDate ? existing.dueDate.toISOString().slice(0, 10) : null);
    if (dueDate && dueDate < billDate) {
      throw new ValidationFailedError({ dueDate: ["The due date cannot be before the bill date"] });
    }
    const paymentTermId = resolveNullable(input.paymentTermId, existing.paymentTermId);
    const paymentTerm = paymentTermId ? await this.requirePaymentTerm(organizationId, paymentTermId) : null;
    const currencyCode = input.currencyCode ?? existing.currencyCode;
    await this.requireCurrency(currencyCode);

    const lines = await this.buildLines(
      organizationId,
      input.lines ?? existing.lines.map((line) => this.lineToInput(line)),
    );
    const money = computeDocumentMoney(lines);
    const snapshot = await this.computeSnapshot(organizationId, money.total, currencyCode, billDate);

    const updated = await this.repository.updateBill(organizationId, id, actorId, {
      purchaseOrderId: existing.purchaseOrderId,
      vendorId: vendor.id,
      ownerUserId: existing.ownerUserId,
      billDate,
      dueDate,
      vendorReference: resolveNullable(input.vendorReference, existing.vendorReference),
      currencyCode,
      exchangeRateToBase: snapshot.exchangeRateToBase,
      baseCurrencyCode: snapshot.baseCurrencyCode,
      paymentTermId: paymentTerm?.id ?? null,
      expenseAccount: input.expenseAccount ?? existing.expenseAccount ?? DEFAULT_EXPENSE_ACCOUNT,
      liabilityAccount: input.liabilityAccount ?? existing.liabilityAccount ?? DEFAULT_LIABILITY_ACCOUNT,
      subtotal: money.subtotal,
      discountTotal: money.discountTotal,
      taxTotal: money.taxTotal,
      total: money.total,
      totalBase: snapshot.estimatedValueBase,
      notes: resolveNullable(input.notes, existing.notes),
      lines,
    });
    if (!updated) {
      throw new NotFoundError("Vendor bill not found");
    }

    await this.record(organizationId, actorId, "purchasing.bill.updated", "vendor-bill", id, meta, {
      vendorBillId: id,
      fields: Object.keys(input),
    });
    return updated;
  }

  async approveBill(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const bill = await this.getBill(organizationId, id);
    assertVendorBillTransition(bill.status, "APPROVED");

    let payload: BillApprovalPayload = {
      amountBilled: "0.0000",
      lineUpdates: [],
    };
    if (bill.purchaseOrderId) {
      const order = await this.getOrder(organizationId, bill.purchaseOrderId);
      const requested = new Map<string, Prisma.Decimal>();
      for (const line of bill.lines) {
        if (!line.productId) {
          throw new ValidationFailedError({ lines: ["Every bill line must reference a product"] });
        }
        requested.set(
          line.productId,
          (requested.get(line.productId) ?? new Prisma.Decimal(0)).add(decimal(line.quantity)),
        );
      }

      const lineUpdates: BillApprovalPayload["lineUpdates"] = [];
      for (const orderLine of order.lines) {
        if (!orderLine.productId) {
          continue;
        }
        const remainingRequest = requested.get(orderLine.productId) ?? new Prisma.Decimal(0);
        if (remainingRequest.lte(0)) {
          continue;
        }
        const unbilled = decimal(orderLine.quantity).sub(decimal(orderLine.billedQuantity));
        const applied = unbilled.gt(remainingRequest) ? remainingRequest : unbilled;
        if (applied.gt(0)) {
          lineUpdates.push({ id: orderLine.id, billedQuantity: applied.toFixed(4) });
          requested.set(orderLine.productId, remainingRequest.sub(applied));
        }
      }
      const unmatched = [...requested.values()].some((value) => value.gt(0));
      if (unmatched) {
        throw new ValidationFailedError({
          lines: ["The billed quantities exceed the remaining quantities on the purchase order"],
        });
      }
      payload = {
        amountBilled: decimal(order.amountBilled).add(decimal(bill.total)).toFixed(4),
        lineUpdates,
      };
    }

    const approved = await this.repository.approveBill(organizationId, id, actorId, payload);
    if (!approved) {
      throw new NotFoundError("Vendor bill not found");
    }

    await this.record(organizationId, actorId, "purchasing.bill.approved", "vendor-bill", id, meta, {
      vendorBillId: id,
      billNumber: bill.billNumber,
      purchaseOrderId: bill.purchaseOrderId,
      status: "APPROVED",
      total: bill.total.toString(),
    });
    return approved;
  }

  async voidBill(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.getBill(organizationId, id);
    assertVendorBillTransition(existing.status, "VOID");
    if (decimal(existing.amountPaid).gt(0)) {
      throw new ValidationFailedError({ status: ["A bill with payments cannot be voided"] });
    }
    const voided = await this.repository.voidBill(organizationId, id, actorId);
    if (!voided) {
      throw new NotFoundError("Vendor bill not found");
    }
    await this.record(organizationId, actorId, "purchasing.bill.voided", "vendor-bill", id, meta, {
      vendorBillId: id,
      billNumber: existing.billNumber,
      status: "VOID",
    });
    return this.getBill(organizationId, id);
  }

  async removeBill(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.getBill(organizationId, id);
    if (existing.status !== "DRAFT") {
      throw new ValidationFailedError({ status: ["Only a draft vendor bill can be deleted"] });
    }
    const removed = await this.repository.softDeleteBill(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Vendor bill not found");
    }
    await this.record(organizationId, actorId, "purchasing.bill.deleted", "vendor-bill", id, meta, {
      vendorBillId: id,
      billNumber: existing.billNumber,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async restoreBill(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const restored = await this.repository.restoreBill(organizationId, id, actorId);
    if (!restored) {
      throw new NotFoundError("Deleted vendor bill not found");
    }
    await this.record(organizationId, actorId, "purchasing.bill.restored", "vendor-bill", id, meta, {
      vendorBillId: id,
    });
    return this.getBill(organizationId, id);
  }

  async getPayment(organizationId: string, id: string) {
    const payment = await this.repository.findPayment(organizationId, id);
    if (!payment) {
      throw new NotFoundError("Vendor payment not found");
    }
    return payment;
  }

  async createPayment(
    organizationId: string,
    actorId: string,
    input: CreatePaymentInput,
    meta: RequestMeta,
  ) {
    const vendor = await this.requireVendor(organizationId, input.vendorId);
    const currencyCode = input.currencyCode ?? vendor.currencyCode ?? (await this.baseCurrency(organizationId));
    await this.requireCurrency(currencyCode);
    await this.validateAllocations(organizationId, vendor.id, input.allocations);
    if (!decimal(sumAmounts(input.allocations.map((allocation) => allocation.amount))).eq(decimal(input.amount))) {
      throw new ValidationFailedError({ amount: ["The allocations must add up to the payment amount"] });
    }

    const payment = await this.repository.createPayment(organizationId, actorId, {
      vendorId: vendor.id,
      paidDate: input.paidDate ?? today(),
      method: input.method,
      amount: input.amount,
      currencyCode,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      bankAccount: input.bankAccount ?? null,
      allocations: input.allocations,
    });
    if (!payment) {
      throw new NotFoundError("Vendor payment not found");
    }

    await this.record(organizationId, actorId, "purchasing.payment.created", "vendor-payment", payment.id, meta, {
      vendorPaymentId: payment.id,
      paymentNumber: payment.paymentNumber,
      vendorId: payment.vendorId,
      amount: payment.amount.toString(),
      method: payment.method,
    });
    return payment;
  }

  async updatePayment(
    organizationId: string,
    actorId: string,
    id: string,
    input: UpdatePaymentInput,
    meta: RequestMeta,
  ) {
    const existing = await this.getPayment(organizationId, id);
    if (existing.status !== "DRAFT") {
      throw new ValidationFailedError({ status: ["Only a draft vendor payment can be edited"] });
    }
    const vendorId = input.vendorId ?? existing.vendorId;
    const vendor = await this.requireVendor(organizationId, vendorId);
    const currencyCode = input.currencyCode ?? existing.currencyCode;
    await this.requireCurrency(currencyCode);

    const allocations = input.allocations ?? existing.allocations.map((allocation) => ({
      billId: allocation.billId,
      amount: allocation.amount.toString(),
    }));
    const amount = input.amount ?? existing.amount.toString();
    await this.validateAllocations(organizationId, vendor.id, allocations, id);
    if (!decimal(sumAmounts(allocations.map((allocation) => allocation.amount))).eq(decimal(amount))) {
      throw new ValidationFailedError({ amount: ["The allocations must add up to the payment amount"] });
    }

    const payload: Partial<PaymentWriteData> = {
      vendorId: vendor.id,
      ...(input.paidDate ? { paidDate: input.paidDate } : {}),
      ...(input.method ? { method: input.method } : {}),
      ...(input.amount ? { amount: input.amount } : {}),
      currencyCode,
      ...(input.reference !== undefined ? { reference: input.reference } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.bankAccount !== undefined ? { bankAccount: input.bankAccount } : {}),
      ...(input.allocations ? { allocations: input.allocations } : {}),
    };
    const updated = await this.repository.updatePayment(organizationId, id, actorId, payload);
    if (!updated) {
      throw new NotFoundError("Vendor payment not found");
    }

    await this.record(organizationId, actorId, "purchasing.payment.updated", "vendor-payment", id, meta, {
      vendorPaymentId: id,
      fields: Object.keys(input),
    });
    return updated;
  }

  async approvePayment(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const payment = await this.getPayment(organizationId, id);
    assertVendorPaymentTransition(payment.status, "PAID");

    const grouped = new Map<string, string>();
    for (const allocation of payment.allocations) {
      grouped.set(
        allocation.billId,
        decimal(grouped.get(allocation.billId) ?? "0").add(decimal(allocation.amount)).toFixed(4),
      );
    }
    const bills = await this.repository.findBillsForAllocation(organizationId, [...grouped.keys()]);
    if (bills.length !== grouped.size) {
      throw new ValidationFailedError({ allocations: ["One or more bills are no longer available"] });
    }

    const billUpdates = bills.map((bill) => {
      const delta = grouped.get(bill.id) ?? "0";
      const applied = applyVendorBillPaymentDelta(bill, delta);
      return { billId: bill.id, amountPaid: applied.amountPaid, status: applied.status };
    });

    const approved = await this.repository.approvePayment(organizationId, id, actorId, billUpdates);
    if (!approved) {
      throw new NotFoundError("Vendor payment not found");
    }

    await this.record(organizationId, actorId, "purchasing.payment.approved", "vendor-payment", id, meta, {
      vendorPaymentId: id,
      paymentNumber: payment.paymentNumber,
      vendorId: payment.vendorId,
      amount: payment.amount.toString(),
      billCount: billUpdates.length,
    });
    return approved;
  }

  async removePayment(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.getPayment(organizationId, id);
    if (existing.status !== "DRAFT") {
      throw new ValidationFailedError({ status: ["Only a draft vendor payment can be deleted"] });
    }
    const removed = await this.repository.softDeletePayment(organizationId, id, actorId);
    if (!removed) {
      throw new NotFoundError("Vendor payment not found");
    }
    await this.record(organizationId, actorId, "purchasing.payment.deleted", "vendor-payment", id, meta, {
      vendorPaymentId: id,
      paymentNumber: existing.paymentNumber,
    });
    return { id, deletedAt: new Date().toISOString() };
  }

  async restorePayment(organizationId: string, actorId: string, id: string, meta: RequestMeta) {
    const restored = await this.repository.restorePayment(organizationId, id, actorId);
    if (!restored) {
      throw new NotFoundError("Deleted vendor payment not found");
    }
    await this.record(organizationId, actorId, "purchasing.payment.restored", "vendor-payment", id, meta, {
      vendorPaymentId: id,
    });
    return this.getPayment(organizationId, id);
  }

  private async validateAllocations(
    organizationId: string,
    vendorId: string,
    allocations: Array<{ billId: string; amount: string }>,
    excludePaymentId?: string,
  ) {
    const billIds = unique(allocations.map((allocation) => allocation.billId));
    const bills = await this.repository.findBillsForAllocation(organizationId, billIds);
    if (bills.length !== billIds.length) {
      throw new ValidationFailedError({ allocations: ["Choose valid vendor bills"] });
    }
    const billMap = new Map(bills.map((bill) => [bill.id, bill]));
    const pending = await this.repository.sumPendingAllocations(organizationId, billIds, excludePaymentId);
    const requested = new Map<string, Prisma.Decimal>();

    for (const allocation of allocations) {
      const bill = billMap.get(allocation.billId);
      if (!bill) {
        throw new ValidationFailedError({ allocations: ["Choose valid vendor bills"] });
      }
      if (bill.vendorId !== vendorId) {
        throw new ValidationFailedError({ allocations: ["All bills must belong to the selected vendor"] });
      }
      if (bill.status !== "APPROVED" && bill.status !== "PARTIALLY_PAID") {
        throw new ValidationFailedError({ allocations: ["Only approved bills can be paid"] });
      }
      const available = decimal(bill.total)
        .sub(decimal(bill.amountPaid))
        .sub(decimal(pending.get(bill.id) ?? "0"));
      const totalRequested = (requested.get(bill.id) ?? new Prisma.Decimal(0)).add(decimal(allocation.amount));
      if (totalRequested.gt(available)) {
        throw new ValidationFailedError({
          allocations: [`The payment cannot exceed the outstanding balance of ${available.toFixed(4)}`],
        });
      }
      requested.set(bill.id, totalRequested);
    }
  }

  private async buildLines(organizationId: string, input: PurchasingLineInput[]): Promise<LineSnapshot[]> {
    const productIds = unique(input.flatMap((line) => [line.productId]));
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
      const product: ProductSummary | undefined = productMap.get(line.productId);
      if (!product) {
        throw new ValidationFailedError({ lines: [`Line ${index + 1}: choose a valid product`] });
      }
      const taxCodeId = line.taxCodeId ?? product.taxCodeId ?? null;
      const taxCode = taxCodeId ? taxMap.get(taxCodeId) : undefined;
      const taxRate = line.taxRate ?? taxCode?.rate.toString() ?? "0";
      if (taxCodeId && !taxCode) {
        throw new ValidationFailedError({ lines: [`Line ${index + 1}: choose a valid tax code`] });
      }

      const money = computeLineMoney({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent ?? "0",
        taxRate,
      });
      return {
        productId: product.id,
        productCode: line.productCode ?? product.code ?? null,
        productName: line.productName ?? product.name ?? "Product",
        description: line.description ?? null,
        unitOfMeasure: line.unitOfMeasure ?? product.unitOfMeasure?.code ?? null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent ?? "0",
        taxCodeId,
        taxCode: taxCode?.code ?? null,
        taxRate,
        lineSubtotal: money.lineSubtotal,
        lineDiscount: money.lineDiscount,
        lineTax: money.lineTax,
        lineTotal: money.lineTotal,
        sortOrder: index,
      };
    });
  }

  private lineToInput(line: LineSnapshot): PurchasingLineInput {
    return {
      productId: line.productId ?? "",
      productCode: line.productCode ?? undefined,
      productName: line.productName,
      description: line.description ?? undefined,
      unitOfMeasure: line.unitOfMeasure ?? undefined,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      discountPercent: line.discountPercent.toString(),
      taxCodeId: line.taxCodeId ?? undefined,
      taxRate: line.taxRate.toString(),
      expenseAccount: undefined,
    };
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

  private async baseCurrency(organizationId: string): Promise<string> {
    const organization = await this.repository.findOrganization(organizationId);
    if (!organization) {
      throw new NotFoundError("Organization not found");
    }
    return organization.baseCurrencyCode;
  }

  private async requireVendor(organizationId: string, vendorId: string) {
    const vendor = await this.repository.findVendor(organizationId, vendorId);
    if (!vendor) {
      throw new ValidationFailedError({ vendorId: ["Choose a valid vendor"] });
    }
    if (vendor.status !== "ACTIVE") {
      throw new ValidationFailedError({ vendorId: ["This vendor is not active"] });
    }
    return vendor;
  }

  private async requireCurrency(code: string) {
    if (!(await this.repository.currencyIsActive(code))) {
      throw new ValidationFailedError({ currencyCode: ["Choose an active currency"] });
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
      module: PURCHASING_MODULE,
      entityType,
      entityId,
      oldValues,
      newValues,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }
}

function canSeeDeleted(permissions: PermissionSet, module: string): boolean {
  return permissions.includes(`${module}:delete`);
}

function isString(value: string | null | undefined): value is string {
  return typeof value === "string";
}

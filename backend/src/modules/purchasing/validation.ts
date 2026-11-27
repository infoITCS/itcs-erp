import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";
import {
  currencyCodeSchema,
  documentIdParamSchema,
  includeDeletedSchema,
  moneyAmountSchema,
  optionalText,
  percentageSchema,
  positiveMoneySchema,
} from "../../common/sales/validation";
import {
  GOODS_RECEIPT_STATUSES,
  PURCHASE_ORDER_MANUAL_STATUSES,
  PURCHASE_ORDER_STATUSES,
  VENDOR_BILL_STATUSES,
  VENDOR_PAYMENT_METHODS,
  VENDOR_PAYMENT_STATUSES,
} from "./types";

export const purchasingLineSchema = z.strictObject({
  productId: z.uuid(),
  productCode: optionalText(64),
  productName: optionalText(200),
  description: optionalText(1000),
  unitOfMeasure: optionalText(32),
  quantity: positiveMoneySchema,
  unitPrice: moneyAmountSchema,
  discountPercent: percentageSchema.optional(),
  taxCodeId: z.uuid().optional(),
  taxRate: percentageSchema.optional(),
  expenseAccount: optionalText(120),
});

const documentLines = z.array(purchasingLineSchema).min(1).max(200);

export const orderListQuerySchema = listQuerySchema.extend({
  status: z.enum(PURCHASE_ORDER_STATUSES).optional(),
  vendorId: z.uuid().optional(),
  includeDeleted: includeDeletedSchema,
});

export const receiptListQuerySchema = listQuerySchema.extend({
  status: z.enum(GOODS_RECEIPT_STATUSES).optional(),
  vendorId: z.uuid().optional(),
  purchaseOrderId: z.uuid().optional(),
  includeDeleted: includeDeletedSchema,
});

export const billListQuerySchema = listQuerySchema.extend({
  status: z.enum(VENDOR_BILL_STATUSES).optional(),
  vendorId: z.uuid().optional(),
  purchaseOrderId: z.uuid().optional(),
  includeDeleted: includeDeletedSchema,
});

export const paymentListQuerySchema = listQuerySchema.extend({
  status: z.enum(VENDOR_PAYMENT_STATUSES).optional(),
  vendorId: z.uuid().optional(),
  billId: z.uuid().optional(),
  includeDeleted: includeDeletedSchema,
});

export const createOrderSchema = z.strictObject({
  vendorId: z.uuid(),
  ownerUserId: z.uuid().optional(),
  orderDate: z.iso.date().optional(),
  expectedDeliveryDate: z.iso.date().optional(),
  vendorReference: optionalText(120),
  currencyCode: currencyCodeSchema.optional(),
  paymentTermId: z.uuid().optional(),
  notes: optionalText(4000),
  terms: optionalText(4000),
  lines: documentLines,
});

export const createOrderFromSalesOrderSchema = z.strictObject({
  salesOrderId: z.uuid(),
  vendorId: z.uuid(),
  ownerUserId: z.uuid().optional(),
  orderDate: z.iso.date().optional(),
  expectedDeliveryDate: z.iso.date().optional(),
  vendorReference: optionalText(120),
  notes: optionalText(4000),
});

export const updateOrderSchema = z
  .strictObject({
    vendorId: z.uuid().optional(),
    ownerUserId: z.uuid().optional(),
    orderDate: z.iso.date().optional(),
    expectedDeliveryDate: z.iso.date().nullable().optional(),
    vendorReference: optionalText(120).nullable(),
    currencyCode: currencyCodeSchema.optional(),
    paymentTermId: z.uuid().nullable().optional(),
    notes: optionalText(4000).nullable(),
    terms: optionalText(4000).nullable(),
    lines: documentLines.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" });

export const changeOrderStatusSchema = z.strictObject({
  status: z.enum(PURCHASE_ORDER_MANUAL_STATUSES),
  reason: optionalText(500),
});

export const createReceiptSchema = z.strictObject({
  purchaseOrderId: z.uuid(),
  receiptDate: z.iso.date().optional(),
  vendorReference: optionalText(120),
  notes: optionalText(4000),
  lines: z
    .array(
      z.strictObject({
        purchaseOrderLineId: z.uuid(),
        receivedQuantity: positiveMoneySchema,
        location: optionalText(120),
      }),
    )
    .min(1)
    .max(200),
});

export const createBillSchema = z
  .strictObject({
    purchaseOrderId: z.uuid().optional(),
    vendorId: z.uuid(),
    billDate: z.iso.date().optional(),
    dueDate: z.iso.date().optional(),
    vendorReference: optionalText(120),
    currencyCode: currencyCodeSchema.optional(),
    paymentTermId: z.uuid().optional(),
    expenseAccount: optionalText(120),
    liabilityAccount: optionalText(120),
    notes: optionalText(4000),
    lines: documentLines.optional(),
  })
  .refine((value) => Boolean(value.purchaseOrderId || value.lines?.length), {
    message: "Provide a purchase order or at least one bill line",
    path: ["lines"],
  });

export const updateBillSchema = z
  .strictObject({
    vendorId: z.uuid().optional(),
    billDate: z.iso.date().optional(),
    dueDate: z.iso.date().optional(),
    vendorReference: optionalText(120).nullable(),
    currencyCode: currencyCodeSchema.optional(),
    paymentTermId: z.uuid().nullable().optional(),
    expenseAccount: optionalText(120),
    liabilityAccount: optionalText(120),
    notes: optionalText(4000).nullable(),
    lines: documentLines.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" });

export const allocationSchema = z.strictObject({
  billId: z.uuid(),
  amount: positiveMoneySchema,
});

export const createPaymentSchema = z.strictObject({
  vendorId: z.uuid(),
  paidDate: z.iso.date().optional(),
  method: z.enum(VENDOR_PAYMENT_METHODS),
  amount: positiveMoneySchema,
  currencyCode: currencyCodeSchema.optional(),
  reference: optionalText(120),
  notes: optionalText(4000),
  bankAccount: optionalText(120),
  allocations: z.array(allocationSchema).min(1).max(200),
});

export const updatePaymentSchema = z
  .strictObject({
    vendorId: z.uuid().optional(),
    paidDate: z.iso.date().optional(),
    method: z.enum(VENDOR_PAYMENT_METHODS).optional(),
    amount: positiveMoneySchema.optional(),
    currencyCode: currencyCodeSchema.optional(),
    reference: optionalText(120).nullable(),
    notes: optionalText(4000).nullable(),
    bankAccount: optionalText(120).nullable(),
    allocations: z.array(allocationSchema).min(1).max(200).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" });

export const purchasingIdParamSchema = documentIdParamSchema;

export type PurchasingLineInput = z.infer<typeof purchasingLineSchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export type ReceiptListQuery = z.infer<typeof receiptListQuerySchema>;
export type BillListQuery = z.infer<typeof billListQuerySchema>;
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateOrderFromSalesOrderInput = z.infer<typeof createOrderFromSalesOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type ChangeOrderStatusInput = z.infer<typeof changeOrderStatusSchema>;
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;

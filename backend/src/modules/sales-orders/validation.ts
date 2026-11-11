import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";
import {
  currencyCodeSchema,
  documentIdParamSchema,
  includeDeletedSchema,
  optionalText,
  salesLineInputSchema,
} from "../../common/sales/validation";
import { SALES_ORDER_MANUAL_STATUSES, SALES_ORDER_STATUSES } from "./types";

const lines = z.array(salesLineInputSchema).min(1).max(200);

export const createSalesOrderSchema = z.strictObject({
  sourceQuoteId: z.uuid().optional(),
  customerId: z.uuid(),
  contactId: z.uuid().optional(),
  opportunityId: z.uuid().optional(),
  ownerUserId: z.uuid().optional(),
  orderDate: z.iso.date().optional(),
  expectedDeliveryDate: z.iso.date().optional(),
  customerReference: optionalText(120),
  currencyCode: currencyCodeSchema.optional(),
  paymentTermId: z.uuid().optional(),
  notes: optionalText(4000),
  terms: optionalText(4000),
  lines,
});

export const updateSalesOrderSchema = z
  .strictObject({
    customerId: z.uuid().optional(),
    contactId: z.uuid().nullable().optional(),
    opportunityId: z.uuid().nullable().optional(),
    ownerUserId: z.uuid().optional(),
    orderDate: z.iso.date().optional(),
    expectedDeliveryDate: z.iso.date().nullable().optional(),
    customerReference: optionalText(120).nullable(),
    currencyCode: currencyCodeSchema.optional(),
    paymentTermId: z.uuid().nullable().optional(),
    notes: optionalText(4000).nullable(),
    terms: optionalText(4000).nullable(),
    lines: lines.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" });

export const changeSalesOrderStatusSchema = z.strictObject({
  status: z.enum(SALES_ORDER_MANUAL_STATUSES),
});

export const convertSalesOrderSchema = z
  .strictObject({
    issueDate: z.iso.date().optional(),
    dueDate: z.iso.date().optional(),
  })
  .optional();

export const salesOrderListQuerySchema = listQuerySchema.extend({
  status: z.enum(SALES_ORDER_STATUSES).optional(),
  customerId: z.uuid().optional(),
  ownerUserId: z.uuid().optional(),
  includeDeleted: includeDeletedSchema,
});

export const salesOrderIdParamSchema = documentIdParamSchema;

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;
export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>;
export type ChangeSalesOrderStatusInput = z.infer<typeof changeSalesOrderStatusSchema>;
export type ConvertSalesOrderInput = z.infer<typeof convertSalesOrderSchema>;
export type SalesOrderListQuery = z.infer<typeof salesOrderListQuerySchema>;

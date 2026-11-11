import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";
import {
  currencyCodeSchema,
  documentIdParamSchema,
  includeDeletedSchema,
  moneyAmountSchema,
  optionalText,
  salesLineInputSchema,
} from "../../common/sales/validation";
import { INVOICE_MANUAL_STATUSES, INVOICE_STATUSES } from "./types";

const lines = z.array(salesLineInputSchema).min(1).max(200);

export const createInvoiceSchema = z
  .strictObject({
    sourceSalesOrderId: z.uuid().optional(),
    customerId: z.uuid(),
    contactId: z.uuid().optional(),
    opportunityId: z.uuid().optional(),
    ownerUserId: z.uuid().optional(),
    issueDate: z.iso.date().optional(),
    dueDate: z.iso.date().optional(),
    customerReference: optionalText(120),
    currencyCode: currencyCodeSchema.optional(),
    paymentTermId: z.uuid().optional(),
    notes: optionalText(4000),
    terms: optionalText(4000),
    lines,
  })
  .refine((value) => !value.issueDate || !value.dueDate || value.dueDate >= value.issueDate, {
    message: "The due date cannot be before the issue date",
    path: ["dueDate"],
  });

export const updateInvoiceSchema = z
  .strictObject({
    customerId: z.uuid().optional(),
    contactId: z.uuid().nullable().optional(),
    opportunityId: z.uuid().nullable().optional(),
    ownerUserId: z.uuid().optional(),
    issueDate: z.iso.date().optional(),
    dueDate: z.iso.date().optional(),
    customerReference: optionalText(120).nullable(),
    currencyCode: currencyCodeSchema.optional(),
    paymentTermId: z.uuid().nullable().optional(),
    notes: optionalText(4000).nullable(),
    terms: optionalText(4000).nullable(),
    lines: lines.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" });

export const changeInvoiceStatusSchema = z.strictObject({
  status: z.enum(INVOICE_MANUAL_STATUSES),
  amountPaid: moneyAmountSchema.optional(),
});

export const invoiceListQuerySchema = listQuerySchema.extend({
  status: z.enum(INVOICE_STATUSES).optional(),
  customerId: z.uuid().optional(),
  ownerUserId: z.uuid().optional(),
  includeDeleted: includeDeletedSchema,
});

export const invoiceIdParamSchema = documentIdParamSchema;

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type ChangeInvoiceStatusInput = z.infer<typeof changeInvoiceStatusSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;

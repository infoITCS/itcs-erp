import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";
import {
  currencyCodeSchema,
  documentIdParamSchema,
  includeDeletedSchema,
  optionalText,
  salesLineInputSchema,
} from "../../common/sales/validation";
import { QUOTE_MANUAL_STATUSES, QUOTE_STATUSES } from "./types";

const lines = z.array(salesLineInputSchema).min(1).max(200);

export const createQuoteSchema = z.strictObject({
  customerId: z.uuid(),
  contactId: z.uuid().optional(),
  opportunityId: z.uuid().optional(),
  ownerUserId: z.uuid().optional(),
  issueDate: z.iso.date().optional(),
  validUntil: z.iso.date().optional(),
  customerReference: optionalText(120),
  currencyCode: currencyCodeSchema.optional(),
  paymentTermId: z.uuid().optional(),
  notes: optionalText(4000),
  terms: optionalText(4000),
  lines,
});

export const updateQuoteSchema = z
  .strictObject({
    customerId: z.uuid().optional(),
    contactId: z.uuid().nullable().optional(),
    opportunityId: z.uuid().nullable().optional(),
    ownerUserId: z.uuid().optional(),
    issueDate: z.iso.date().optional(),
    validUntil: z.iso.date().nullable().optional(),
    customerReference: optionalText(120).nullable(),
    currencyCode: currencyCodeSchema.optional(),
    paymentTermId: z.uuid().nullable().optional(),
    notes: optionalText(4000).nullable(),
    terms: optionalText(4000).nullable(),
    lines: lines.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" });

export const changeQuoteStatusSchema = z.strictObject({
  status: z.enum(QUOTE_MANUAL_STATUSES),
});

export const convertQuoteSchema = z
  .strictObject({
    orderDate: z.iso.date().optional(),
    expectedDeliveryDate: z.iso.date().optional(),
  })
  .optional();

export const quoteListQuerySchema = listQuerySchema.extend({
  status: z.enum(QUOTE_STATUSES).optional(),
  customerId: z.uuid().optional(),
  ownerUserId: z.uuid().optional(),
  includeDeleted: includeDeletedSchema,
});

export const quoteIdParamSchema = documentIdParamSchema;

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type ChangeQuoteStatusInput = z.infer<typeof changeQuoteStatusSchema>;
export type ConvertQuoteInput = z.infer<typeof convertQuoteSchema>;
export type QuoteListQuery = z.infer<typeof quoteListQuerySchema>;

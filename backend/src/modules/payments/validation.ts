import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";
import { documentIdParamSchema, optionalText, positiveMoneySchema } from "../../common/sales/validation";
import { PAYMENT_METHODS } from "./types";

export const createPaymentSchema = z.strictObject({
  invoiceId: z.uuid(),
  receivedDate: z.iso.date().optional(),
  method: z.enum(PAYMENT_METHODS),
  amount: positiveMoneySchema,
  reference: optionalText(120),
  notes: optionalText(4000),
});

export const updatePaymentSchema = z
  .strictObject({
    receivedDate: z.iso.date().optional(),
    method: z.enum(PAYMENT_METHODS).optional(),
    amount: positiveMoneySchema.optional(),
    reference: optionalText(120).nullable(),
    notes: optionalText(4000).nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" });

export const paymentListQuerySchema = listQuerySchema.extend({
  method: z.enum(PAYMENT_METHODS).optional(),
  invoiceId: z.uuid().optional(),
  customerId: z.uuid().optional(),
});

export const paymentIdParamSchema = documentIdParamSchema;

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;

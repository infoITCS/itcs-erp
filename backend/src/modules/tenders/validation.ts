import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";
import { TENDER_STATUSES } from "./types";

const currencyCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code")
  .transform((value) => value.toUpperCase());

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));
}

const moneyAmount = z
  .string()
  .trim()
  .regex(/^\d{1,15}(\.\d{1,4})?$/, "Enter a non-negative amount with up to 4 decimal places");

const dateOnly = z.iso.date();
const dateTime = z.iso.datetime();
const tenderStatus = z.enum(TENDER_STATUSES);

export const createTenderSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: optionalText(4000),
  referenceNumber: optionalText(120),
  status: tenderStatus.optional(),
  customerId: z.uuid(),
  contactId: z.uuid().optional(),
  ownerUserId: z.uuid().optional(),
  estimatedValue: moneyAmount.optional(),
  currencyCode,
  submissionDeadline: dateTime.optional(),
  expectedAwardDate: dateOnly.optional(),
  notes: optionalText(4000),
});

export const updateTenderSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200).optional(),
    description: optionalText(4000).nullable(),
    referenceNumber: optionalText(120).nullable(),
    status: tenderStatus.optional(),
    customerId: z.uuid().optional(),
    contactId: z.uuid().nullable().optional(),
    ownerUserId: z.uuid().optional(),
    estimatedValue: moneyAmount.optional(),
    currencyCode: currencyCode.optional(),
    submissionDeadline: dateTime.nullable().optional(),
    expectedAwardDate: dateOnly.nullable().optional(),
    notes: optionalText(4000).nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" });

export const tenderListQuerySchema = listQuerySchema.extend({
  status: tenderStatus.optional(),
  customerId: z.uuid().optional(),
  ownerUserId: z.uuid().optional(),
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  sort: z.enum(["createdAt", "title", "tenderNumber"]).optional(),
});

export const tenderIdParamSchema = z.object({ id: z.uuid() });

export type CreateTenderInput = z.infer<typeof createTenderSchema>;
export type UpdateTenderInput = z.infer<typeof updateTenderSchema>;
export type TenderListQuery = z.infer<typeof tenderListQuerySchema>;

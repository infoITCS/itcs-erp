import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";
import { createCustomerSchema } from "../customers/validation";
import { LOST_REASONS, OPEN_STAGES } from "./types";

const currencyCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code")
  .transform((value) => value.toUpperCase());

const countryCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "Use a two-letter country code")
  .transform((value) => value.toUpperCase());

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));
}

const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .optional()
  .transform((value) => (value ? value.toLowerCase() : undefined))
  .refine((value) => value === undefined || z.email().safeParse(value).success, "Enter a valid email");

const optionalPhone = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((value) => (value ? value : undefined));

const moneyAmount = z
  .string()
  .trim()
  .regex(/^\d{1,15}(\.\d{1,4})?$/, "Enter a non-negative amount with up to 4 decimal places");

const quantityAmount = z
  .string()
  .trim()
  .regex(/^\d{1,13}(\.\d{1,4})?$/, "Enter a non-negative quantity with up to 4 decimal places");

const dateOnly = z.iso.date();
const probabilityPercent = z.number().int().min(0).max(100);

const leadSourceEnum = z.enum([
  "WEBSITE",
  "REFERRAL",
  "COLD_CALL",
  "SOCIAL_MEDIA",
  "ADVERTISEMENT",
  "PARTNER",
  "TENDER",
  "OTHER",
]);
const openStageEnum = z.enum(OPEN_STAGES);
const lostReasonEnum = z.enum(LOST_REASONS);

export const createOpportunitySchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200),
    description: optionalText(4000),
    customerId: z.uuid().optional(),
    contactId: z.uuid().optional(),
    resellerId: z.uuid().optional(),
    ownerUserId: z.uuid().optional(),
    leadSource: leadSourceEnum.optional(),
    estimatedValue: moneyAmount.optional(),
    currencyCode,
    probabilityPercent: probabilityPercent.optional(),
    expectedCloseDate: dateOnly.optional(),
    nextAction: optionalText(500),
    nextActionDueAt: z.iso.datetime().optional(),
    competitorName: optionalText(200),
    notes: optionalText(4000),
    prospectDisplayName: optionalText(200),
    prospectLegalName: optionalText(200),
    prospectEmail: optionalEmail,
    prospectPhone: optionalPhone,
    prospectCountryCode: countryCode.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.customerId && !value.prospectDisplayName) {
      ctx.addIssue({
        code: "custom",
        message: "Provide a prospect display name when no customer is linked yet",
        path: ["prospectDisplayName"],
      });
    }
  });

export const updateOpportunitySchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200).optional(),
    description: optionalText(4000).nullable(),
    contactId: z.uuid().nullable().optional(),
    resellerId: z.uuid().nullable().optional(),
    ownerUserId: z.uuid().optional(),
    leadSource: leadSourceEnum.nullable().optional(),
    estimatedValue: moneyAmount.optional(),
    currencyCode: currencyCode.optional(),
    probabilityPercent: probabilityPercent.optional(),
    expectedCloseDate: dateOnly.nullable().optional(),
    nextAction: optionalText(500).nullable(),
    nextActionDueAt: z.iso.datetime().nullable().optional(),
    competitorName: optionalText(200).nullable(),
    notes: optionalText(4000).nullable(),
    prospectDisplayName: optionalText(200).nullable(),
    prospectLegalName: optionalText(200).nullable(),
    prospectEmail: optionalEmail.nullable(),
    prospectPhone: optionalPhone.nullable(),
    prospectCountryCode: countryCode.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" });

export const changeStageSchema = z.strictObject({
  stage: openStageEnum,
  probabilityPercent: probabilityPercent.optional(),
  applyStageDefault: z.boolean().optional(),
  expectedCloseDate: dateOnly.optional(),
});

// Every field is optional, so a request sent with no JSON body at all (req.body === undefined)
// is treated the same as `{}` rather than failing validation.
export const markWonSchema = z.preprocess(
  (value) => value ?? {},
  z.strictObject({
    probabilityPercent: probabilityPercent.optional(),
    applyStageDefault: z.boolean().optional(),
  }),
);

export const markLostSchema = z.strictObject({
  lostReason: lostReasonEnum,
  lostReasonDetail: optionalText(500),
  competitorName: optionalText(200),
  probabilityPercent: probabilityPercent.optional(),
  applyStageDefault: z.boolean().optional(),
});

export const reopenOpportunitySchema = z.preprocess(
  (value) => value ?? {},
  z.strictObject({
    stage: openStageEnum.optional(),
    probabilityPercent: probabilityPercent.optional(),
    applyStageDefault: z.boolean().optional(),
  }),
);

export const convertOpportunitySchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("LINK"), customerId: z.uuid() }),
  z.strictObject({ mode: z.literal("CREATE"), customer: createCustomerSchema }),
]);

export const createProductInterestSchema = z.strictObject({
  productId: z.uuid(),
  quantity: quantityAmount.optional(),
  estimatedUnitAmount: moneyAmount.optional(),
  notes: optionalText(1000),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateProductInterestSchema = z
  .strictObject({
    quantity: quantityAmount.optional(),
    estimatedUnitAmount: moneyAmount.nullable().optional(),
    notes: optionalText(1000).nullable(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" });

export const opportunityListQuerySchema = listQuerySchema.extend({
  stage: z.enum(["NEW", "QUALIFICATION", "NEEDS_ANALYSIS", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]).optional(),
  customerId: z.uuid().optional(),
  resellerId: z.uuid().optional(),
  ownerUserId: z.uuid().optional(),
  leadSource: leadSourceEnum.optional(),
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  sort: z.enum(["createdAt", "title", "opportunityNumber"]).optional(),
});

export const opportunityIdParamSchema = z.object({ id: z.uuid() });
export const productInterestParamSchema = z.object({ id: z.uuid(), interestId: z.uuid() });

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;
export type ChangeStageInput = z.infer<typeof changeStageSchema>;
export type MarkWonInput = z.infer<typeof markWonSchema>;
export type MarkLostInput = z.infer<typeof markLostSchema>;
export type ReopenOpportunityInput = z.infer<typeof reopenOpportunitySchema>;
export type ConvertOpportunityInput = z.infer<typeof convertOpportunitySchema>;
export type CreateProductInterestInput = z.infer<typeof createProductInterestSchema>;
export type UpdateProductInterestInput = z.infer<typeof updateProductInterestSchema>;
export type OpportunityListQuery = z.infer<typeof opportunityListQuerySchema>;

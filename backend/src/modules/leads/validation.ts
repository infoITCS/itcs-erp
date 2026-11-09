import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";
import { COMPARISON_PERIODS, LEAD_PRIORITIES, LEAD_SOURCES, MANUAL_LEAD_STATUSES } from "./types";

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
  .transform((value) => (value ? value : undefined))
  .refine(
    (value) =>
      value === undefined || (/^\+?[0-9(). -]{7,40}$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7),
    "Enter a phone number with 7-40 digits or phone punctuation",
  );

const optionalWebsite = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || /^https?:\/\/\S+$/i.test(value), "Enter an http or https URL");

const moneyAmount = z
  .string()
  .trim()
  .regex(/^\d{1,15}(\.\d{1,4})?$/, "Enter a non-negative amount with up to 4 decimal places");

const leadSourceEnum = z.enum(LEAD_SOURCES);
const leadPriorityEnum = z.enum(LEAD_PRIORITIES);
const manualStatusEnum = z.enum(MANUAL_LEAD_STATUSES);
const dateOnly = z.iso.date();

export const createLeadSchema = z.strictObject({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  displayName: optionalText(200),
  companyName: optionalText(200),
  jobTitle: optionalText(120),
  email: optionalEmail,
  phone: optionalPhone,
  website: optionalWebsite,
  countryCode,
  currencyCode,
  source: leadSourceEnum,
  priority: leadPriorityEnum.optional(),
  estimatedValue: moneyAmount.optional(),
  ownerUserId: z.uuid().optional(),
  nextAction: optionalText(500),
  nextActionDueAt: z.iso.datetime().optional(),
  description: optionalText(4000),
  notes: optionalText(4000),
});

export const updateLeadSchema = z
  .strictObject({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    displayName: optionalText(200),
    companyName: optionalText(200).nullable(),
    jobTitle: optionalText(120).nullable(),
    email: optionalEmail.nullable(),
    phone: optionalPhone.nullable(),
    website: optionalWebsite.nullable(),
    countryCode: countryCode.optional(),
    currencyCode: currencyCode.optional(),
    source: leadSourceEnum.optional(),
    priority: leadPriorityEnum.optional(),
    estimatedValue: moneyAmount.optional(),
    ownerUserId: z.uuid().optional(),
    nextAction: optionalText(500).nullable(),
    nextActionDueAt: z.iso.datetime().nullable().optional(),
    description: optionalText(4000).nullable(),
    notes: optionalText(4000).nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" });

export const changeLeadStatusSchema = z.strictObject({
  status: manualStatusEnum,
  unqualifiedReason: optionalText(500),
  nextAction: optionalText(500),
  nextActionDueAt: z.iso.datetime().optional(),
});

const leadOpportunitySchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: optionalText(4000),
  estimatedValue: moneyAmount.optional(),
  currencyCode: currencyCode.optional(),
  expectedCloseDate: dateOnly.optional(),
  ownerUserId: z.uuid().optional(),
  nextAction: optionalText(500),
  nextActionDueAt: z.iso.datetime().optional(),
  notes: optionalText(4000),
});

const leadAccountSchema = z.strictObject({
  legalName: z.string().trim().min(1).max(200),
  displayName: z.string().trim().min(1).max(200).optional(),
  customerType: z.enum(["COMPANY", "INDIVIDUAL", "B2B", "B2C", "WHOLESALE"]).default("B2B"),
  entityType: z.enum(["COMPANY", "INDIVIDUAL"]).default("COMPANY"),
  email: optionalEmail.nullable(),
  phone: optionalPhone.nullable(),
  website: optionalWebsite.nullable(),
  countryCode: countryCode.optional(),
  currencyCode: currencyCode.optional(),
  contact: z
    .strictObject({
      firstName: z.string().trim().min(1).max(100),
      lastName: z.string().trim().min(1).max(100),
      jobTitle: optionalText(120),
      email: optionalEmail,
      phone: optionalPhone,
    })
    .optional(),
});

export const convertLeadSchema = z.discriminatedUnion("mode", [
  z.strictObject({
    mode: z.literal("ACCOUNT"),
    customer: leadAccountSchema,
    opportunity: leadOpportunitySchema,
  }),
  z.strictObject({
    mode: z.literal("PROSPECT"),
    opportunity: leadOpportunitySchema.extend({
      prospectDisplayName: z.string().trim().min(1).max(200),
      prospectLegalName: optionalText(200),
      prospectEmail: optionalEmail,
      prospectPhone: optionalPhone,
      prospectCountryCode: countryCode.optional(),
    }),
  }),
]);

export const leadListQuerySchema = listQuerySchema.extend({
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "UNQUALIFIED", "CONVERTED", "WON"]).optional(),
  source: leadSourceEnum.optional(),
  ownerUserId: z.uuid().optional(),
  priority: leadPriorityEnum.optional(),
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  sort: z.enum(["createdAt", "displayName", "leadNumber", "estimatedValue"]).optional(),
});

export const leadAnalyticsQuerySchema = z.object({
  period: z.enum(COMPARISON_PERIODS).default("90d"),
});

export const leadIdParamSchema = z.object({ id: z.uuid() });

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type ChangeLeadStatusInput = z.infer<typeof changeLeadStatusSchema>;
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;
export type LeadAnalyticsQuery = z.infer<typeof leadAnalyticsQuerySchema>;

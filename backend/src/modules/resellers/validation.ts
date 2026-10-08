import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";

const countryCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "Use a two-letter country code")
  .transform((value) => value.toUpperCase());

const currencyCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code")
  .transform((value) => value.toUpperCase());

const priceListCode = z
  .string()
  .trim()
  .min(1)
  .max(32)
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

const optionalWebsite = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || /^https?:\/\/\S+$/i.test(value), "Enter an http or https URL");

const percentString = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .optional()
  .transform((value) => (value ? value : undefined));

export const addressInputSchema = z.strictObject({
  purpose: z.enum(["BILLING", "SHIPPING"]),
  isPrimary: z.boolean().optional(),
  label: optionalText(80),
  line1: z.string().trim().min(1).max(200),
  line2: optionalText(200),
  city: z.string().trim().min(1).max(120),
  region: optionalText(120),
  postalCode: optionalText(20),
  countryCode,
});

export const contactBodySchema = z.strictObject({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  displayName: optionalText(200),
  jobTitle: optionalText(120),
  department: optionalText(120),
  email: optionalEmail,
  phone: optionalText(40),
  mobile: optionalText(40),
  isPrimary: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  notes: optionalText(4000),
});

export const updateContactSchema = contactBodySchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "Provide a field to update",
});

export const createResellerSchema = z
  .strictObject({
    legalName: z.string().trim().min(1).max(200),
    displayName: z.string().trim().min(1).max(200),
    email: optionalEmail,
    phone: optionalText(40),
    website: optionalWebsite,
    countryCode,
    currencyCode,
    taxNumber: optionalText(64),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
    priceListCode: priceListCode.optional(),
    defaultDiscountPercent: percentString,
    defaultCommissionPercent: percentString,
    notes: optionalText(4000),
    addresses: z.array(addressInputSchema).max(20).optional(),
    primaryContact: contactBodySchema.omit({ isPrimary: true, status: true }).optional(),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const address of value.addresses ?? []) {
      if (!address.isPrimary) {
        continue;
      }
      if (seen.has(address.purpose)) {
        ctx.addIssue({
          code: "custom",
          message: "Only one primary address is allowed for each purpose",
          path: ["addresses"],
        });
      }
      seen.add(address.purpose);
    }
  });

export const updateResellerSchema = z
  .strictObject({
    legalName: z.string().trim().min(1).max(200).optional(),
    displayName: z.string().trim().min(1).max(200).optional(),
    email: optionalEmail,
    phone: optionalText(40),
    website: optionalWebsite,
    countryCode: countryCode.optional(),
    currencyCode: currencyCode.optional(),
    taxNumber: optionalText(64),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
    priceListCode: priceListCode.optional(),
    defaultDiscountPercent: percentString.nullable(),
    defaultCommissionPercent: percentString.nullable(),
    notes: optionalText(4000),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" });

export const resellerListQuerySchema = listQuerySchema.extend({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
  country: countryCode.optional(),
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  sort: z.enum(["createdAt", "displayName", "resellerNumber"]).optional(),
});

export const resellerIdParamSchema = z.object({ id: z.string().uuid() });
export const addressIdParamSchema = z.object({ id: z.string().uuid(), addressId: z.string().uuid() });
export const contactIdParamSchema = z.object({ id: z.string().uuid() });
export const customerAssignParamSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
});

export const contactListQuerySchema = listQuerySchema.extend({
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export type AddressInput = z.infer<typeof addressInputSchema>;
export type ContactBody = z.infer<typeof contactBodySchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateResellerInput = z.infer<typeof createResellerSchema>;
export type UpdateResellerInput = z.infer<typeof updateResellerSchema>;
export type ResellerListQuery = z.infer<typeof resellerListQuerySchema>;
export type ContactListQuery = z.infer<typeof contactListQuerySchema>;

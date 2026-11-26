import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";
import { VENDOR_STATUSES } from "./types";

const clearableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value));

const currencyCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code")
  .transform((value) => value.toUpperCase());

const countryCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2,8}$/, "Use a two to eight letter country code")
  .transform((value) => value.toUpperCase());

const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .nullable()
  .optional()
  .transform((value) => (value ? value.toLowerCase() : value === "" ? null : value))
  .refine((value) => value === undefined || value === null || z.email().safeParse(value).success, "Enter a valid email");

const optionalPhone = z
  .string()
  .trim()
  .max(60)
  .nullable()
  .optional()
  .transform((value) => (value ? value : value === "" ? null : value))
  .refine(
    (value) => value === undefined || value === null || (/^\+?[0-9(). -]{7,60}$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7),
    "Enter a phone number with 7-60 digits or phone punctuation",
  );

const optionalWebsite = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((value) => (value ? value : value === "" ? null : value))
  .refine((value) => value === undefined || value === null || /^https?:\/\/\S+$/i.test(value), "Enter an http or https URL");

export const createVendorSchema = z
  .strictObject({
    code: clearableText(64),
    name: z.string().trim().min(1).max(200).optional(),
    legalName: clearableText(200),
    displayName: clearableText(200),
    status: z.enum(VENDOR_STATUSES).optional(),
    vendorType: clearableText(64),
    category: clearableText(100),
    currencyCode,
    paymentTermId: z.uuid().nullable().optional(),
    taxCodeId: z.uuid().nullable().optional(),
    taxId: clearableText(120),
    registrationNumber: clearableText(120),
    website: optionalWebsite,
    email: optionalEmail,
    phone: optionalPhone,
    addressLine1: clearableText(255),
    addressLine2: clearableText(255),
    city: clearableText(120),
    stateProvince: clearableText(120),
    postalCode: clearableText(120),
    countryCode: countryCode.nullable().optional(),
    bankAccount: clearableText(255),
    notes: clearableText(4000),
  })
  .superRefine((value, ctx) => {
    if (!value.name && !value.legalName && !value.displayName) {
      ctx.addIssue({ code: "custom", message: "Provide a name, legal name, or display name", path: ["name"] });
    }
  })
  .transform((value) => {
    const name = value.name || value.legalName || value.displayName || "";
    return {
      ...value,
      name,
      displayName: value.displayName || name,
      legalName: value.legalName || null,
    };
  });

export const updateVendorSchema = z
  .strictObject({
    code: clearableText(64),
    name: z.string().trim().min(1).max(200).optional(),
    legalName: clearableText(200),
    displayName: clearableText(200),
    status: z.enum(VENDOR_STATUSES).optional(),
    vendorType: clearableText(64),
    category: clearableText(100),
    currencyCode: currencyCode.optional(),
    paymentTermId: z.uuid().nullable().optional(),
    taxCodeId: z.uuid().nullable().optional(),
    taxId: clearableText(120),
    registrationNumber: clearableText(120),
    website: optionalWebsite,
    email: optionalEmail,
    phone: optionalPhone,
    addressLine1: clearableText(255),
    addressLine2: clearableText(255),
    city: clearableText(120),
    stateProvince: clearableText(120),
    postalCode: clearableText(120),
    countryCode: countryCode.nullable().optional(),
    bankAccount: clearableText(255),
    notes: clearableText(4000),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" });

export const vendorListQuerySchema = listQuerySchema.extend({
  status: z.enum(VENDOR_STATUSES).optional(),
  currencyCode: currencyCode.optional(),
  paymentTermId: z.uuid().optional(),
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  sort: z.enum(["createdAt", "name", "vendorNumber", "code"]).optional(),
});

export const vendorIdParamSchema = z.object({ id: z.uuid() });

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type VendorListQuery = z.infer<typeof vendorListQuerySchema>;

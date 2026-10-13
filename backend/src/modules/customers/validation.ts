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
  .refine((value) => value === undefined || (/^\+?[0-9(). -]{7,40}$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7), "Enter a phone number with 7-40 digits or phone punctuation");

const optionalTaxNumber = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || /^[A-Za-z0-9][A-Za-z0-9./-]{1,63}$/.test(value), "Use 2-64 letters, numbers, dot, slash or dash");

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
const signedMoneyAmount = z
  .string()
  .trim()
  .regex(/^-?\d{1,15}(\.\d{1,4})?$/, "Enter an amount with up to 4 decimal places");
const taxExemptionCode = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((value) => value || undefined)
  .refine((value) => value === undefined || /^[A-Za-z0-9][A-Za-z0-9/_-]{1,63}$/.test(value), "Use 2-64 letters, numbers, slash, dash or underscore");

const customerTypes = ["COMPANY", "INDIVIDUAL", "B2B", "B2C", "WHOLESALE"] as const;
const entityTypes = ["COMPANY", "INDIVIDUAL"] as const;
const customerCategories = ["RETAIL", "WHOLESALE", "CORPORATE", "VIP", "PARTNER", "OTHER"] as const;
const customerStatuses = ["ACTIVE", "INACTIVE", "HOLD"] as const;
const incorporationStatuses = ["REGISTERED", "PENDING", "UNREGISTERED", "NOT_APPLICABLE"] as const;
const identityDocumentTypes = ["CNIC", "PASSPORT"] as const;
const paymentMethods = ["BANK_TRANSFER", "CASH", "CARD", "CHEQUE", "MOBILE_WALLET", "OTHER"] as const;
const communicationChannels = ["EMAIL", "PHONE", "SMS", "WHATSAPP"] as const;
const leadSources = ["WEBSITE", "REFERRAL", "COLD_CALL", "SOCIAL_MEDIA", "ADVERTISEMENT", "PARTNER", "TENDER", "OTHER"] as const;
const contactRoles = ["BILLING", "PROCUREMENT", "FINANCE", "OPERATIONS", "SALES", "OTHER"] as const;
const customerRatings = ["HOT", "WARM", "COLD", "MISCELLANEOUS"] as const;
const customerPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

const coordinatePair = {
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  geofenceRadiusMeters: z.number().int().positive().optional(),
};

function validateCoordinatePair(
  value: { latitude?: number; longitude?: number },
  ctx: z.RefinementCtx,
) {
  if ((value.latitude === undefined) !== (value.longitude === undefined)) {
    ctx.addIssue({ code: "custom", message: "Provide both latitude and longitude, or leave both empty", path: ["latitude"] });
  }
}

export const addressInputSchema = z
  .strictObject({
    purpose: z.enum(["BILLING", "SHIPPING"]),
    isPrimary: z.boolean().optional(),
    label: optionalText(80),
    line1: z.string().trim().min(1).max(200),
    line2: optionalText(200),
    city: z.string().trim().min(1).max(120),
    region: optionalText(120),
    postalCode: optionalText(20),
    countryCode,
    ...coordinatePair,
  })
  .superRefine(validateCoordinatePair);

const customerAddressSchema = addressInputSchema.safeExtend({
  id: z.uuid().optional(),
});

const customerContactSchema = z.strictObject({
  id: z.uuid().optional(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  displayName: optionalText(200),
  role: z.enum(contactRoles).optional(),
  jobTitle: optionalText(120),
  department: optionalText(120),
  email: optionalEmail,
  phone: optionalText(40),
  mobile: optionalText(40),
  isPrimary: z.boolean().default(false),
  emailOptIn: z.boolean().default(false),
  phoneOptIn: z.boolean().default(false),
  smsOptIn: z.boolean().default(false),
  whatsappOptIn: z.boolean().default(false),
  notes: optionalText(4000),
});

function validatePrimaryRows(
  value: { addresses?: Array<{ purpose: string; isPrimary?: boolean }>; contacts?: Array<{ isPrimary: boolean }> },
  ctx: z.RefinementCtx,
) {
  const primaryPurposes = new Set<string>();
  for (const address of value.addresses ?? []) {
    if (!address.isPrimary) {
      continue;
    }
    if (primaryPurposes.has(address.purpose)) {
      ctx.addIssue({ code: "custom", message: "Only one primary address is allowed for each purpose", path: ["addresses"] });
    }
    primaryPurposes.add(address.purpose);
  }
  if ((value.contacts ?? []).filter((contact) => contact.isPrimary).length > 1) {
    ctx.addIssue({ code: "custom", message: "Only one primary contact is allowed", path: ["contacts"] });
  }
}

function validateCustomerProfile(
  value: {
    entityType?: "COMPANY" | "INDIVIDUAL";
    identityDocumentType?: "CNIC" | "PASSPORT" | null;
    identityDocumentNumber?: string | null;
    taxExempt?: boolean;
    taxExemptionCode?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  const documentNumber = value.identityDocumentNumber?.trim();
  if (value.entityType === "INDIVIDUAL" && Boolean(value.identityDocumentType) !== Boolean(documentNumber)) {
    ctx.addIssue({ code: "custom", message: "Provide both the document type and number", path: [documentNumber ? "identityDocumentType" : "identityDocumentNumber"] });
  }
  if (documentNumber && value.identityDocumentType === "CNIC" && !/^(\d{13}|\d{5}-\d{7}-\d)$/.test(documentNumber)) {
    ctx.addIssue({ code: "custom", message: "Enter a 13-digit CNIC, optionally formatted with dashes", path: ["identityDocumentNumber"] });
  }
  if (documentNumber && value.identityDocumentType === "PASSPORT" && !/^[A-Za-z0-9]{5,20}$/.test(documentNumber)) {
    ctx.addIssue({ code: "custom", message: "Enter a passport number using 5-20 letters or numbers", path: ["identityDocumentNumber"] });
  }
  if (value.entityType === "COMPANY" && (value.identityDocumentType || documentNumber)) {
    ctx.addIssue({ code: "custom", message: "Identity documents are only for individual customers", path: ["identityDocumentType"] });
  }
  if (value.taxExempt && !value.taxExemptionCode) {
    ctx.addIssue({ code: "custom", message: "Enter an exemption code for tax-exempt customers", path: ["taxExemptionCode"] });
  }
}

export const createCustomerSchema = z
  .strictObject({
    entityType: z.enum(entityTypes).default("COMPANY"),
    customerType: z.enum(customerTypes),
    customerCategory: z.enum(customerCategories).optional(),
    industry: optionalText(120),
    employeeCount: z.number().int().min(0).optional(),
    incorporationStatus: z.enum(incorporationStatuses).optional(),
    businessRegistrationDate: z.iso.date().optional(),
    registrationNumber: optionalText(64),
    rating: z.enum(customerRatings).optional(),
    priority: z.enum(customerPriorities).default("NORMAL"),
    customerCode: optionalText(32),
    sameAsBilling: z.boolean().default(true),
    leadSource: z.enum(leadSources).optional(),
    assignedSalesRepId: z.uuid().optional(),
    legalName: z.string().trim().min(1).max(200),
    displayName: z.string().trim().min(1).max(200),
    middleName: optionalText(100),
    email: optionalEmail.nullable().optional(),
    phone: optionalPhone.nullable().optional(),
    website: optionalWebsite.nullable().optional(),
    countryCode,
    currencyCode,
    taxNumber: optionalTaxNumber.nullable().optional(),
    taxIdType: z.enum(["NTN", "STRN", "OTHER"]).optional(),
    taxExemptionCode: taxExemptionCode.nullable().optional(),
    defaultTaxCodeId: z.uuid().optional(),
    identityDocumentType: z.enum(identityDocumentTypes).optional(),
    identityDocumentNumber: optionalText(40).nullable().optional(),
    taxExempt: z.boolean().default(false),
    pricesIncludeTax: z.boolean().default(false),
    emailMarketingOptIn: z.boolean().default(false),
    creditHold: z.boolean().default(false),
    status: z.enum(customerStatuses).optional(),
    creditLimit: moneyAmount.optional(),
    preferredPaymentMethod: z.enum(paymentMethods).optional(),
    preferredCommunicationChannel: z.enum(communicationChannels).optional(),
    paymentTermId: z.uuid().optional(),
    pricingGroupId: z.uuid().optional(),
    accountingCategoryId: z.uuid().optional(),
    openingBalance: signedMoneyAmount.optional(),
    openingBalanceDate: z.iso.date().optional(),
    notes: optionalText(4000).nullable().optional(),
    addresses: z.array(customerAddressSchema).max(20).optional(),
    contacts: z.array(customerContactSchema).max(100).optional(),
    primaryContact: z
      .strictObject({
        firstName: z.string().trim().min(1).max(100),
        lastName: z.string().trim().min(1).max(100),
        displayName: optionalText(200),
        jobTitle: optionalText(120),
        department: optionalText(120),
        email: optionalEmail,
        phone: optionalText(40),
        mobile: optionalText(40),
        notes: optionalText(4000),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    validatePrimaryRows(value, ctx);
    validateCustomerProfile(value, ctx);
  });

export const updateCustomerSchema = z.strictObject({
  entityType: z.enum(entityTypes).optional(),
  customerType: z.enum(customerTypes).optional(),
  customerCategory: z.enum(customerCategories).nullable().optional(),
  industry: optionalText(120).nullable().optional(),
  employeeCount: z.number().int().min(0).nullable().optional(),
  incorporationStatus: z.enum(incorporationStatuses).nullable().optional(),
  businessRegistrationDate: z.iso.date().nullable().optional(),
  registrationNumber: optionalText(64).nullable().optional(),
  rating: z.enum(customerRatings).nullable().optional(),
  priority: z.enum(customerPriorities).optional(),
  customerCode: optionalText(32).nullable().optional(),
  sameAsBilling: z.boolean().optional(),
  leadSource: z.enum(leadSources).nullable().optional(),
  assignedSalesRepId: z.uuid().nullable().optional(),
  legalName: z.string().trim().min(1).max(200).optional(),
  displayName: z.string().trim().min(1).max(200).optional(),
  middleName: optionalText(100).nullable().optional(),
  email: optionalEmail.nullable().optional(),
  phone: optionalPhone.nullable().optional(),
  website: optionalWebsite.nullable().optional(),
  countryCode: countryCode.optional(),
  currencyCode: currencyCode.optional(),
  taxNumber: optionalTaxNumber.nullable().optional(),
  taxIdType: z.enum(["NTN", "STRN", "OTHER"]).nullable().optional(),
  taxExemptionCode: taxExemptionCode.nullable().optional(),
  defaultTaxCodeId: z.uuid().nullable().optional(),
  identityDocumentType: z.enum(identityDocumentTypes).nullable().optional(),
  identityDocumentNumber: optionalText(40).nullable().optional(),
  taxExempt: z.boolean().optional(),
  pricesIncludeTax: z.boolean().optional(),
  emailMarketingOptIn: z.boolean().optional(),
  creditHold: z.boolean().optional(),
  status: z.enum(customerStatuses).optional(),
  creditLimit: moneyAmount.optional(),
  preferredPaymentMethod: z.enum(paymentMethods).nullable().optional(),
  preferredCommunicationChannel: z.enum(communicationChannels).nullable().optional(),
  paymentTermId: z.uuid().nullable().optional(),
  pricingGroupId: z.uuid().nullable().optional(),
  accountingCategoryId: z.uuid().nullable().optional(),
  openingBalance: signedMoneyAmount.optional(),
  openingBalanceDate: z.iso.date().nullable().optional(),
  notes: optionalText(4000).nullable().optional(),
  addresses: z.array(customerAddressSchema).max(20).optional(),
  contacts: z.array(customerContactSchema).max(100).optional(),
}).superRefine(validateCustomerProfile);

export const customerListQuerySchema = listQuerySchema.extend({
  status: z.enum(["ACTIVE", "INACTIVE", "HOLD"]).optional(),
  customerType: z.enum(["COMPANY", "INDIVIDUAL", "B2B", "B2C", "WHOLESALE"]).optional(),
  country: countryCode.optional(),
  currency: currencyCode.optional(),
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  sort: z.enum(["createdAt", "displayName", "customerNumber"]).optional(),
});

export const createPaymentTermSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  dueDays: z.number().int().min(0).max(3650),
  requiresPrepayment: z.boolean(),
});

export const createAccountingCategorySchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "Use up to 32 letters, numbers, dash or underscore")
    .transform((value) => value.toUpperCase())
    .optional(),
});

export const customerIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const addressIdParamSchema = z.object({
  id: z.string().uuid(),
  addressId: z.string().uuid(),
});

export const customerContactParamSchema = z.object({
  customerId: z.string().uuid(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type AddressInput = z.input<typeof addressInputSchema>;
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
export type CreatePaymentTermInput = z.infer<typeof createPaymentTermSchema>;
export type CreateAccountingCategoryInput = z.infer<typeof createAccountingCategorySchema>;

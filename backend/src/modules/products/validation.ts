import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

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

const optionCode = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .transform((value) => value.toUpperCase());

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const moneyAmount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, "Use a positive number with up to 4 decimal places");

export const productPriceInputSchema = z
  .strictObject({
    priceType: z.enum(["SALES", "PURCHASE"]),
    priceListCode: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .optional()
      .transform((value) => (value ? value.toUpperCase() : "STANDARD")),
    currencyCode,
    amount: moneyAmount,
    effectiveDate: dateOnly,
    expiryDate: dateOnly.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.expiryDate && value.expiryDate < value.effectiveDate) {
      ctx.addIssue({ code: "custom", message: "Expiry must be on or after the effective date", path: ["expiryDate"] });
    }
  });

export const createProductSchema = z
  .strictObject({
    code: optionalText(64),
    name: z.string().trim().min(1).max(200),
    description: clearableText(4000),
    productType: z.enum(["PHYSICAL_PRODUCT", "SERVICE"]),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    unitOfMeasureId: z.string().uuid(),
    taxCodeId: z.string().uuid().nullable().optional(),
    trackInventory: z.boolean().optional(),
    valuationMethod: z.enum(["WEIGHTED_AVERAGE", "FIFO"]).default("WEIGHTED_AVERAGE"),
    weightedAveragePrice: moneyAmount.optional(),
    allowNegativeStock: z.boolean().optional(),
    minimumStockQuantity: moneyAmount.optional(),
    receivingLocation: z.string().trim().min(1).max(120).default("MAIN LOCATION"),
    deliveryLocation: z.string().trim().min(1).max(120).default("MAIN LOCATION"),
    inventoryAccount: clearableText(120),
    inventoryTransitAccount: clearableText(120),
    privateNote: clearableText(4000),
    netWeight: moneyAmount.optional(),
    width: moneyAmount.optional(),
    length: moneyAmount.optional(),
    height: moneyAmount.optional(),
    dimensionUnit: z.enum(["METER", "CENTIMETER", "INCH", "FOOT"]).default("METER"),
    cogsAccount: z.string().trim().min(1).max(120).optional(),
    incomeAccount: z.string().trim().min(1).max(120).optional(),
    notes: clearableText(4000),
    initialSalesPrice: productPriceInputSchema.optional(),
    initialPurchasePrice: productPriceInputSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.productType === "SERVICE" && value.trackInventory === true) {
      ctx.addIssue({
        code: "custom",
        message: "A service cannot track inventory",
        path: ["trackInventory"],
      });
    }
    if (value.productType === "SERVICE" && value.allowNegativeStock === true) {
      ctx.addIssue({
        code: "custom",
        message: "A service cannot authorize negative stock",
        path: ["allowNegativeStock"],
      });
    }
    if (value.initialSalesPrice && value.initialSalesPrice.priceType !== "SALES") {
      ctx.addIssue({
        code: "custom",
        message: "Initial sales price must be a sales price",
        path: ["initialSalesPrice", "priceType"],
      });
    }
    if (value.initialPurchasePrice && value.initialPurchasePrice.priceType !== "PURCHASE") {
      ctx.addIssue({
        code: "custom",
        message: "Initial purchase price must be a purchase price",
        path: ["initialPurchasePrice", "priceType"],
      });
    }
  })
  .transform((value) => ({
    ...value,
    cogsAccount: value.cogsAccount || (value.productType === "SERVICE" ? "COGS - Services (50140)" : "COGS - Products (50110)"),
    incomeAccount: value.incomeAccount || (value.productType === "SERVICE" ? "Sales - Services (40140)" : "Sales - Miscellaneous (40150)"),
  }));

export const updateProductSchema = z
  .strictObject({
    code: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: clearableText(4000),
    productType: z.enum(["PHYSICAL_PRODUCT", "SERVICE"]).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    unitOfMeasureId: z.string().uuid().optional(),
    taxCodeId: z.string().uuid().nullable().optional(),
    trackInventory: z.boolean().optional(),
    valuationMethod: z.enum(["WEIGHTED_AVERAGE", "FIFO"]).optional(),
    weightedAveragePrice: moneyAmount.optional(),
    allowNegativeStock: z.boolean().optional(),
    minimumStockQuantity: moneyAmount.optional(),
    receivingLocation: z.string().trim().min(1).max(120).optional(),
    deliveryLocation: z.string().trim().min(1).max(120).optional(),
    inventoryAccount: clearableText(120),
    inventoryTransitAccount: clearableText(120),
    privateNote: clearableText(4000),
    netWeight: moneyAmount.optional(),
    width: moneyAmount.optional(),
    length: moneyAmount.optional(),
    height: moneyAmount.optional(),
    dimensionUnit: z.enum(["METER", "CENTIMETER", "INCH", "FOOT"]).optional(),
    cogsAccount: z.string().trim().min(1).max(120).optional(),
    incomeAccount: z.string().trim().min(1).max(120).optional(),
    notes: clearableText(4000),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" })
  .superRefine((value, ctx) => {
    if (value.productType === "SERVICE" && value.trackInventory === true) {
      ctx.addIssue({
        code: "custom",
        message: "A service cannot track inventory",
        path: ["trackInventory"],
      });
    }
    if (value.productType === "SERVICE" && value.allowNegativeStock === true) {
      ctx.addIssue({
        code: "custom",
        message: "A service cannot authorize negative stock",
        path: ["allowNegativeStock"],
      });
    }
  });

export const productListQuerySchema = listQuerySchema.extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  productType: z.enum(["PHYSICAL_PRODUCT", "SERVICE"]).optional(),
  categoryId: z.string().uuid().optional(),
  trackInventory: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  sort: z.enum(["createdAt", "name", "code"]).optional(),
});

export const productIdParamSchema = z.object({ id: z.string().uuid() });

export const createCategorySchema = z.strictObject({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(120),
  description: optionalText(500),
  parentId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema
  .partial()
  .extend({ parentId: z.string().uuid().nullable().optional() })
  .refine((value) => Object.keys(value).length > 0, { message: "Provide a field to update" });

export const createUnitOfMeasureSchema = z.strictObject({
  code: optionCode,
  name: z.string().trim().min(1).max(80),
  isActive: z.boolean().optional(),
});

export const createTaxCodeSchema = z
  .strictObject({
    code: optionCode,
    name: z.string().trim().min(1).max(120),
    rate: moneyAmount,
    isActive: z.boolean().optional(),
  })
  .refine((value) => Number(value.rate) <= 100, {
    message: "Tax rate cannot exceed 100",
    path: ["rate"],
  });

export const categoryIdParamSchema = z.object({ id: z.string().uuid() });
export const priceIdParamSchema = z.object({ id: z.string().uuid() });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductPriceInput = z.infer<typeof productPriceInputSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateUnitOfMeasureInput = z.infer<typeof createUnitOfMeasureSchema>;
export type CreateTaxCodeInput = z.infer<typeof createTaxCodeSchema>;

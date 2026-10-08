import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const currencyCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code")
  .transform((value) => value.toUpperCase());

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

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
    amount: z.string().trim().min(1).max(40),
    effectiveDate: dateOnly,
    expiryDate: dateOnly.optional(),
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
    description: optionalText(4000),
    productType: z.enum(["PHYSICAL_PRODUCT", "SERVICE"]),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    categoryId: z.string().uuid().optional(),
    unitOfMeasureId: z.string().uuid(),
    taxCodeId: z.string().uuid().optional(),
    trackInventory: z.boolean().optional(),
    notes: optionalText(4000),
    initialSalesPrice: productPriceInputSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.productType === "SERVICE" && value.trackInventory === true) {
      ctx.addIssue({
        code: "custom",
        message: "A service cannot track inventory",
        path: ["trackInventory"],
      });
    }
    if (value.initialSalesPrice && value.initialSalesPrice.priceType !== "SALES") {
      ctx.addIssue({
        code: "custom",
        message: "Initial price must be a sales price",
        path: ["initialSalesPrice", "priceType"],
      });
    }
  });

export const updateProductSchema = z
  .strictObject({
    code: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: optionalText(4000),
    productType: z.enum(["PHYSICAL_PRODUCT", "SERVICE"]).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    unitOfMeasureId: z.string().uuid().optional(),
    taxCodeId: z.string().uuid().nullable().optional(),
    trackInventory: z.boolean().optional(),
    notes: optionalText(4000),
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

export const categoryIdParamSchema = z.object({ id: z.string().uuid() });
export const priceIdParamSchema = z.object({ id: z.string().uuid() });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductPriceInput = z.infer<typeof productPriceInputSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

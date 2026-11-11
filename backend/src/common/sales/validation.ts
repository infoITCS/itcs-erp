import { z } from "zod";

export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));
}

export const currencyCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code")
  .transform((value) => value.toUpperCase());

export const moneyAmountSchema = z
  .string()
  .trim()
  .regex(/^\d{1,15}(\.\d{1,4})?$/, "Enter a non-negative amount with up to 4 decimal places");

export const positiveMoneySchema = moneyAmountSchema.refine(
  (value) => Number(value) > 0,
  "Enter an amount greater than zero",
);

export const percentageSchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,4})?$/, "Enter a percentage with up to 4 decimal places")
  .refine((value) => Number(value) <= 100, "Enter a percentage of 100 or less");

export const salesLineInputSchema = z
  .strictObject({
    productId: z.uuid().optional(),
    productCode: optionalText(64),
    productName: optionalText(200),
    description: optionalText(1000),
    unitOfMeasure: optionalText(32),
    quantity: positiveMoneySchema,
    unitPrice: moneyAmountSchema,
    discountPercent: percentageSchema.optional(),
    taxCodeId: z.uuid().optional(),
    taxRate: percentageSchema.optional(),
  })
  .refine((value) => value.productId !== undefined || value.productName !== undefined, {
    message: "Choose a product or enter a line description",
  });

export const documentIdParamSchema = z.object({ id: z.uuid() });

export const includeDeletedSchema = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

export type SalesLineInput = z.infer<typeof salesLineInputSchema>;

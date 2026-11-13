import { z } from "zod";

export const organizationIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    baseCurrencyCode: z
      .string()
      .trim()
      .regex(/^[a-zA-Z]{3}$/, "Use a three-letter currency code")
      .transform((code) => code.toUpperCase())
      .optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Provide at least one field to update",
  });

import { z } from "zod";
import { listQuerySchema } from "../../common/pagination/list-query";
import { documentIdParamSchema, moneyAmountSchema, optionalText } from "../../common/sales/validation";
import { INVENTORY_MOVEMENT_TYPES } from "./types";

export const stockQuerySchema = listQuerySchema.extend({
  productId: z.uuid().optional(),
  lowStock: z.enum(["true", "false"]).optional().transform((value) => value === "true"),
});

export const movementQuerySchema = listQuerySchema.extend({
  productId: z.uuid().optional(),
  type: z.enum(INVENTORY_MOVEMENT_TYPES).optional(),
});

export const createAdjustmentSchema = z.strictObject({
  productId: z.uuid(),
  quantity: z
    .string()
    .trim()
    .regex(/^-?\d{1,12}(\.\d{1,4})?$/, "Enter a signed quantity with up to 4 decimal places")
    .refine((value) => Number(value) !== 0, "Enter a quantity other than zero"),
  location: optionalText(120),
  unitCost: moneyAmountSchema.optional(),
  reason: z.string().trim().min(3).max(500),
});

export const inventoryIdParamSchema = documentIdParamSchema;

export type StockQuery = z.infer<typeof stockQuerySchema>;
export type MovementQuery = z.infer<typeof movementQuerySchema>;
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;

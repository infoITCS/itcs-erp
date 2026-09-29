import { z } from "zod";

export const documentSequenceQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(9999).optional(),
});

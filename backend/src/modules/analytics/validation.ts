import { z } from "zod";

export const analyticsQuerySchema = z.object({
  range: z.enum(["30d", "90d", "12m", "all"]).default("90d"),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

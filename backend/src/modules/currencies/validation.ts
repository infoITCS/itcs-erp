import { z } from "zod";

const currencyCode = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Za-z]{3}$/);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const exchangeRateQuerySchema = z.object({
  base: currencyCode,
  quote: currencyCode,
  asOf: isoDate,
});

export const createExchangeRateSchema = z.object({
  baseCurrencyCode: currencyCode,
  quoteCurrencyCode: currencyCode,
  rate: z.string().trim().min(1).max(30),
  effectiveDate: isoDate,
  source: z.string().trim().min(1).max(80),
});

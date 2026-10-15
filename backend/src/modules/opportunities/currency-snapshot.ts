import { Prisma } from "@prisma/client";
import { ValidationFailedError } from "../../common/errors/app-error";

export const EXCHANGE_RATE_SCALE = 8;
export const AMOUNT_SCALE = 4;

export interface CurrencySnapshot {
  exchangeRateToBase: string;
  estimatedValueBase: string;
  baseCurrencyCode: string;
}

/**
 * Looks up an organization's exchange rate for a currency pair.
 * `rate` is quote-currency units per 1 unit of the base currency.
 */
export type RateLookup = (baseCurrencyCode: string, quoteCurrencyCode: string) => Promise<string | null>;

/**
 * Converts `estimatedValue` (in `currencyCode`) into the organization's base currency.
 *
 * - Same currency: rate is 1.
 * - A rate row with base = currencyCode, quote = baseCurrencyCode: multiply by the rate.
 * - A rate row with base = baseCurrencyCode, quote = currencyCode: divide by the rate.
 * - Neither exists: the conversion cannot be resolved.
 *
 * The returned snapshot is what gets stored. A later read or report must use those
 * stored fields and must not fill a missing snapshot from a live exchange rate.
 */
export async function computeCurrencySnapshot(
  estimatedValue: string,
  currencyCode: string,
  baseCurrencyCode: string,
  findRate: RateLookup,
): Promise<CurrencySnapshot> {
  const amount = new Prisma.Decimal(estimatedValue);

  if (currencyCode === baseCurrencyCode) {
    return {
      exchangeRateToBase: new Prisma.Decimal(1).toFixed(EXCHANGE_RATE_SCALE),
      estimatedValueBase: amount.toFixed(AMOUNT_SCALE),
      baseCurrencyCode,
    };
  }

  const directRate = await findRate(currencyCode, baseCurrencyCode);
  if (directRate) {
    const rate = new Prisma.Decimal(directRate);
    return {
      exchangeRateToBase: rate.toFixed(EXCHANGE_RATE_SCALE),
      estimatedValueBase: amount.mul(rate).toFixed(AMOUNT_SCALE),
      baseCurrencyCode,
    };
  }

  const inverseRate = await findRate(baseCurrencyCode, currencyCode);
  if (inverseRate) {
    const rate = new Prisma.Decimal(inverseRate);
    return {
      exchangeRateToBase: new Prisma.Decimal(1).div(rate).toFixed(EXCHANGE_RATE_SCALE),
      estimatedValueBase: amount.div(rate).toFixed(AMOUNT_SCALE),
      baseCurrencyCode,
    };
  }

  throw new ValidationFailedError({
    currencyCode: [
      "No exchange rate is configured between this currency and the organization's base currency",
    ],
  });
}

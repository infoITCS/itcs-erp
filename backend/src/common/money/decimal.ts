import { ValidationFailedError } from "../errors/app-error";

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

/** Accepts a decimal string only. JSON numbers are rejected at the route. */
export function assertDecimalString(value: string, scale: number): string {
  const normalized = value.trim();
  if (!DECIMAL_PATTERN.test(normalized)) {
    throw new ValidationFailedError({
      rate: ["Enter a decimal amount such as 278.50"],
    });
  }

  const fraction = normalized.split(".")[1] ?? "";
  if (fraction.length > scale) {
    throw new ValidationFailedError({
      rate: [`Use at most ${scale} decimal places`],
    });
  }

  return normalized;
}

export interface RateCandidate {
  effectiveDate: string;
  rate: string;
  isActive: boolean;
}

/** Latest active rate whose effective date is on or before asOf. */
export function selectEffectiveRate(rates: RateCandidate[], asOf: string): RateCandidate | null {
  const eligible = rates
    .filter((rate) => rate.isActive && rate.effectiveDate <= asOf)
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate));

  return eligible[0] ?? null;
}

import { ValidationFailedError } from "../../common/errors/app-error";

export const QUOTES_MODULE = "quotes" as const;

export const QUOTE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"] as const;
export type QuoteStatusValue = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_TRANSITIONS: Record<QuoteStatusValue, readonly QuoteStatusValue[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["REJECTED", "EXPIRED", "CANCELLED"],
  ACCEPTED: [],
  REJECTED: ["DRAFT"],
  EXPIRED: ["DRAFT"],
  CANCELLED: [],
};

export const QUOTE_MANUAL_STATUSES = ["SENT", "REJECTED", "EXPIRED", "CANCELLED"] as const;
export type QuoteManualStatus = (typeof QUOTE_MANUAL_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatusValue, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export function canTransitionQuote(current: QuoteStatusValue, next: QuoteStatusValue): boolean {
  return QUOTE_STATUS_TRANSITIONS[current].includes(next);
}

export function assertQuoteTransition(current: QuoteStatusValue, next: QuoteStatusValue): void {
  if (!canTransitionQuote(current, next)) {
    throw new ValidationFailedError({
      status: [`A ${QUOTE_STATUS_LABELS[current]} quote cannot move to ${QUOTE_STATUS_LABELS[next]}`],
    });
  }
}

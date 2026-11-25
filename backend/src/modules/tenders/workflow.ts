import type { TenderStatusValue } from "./types";

export const TENDER_TRANSITIONS: Record<TenderStatusValue, readonly TenderStatusValue[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["WON", "LOST", "CANCELLED"],
  WON: [],
  LOST: [],
  CANCELLED: [],
};

export function canTransitionTender(from: TenderStatusValue, to: TenderStatusValue): boolean {
  return from === to || TENDER_TRANSITIONS[from].includes(to);
}

export function nextTenderStatuses(from: TenderStatusValue): readonly TenderStatusValue[] {
  return TENDER_TRANSITIONS[from];
}

export function isTerminalTenderStatus(status: TenderStatusValue): boolean {
  return TENDER_TRANSITIONS[status].length === 0;
}

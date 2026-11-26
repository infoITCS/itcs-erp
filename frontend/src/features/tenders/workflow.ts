import type { TenderStatus } from "./api.ts";

export const TENDER_TRANSITIONS: Record<TenderStatus, readonly TenderStatus[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["WON", "LOST", "CANCELLED"],
  WON: [],
  LOST: [],
  CANCELLED: [],
};

export const TENDER_STAGES = [
  { key: "DRAFT", label: "Draft", hint: "Prepare the brief", statuses: ["DRAFT"] },
  { key: "OPEN", label: "Open", hint: "Ready for bidding", statuses: ["OPEN"] },
  { key: "SUBMITTED", label: "Submitted", hint: "Bid delivered", statuses: ["SUBMITTED"] },
  { key: "OUTCOME", label: "Outcome", hint: "Award or close", statuses: ["WON", "LOST", "CANCELLED"] },
] as const;

export const TENDER_INITIAL_STATUSES: readonly TenderStatus[] = ["DRAFT", "OPEN"];

export const TENDER_STATUS_HELP: Record<TenderStatus, string> = {
  DRAFT: "Preparing the tender brief. Not ready for bidders yet.",
  OPEN: "Published to bidders and accepting submissions.",
  SUBMITTED: "Bid submitted; waiting for the award decision.",
  WON: "Awarded to your organization. Final outcome with a linked WON opportunity.",
  LOST: "Awarded to another bidder. Final outcome.",
  CANCELLED: "Tender withdrawn or cancelled. Final outcome.",
};

export function canTransitionTender(from: TenderStatus, to: TenderStatus): boolean {
  return from === to || TENDER_TRANSITIONS[from].includes(to);
}

export function nextTenderStatuses(from: TenderStatus): readonly TenderStatus[] {
  return TENDER_TRANSITIONS[from];
}

export function isTerminalTenderStatus(status: TenderStatus): boolean {
  return TENDER_TRANSITIONS[status].length === 0;
}

export function tenderStageIndex(status: TenderStatus): number {
  const index = TENDER_STAGES.findIndex((stage) =>
    (stage.statuses as readonly string[]).includes(status),
  );
  return index === -1 ? 0 : index;
}

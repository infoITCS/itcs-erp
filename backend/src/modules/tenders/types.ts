export const TENDERS_MODULE = "tenders" as const;

export const TENDER_STATUSES = ["DRAFT", "OPEN", "SUBMITTED", "WON", "LOST", "CANCELLED"] as const;
export type TenderStatusValue = (typeof TENDER_STATUSES)[number];

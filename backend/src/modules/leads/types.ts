export const LEADS_MODULE = "leads" as const;

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "UNQUALIFIED",
  "CONVERTED",
  "WON",
] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

/**
 * Manual status changes. CONVERTED is set by the conversion endpoint and WON
 * is set automatically when the linked opportunity is marked won.
 */
export const LEAD_STATUS_TRANSITIONS: Record<LeadStatusValue, readonly LeadStatusValue[]> = {
  NEW: ["CONTACTED", "QUALIFIED", "UNQUALIFIED"],
  CONTACTED: ["QUALIFIED", "UNQUALIFIED"],
  QUALIFIED: ["UNQUALIFIED"],
  UNQUALIFIED: ["CONTACTED", "QUALIFIED"],
  CONVERTED: [],
  WON: [],
};

export const MANUAL_LEAD_STATUSES = ["CONTACTED", "QUALIFIED", "UNQUALIFIED"] as const;

export const LEAD_SOURCES = [
  "WEBSITE",
  "REFERRAL",
  "COLD_CALL",
  "SOCIAL_MEDIA",
  "ADVERTISEMENT",
  "PARTNER",
  "TENDER",
  "OTHER",
] as const;
export type LeadSourceValue = (typeof LEAD_SOURCES)[number];

export const LEAD_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type LeadPriorityValue = (typeof LEAD_PRIORITIES)[number];

export const COMPARISON_PERIODS = ["30d", "90d", "12m", "all"] as const;
export type ComparisonPeriod = (typeof COMPARISON_PERIODS)[number];

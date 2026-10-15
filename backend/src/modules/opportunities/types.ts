export const OPPORTUNITIES_MODULE = "opportunities" as const;

/** Stages an opportunity can be actively worked in. Any open stage can move to any other open stage, or to WON/LOST. */
export const OPEN_STAGES = ["NEW", "QUALIFICATION", "NEEDS_ANALYSIS", "PROPOSAL", "NEGOTIATION"] as const;
export type OpenStage = (typeof OPEN_STAGES)[number];

/** Terminal stages. Once here, the opportunity can only move again via the reopen endpoint. */
export const TERMINAL_STAGES = ["WON", "LOST"] as const;
export type TerminalStage = (typeof TERMINAL_STAGES)[number];

export const ALL_STAGES = [...OPEN_STAGES, ...TERMINAL_STAGES] as const;
export type OpportunityStageValue = OpenStage | TerminalStage;

export const LOST_REASONS = [
  "PRICE",
  "COMPETITOR",
  "NO_BUDGET",
  "NO_DECISION",
  "TIMING",
  "SCOPE_MISMATCH",
  "INTERNAL",
  "OTHER",
] as const;
export type OpportunityLostReasonValue = (typeof LOST_REASONS)[number];

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
export type OpportunityLeadSourceValue = (typeof LEAD_SOURCES)[number];

/** Default probability applied when a stage change requests the stage's default. */
export const STAGE_DEFAULT_PROBABILITY: Record<OpportunityStageValue, number> = {
  NEW: 10,
  QUALIFICATION: 20,
  NEEDS_ANALYSIS: 40,
  PROPOSAL: 60,
  NEGOTIATION: 80,
  WON: 100,
  LOST: 0,
};

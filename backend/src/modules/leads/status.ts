import { ValidationFailedError } from "../../common/errors/app-error";
import { LEAD_STATUS_TRANSITIONS, type LeadStatusValue } from "./types";

export function canTransitionLead(current: LeadStatusValue, next: LeadStatusValue): boolean {
  return LEAD_STATUS_TRANSITIONS[current].includes(next);
}

export function assertLeadTransition(current: LeadStatusValue, next: LeadStatusValue): void {
  if (!canTransitionLead(current, next)) {
    throw new ValidationFailedError({
      status: [`A ${label(current)} lead cannot move to ${label(next)}`],
    });
  }
}

export function label(status: string): string {
  return status
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

export function isConverted(status: LeadStatusValue): boolean {
  return status === "CONVERTED" || status === "WON";
}

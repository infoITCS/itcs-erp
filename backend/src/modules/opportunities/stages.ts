import { ValidationFailedError } from "../../common/errors/app-error";
import {
  OPEN_STAGES,
  STAGE_DEFAULT_PROBABILITY,
  TERMINAL_STAGES,
  type OpenStage,
  type OpportunityStageValue,
  type TerminalStage,
} from "./types";

export function isOpenStage(stage: string): stage is OpenStage {
  return (OPEN_STAGES as readonly string[]).includes(stage);
}

export function isTerminalStage(stage: string): stage is TerminalStage {
  return (TERMINAL_STAGES as readonly string[]).includes(stage);
}

export function defaultProbabilityForStage(stage: OpportunityStageValue): number {
  return STAGE_DEFAULT_PROBABILITY[stage];
}

/**
 * Open stages can move to any other open stage or straight to WON/LOST.
 * A terminal stage (WON/LOST) can only move again through the reopen endpoint.
 */
export function assertCanChangeStage(currentStage: string): void {
  if (isTerminalStage(currentStage)) {
    throw new ValidationFailedError({
      stage: ["Reopen this opportunity before changing its stage; it is currently won or lost"],
    });
  }
}

/**
 * The current probability is kept unless the caller sets `applyStageDefault`.
 * An explicit probability is used only when the stage default was not requested.
 */
export function resolveProbability(
  currentProbability: number,
  nextStage: OpportunityStageValue,
  requested: number | undefined,
  applyStageDefault: boolean | undefined,
): number {
  if (applyStageDefault) {
    return defaultProbabilityForStage(nextStage);
  }
  if (requested !== undefined) {
    return requested;
  }
  return currentProbability;
}

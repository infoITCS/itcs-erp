/** Inclusive date ranges overlap when startA <= endB and startB <= endA. Null expiry means open-ended. */
export function dateRangesOverlap(
  startA: string,
  endA: string | null | undefined,
  startB: string,
  endB: string | null | undefined,
): boolean {
  const aEnd = endA ?? "9999-12-31";
  const bEnd = endB ?? "9999-12-31";
  return startA <= bEnd && startB <= aEnd;
}

export function toDateOnly(value: Date | string): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

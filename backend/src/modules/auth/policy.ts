export const MAX_FAILED_LOGINS = 5;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export function refreshTtlToMs(ttl: string): number {
  const match = /^(\d+)([mhd])$/.exec(ttl);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === "m") {
    return amount * 60 * 1000;
  }
  if (unit === "h") {
    return amount * 60 * 60 * 1000;
  }
  return amount * 24 * 60 * 60 * 1000;
}

/** Removes null bytes from plain-text input. Rich text is sanitized at the service that stores it. */
export function sanitizePlainText(value: string): string {
  return value.replace(/\0/g, "").trim();
}

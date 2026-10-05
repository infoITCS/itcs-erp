export function contactDisplayName(firstName: string, lastName: string, displayName?: string): string {
  const provided = displayName?.trim();
  if (provided) {
    return provided;
  }
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

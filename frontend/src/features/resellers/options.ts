const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export interface SelectOption {
  code: string;
  name: string;
}

export function countrySelectOptions(codes: string[], selected: Array<string | undefined>): SelectOption[] {
  const values = new Set<string>(codes.map((code) => code.trim().toUpperCase()));
  for (const value of selected) {
    if (value?.trim()) {
      values.add(value.trim().toUpperCase());
    }
  }
  return [...values]
    .map((code) => ({ code, name: regionNames.of(code) ?? code }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function codeSelectOptions(options: SelectOption[], selected?: string): SelectOption[] {
  if (!selected?.trim()) {
    return options;
  }
  const code = selected.trim().toUpperCase();
  if (options.some((option) => option.code === code)) {
    return options;
  }
  return [{ code, name: `${code} (inactive)` }, ...options];
}

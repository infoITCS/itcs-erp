export const queryKeys = {
  health: ["health"] as const,
  list: (moduleName: string, params: Record<string, unknown>) => [moduleName, "list", params] as const,
};

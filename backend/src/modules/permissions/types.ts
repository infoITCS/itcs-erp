export const PERMISSIONS_MODULE = "permissions" as const;

/** Canonical permission code: `module:action`, for example `invoices:approve`. */
export function permissionCode(moduleName: string, action: string): string {
  return `${moduleName}:${action}`;
}

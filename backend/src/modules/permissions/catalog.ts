import { permissionCode } from "./types";

export const PHASE1_PERMISSIONS = [
  { module: "organizations", action: "read", description: "View organizations" },
  { module: "users", action: "read", description: "View users" },
  { module: "users", action: "create", description: "Create users" },
  { module: "users", action: "update", description: "Update users and account status" },
  { module: "roles", action: "read", description: "View roles" },
  { module: "permissions", action: "read", description: "View the permission catalog" },
  { module: "audit-logs", action: "read", description: "View the audit log" },
  { module: "currencies", action: "read", description: "View currencies and exchange rates" },
  { module: "currencies", action: "manage", description: "Add exchange rates" },
  { module: "document-sequences", action: "read", description: "View document number sequences" },
] as const;

export const PHASE1_PERMISSION_CODES = PHASE1_PERMISSIONS.map((permission) =>
  permissionCode(permission.module, permission.action),
);

export const VIEWER_PERMISSION_CODES = PHASE1_PERMISSION_CODES.filter((code) => code.endsWith(":read"));

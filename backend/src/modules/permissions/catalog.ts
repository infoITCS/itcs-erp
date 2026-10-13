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
  { module: "customers", action: "read", description: "View customers and their contacts" },
  { module: "customers", action: "create", description: "Create customers" },
  { module: "customers", action: "update", description: "Update customers and addresses" },
  { module: "customers", action: "delete", description: "Delete customers and permanently remove deleted customers" },
  { module: "customers", action: "restore", description: "Restore soft-deleted customers" },
  { module: "contacts", action: "create", description: "Create contacts" },
  { module: "contacts", action: "update", description: "Update contacts and the primary contact" },
  { module: "contacts", action: "delete", description: "Soft-delete contacts" },
  { module: "contacts", action: "restore", description: "Restore soft-deleted contacts" },
  { module: "products", action: "read", description: "View products, categories, prices, UOMs, and tax codes" },
  { module: "products", action: "create", description: "Create products and categories" },
  { module: "products", action: "update", description: "Update products, categories, and prices" },
  { module: "products", action: "delete", description: "Soft-delete products and categories" },
  { module: "products", action: "restore", description: "Restore soft-deleted products" },
  { module: "resellers", action: "read", description: "View resellers, addresses, contacts, and linked customers" },
  { module: "resellers", action: "create", description: "Create resellers" },
  { module: "resellers", action: "update", description: "Update resellers, addresses, contacts, and customer assignments" },
  { module: "resellers", action: "delete", description: "Soft-delete resellers" },
  { module: "resellers", action: "restore", description: "Restore soft-deleted resellers" },
] as const;

export const PHASE1_PERMISSION_CODES = PHASE1_PERMISSIONS.map((permission) =>
  permissionCode(permission.module, permission.action),
);

export const VIEWER_PERMISSION_CODES = PHASE1_PERMISSION_CODES.filter((code) => code.endsWith(":read"));

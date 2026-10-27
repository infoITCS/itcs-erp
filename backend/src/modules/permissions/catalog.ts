import { permissionCode } from "./types";

export type PermissionAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "restore"
  | "approve"
  | "manage"
  | "export";

export interface PermissionModuleDefinition {
  name: string;
  group: string;
  description: string;
  sortOrder: number;
}

export interface PermissionDefinition {
  module: string;
  action: PermissionAction;
  description: string;
}

export interface RolePreset {
  code: string;
  name: string;
  description: string;
  permissions: string[];
}

export const PERMISSION_MODULES = {
  dashboard: {
    name: "Dashboard",
    group: "Overview",
    description: "Company performance and operational summaries",
    sortOrder: 10,
  },
  customers: {
    name: "Customers",
    group: "CRM",
    description: "Customer accounts, addresses, notes, and documents",
    sortOrder: 20,
  },
  contacts: {
    name: "Contacts",
    group: "CRM",
    description: "Customer and reseller contact records",
    sortOrder: 21,
  },
  opportunities: {
    name: "Opportunities",
    group: "CRM",
    description: "Sales pipeline, stages, and product interests",
    sortOrder: 22,
  },
  resellers: {
    name: "Resellers",
    group: "CRM",
    description: "Reseller accounts and customer assignments",
    sortOrder: 23,
  },
  tenders: {
    name: "Tenders",
    group: "CRM",
    description: "Tender submissions, deadlines, and outcomes",
    sortOrder: 24,
  },
  quotes: {
    name: "Quotes",
    group: "Sales",
    description: "Commercial quotations and approval workflow",
    sortOrder: 30,
  },
  "sales-orders": {
    name: "Sales orders",
    group: "Sales",
    description: "Customer orders and fulfillment status",
    sortOrder: 31,
  },
  deliveries: {
    name: "Deliveries",
    group: "Sales",
    description: "Delivery notes, dispatch, and receipt tracking",
    sortOrder: 32,
  },
  invoices: {
    name: "Invoices",
    group: "Sales",
    description: "Customer invoices, credit notes, and approvals",
    sortOrder: 33,
  },
  payments: {
    name: "Payments",
    group: "Sales",
    description: "Customer receipts and payment allocation",
    sortOrder: 34,
  },
  products: {
    name: "Products",
    group: "Supply chain",
    description: "Products, categories, price lists, UOMs, and tax codes",
    sortOrder: 40,
  },
  purchasing: {
    name: "Purchasing",
    group: "Supply chain",
    description: "Purchase requests, orders, and supplier approvals",
    sortOrder: 41,
  },
  vendors: {
    name: "Vendors",
    group: "Supply chain",
    description: "Supplier accounts and commercial terms",
    sortOrder: 42,
  },
  inventory: {
    name: "Inventory",
    group: "Supply chain",
    description: "Stock levels, adjustments, and availability",
    sortOrder: 43,
  },
  accounting: {
    name: "Accounting",
    group: "Finance",
    description: "Accounting categories, ledgers, and reconciliations",
    sortOrder: 50,
  },
  expenses: {
    name: "Expenses",
    group: "Finance",
    description: "Operating expenses, claims, and approvals",
    sortOrder: 51,
  },
  currencies: {
    name: "Currencies",
    group: "Finance",
    description: "Currencies and exchange rates",
    sortOrder: 52,
  },
  projects: {
    name: "Projects",
    group: "Delivery",
    description: "Customer projects and implementation work",
    sortOrder: 60,
  },
  tasks: {
    name: "Tasks",
    group: "Delivery",
    description: "Project and operational work items",
    sortOrder: 61,
  },
  renewals: {
    name: "Renewals",
    group: "Delivery",
    description: "Contract renewals and subscription expiries",
    sortOrder: 62,
  },
  reports: {
    name: "Reports",
    group: "Insights",
    description: "Operational and financial reporting",
    sortOrder: 70,
  },
  notifications: {
    name: "Notifications",
    group: "Insights",
    description: "In-app alerts and notification preferences",
    sortOrder: 71,
  },
  users: {
    name: "Users",
    group: "Administration",
    description: "User accounts, access, and account status",
    sortOrder: 80,
  },
  roles: {
    name: "Roles",
    group: "Administration",
    description: "Role definitions and permission assignments",
    sortOrder: 81,
  },
  permissions: {
    name: "Permissions",
    group: "Administration",
    description: "Permission catalog used by access control",
    sortOrder: 82,
  },
  "audit-logs": {
    name: "Audit logs",
    group: "Administration",
    description: "Security and business activity history",
    sortOrder: 83,
  },
  organizations: {
    name: "Organization",
    group: "Administration",
    description: "Company profile and organization settings",
    sortOrder: 84,
  },
  "document-sequences": {
    name: "Document sequences",
    group: "Administration",
    description: "Document numbering prefixes and counters",
    sortOrder: 85,
  },
  settings: {
    name: "Settings",
    group: "Administration",
    description: "Workspace preferences and system configuration",
    sortOrder: 86,
  },
} as const satisfies Record<string, PermissionModuleDefinition>;

export type PermissionModule = keyof typeof PERMISSION_MODULES;

export const PERMISSION_ACTION_META: Record<
  PermissionAction,
  { label: string; description: string; risk: "standard" | "sensitive" | "critical"; sortOrder: number }
> = {
  read: { label: "View", description: "View", risk: "standard", sortOrder: 10 },
  create: { label: "Add", description: "Create", risk: "standard", sortOrder: 20 },
  update: { label: "Edit", description: "Edit", risk: "standard", sortOrder: 30 },
  delete: { label: "Delete", description: "Delete", risk: "sensitive", sortOrder: 40 },
  restore: { label: "Restore", description: "Restore", risk: "sensitive", sortOrder: 50 },
  approve: { label: "Approve", description: "Approve", risk: "critical", sortOrder: 60 },
  manage: { label: "Manage", description: "Manage", risk: "critical", sortOrder: 70 },
  export: { label: "Export", description: "Export", risk: "sensitive", sortOrder: 80 },
};

function definePermissions(
  module: PermissionModule,
  actions: readonly PermissionAction[],
): PermissionDefinition[] {
  const moduleName = PERMISSION_MODULES[module].name.toLowerCase();
  return actions.map((action) => ({
    module,
    action,
    description: `${PERMISSION_ACTION_META[action].description} ${moduleName}`,
  }));
}

const standardActions = ["read", "create", "update", "delete", "restore"] as const;
const documentActions = ["read", "create", "update", "delete", "restore", "approve"] as const;

export const ERP_PERMISSIONS: PermissionDefinition[] = [
  ...definePermissions("dashboard", ["read"]),
  ...definePermissions("customers", standardActions),
  ...definePermissions("contacts", standardActions),
  ...definePermissions("opportunities", standardActions),
  ...definePermissions("resellers", standardActions),
  ...definePermissions("tenders", standardActions),
  ...definePermissions("quotes", documentActions),
  ...definePermissions("sales-orders", documentActions),
  ...definePermissions("deliveries", ["read", "create", "update", "delete"]),
  ...definePermissions("invoices", documentActions),
  ...definePermissions("payments", ["read", "create", "update", "delete"]),
  ...definePermissions("products", standardActions),
  ...definePermissions("purchasing", ["read", "create", "update", "delete", "approve"]),
  ...definePermissions("vendors", ["read", "create", "update", "delete"]),
  ...definePermissions("inventory", ["read", "create", "update", "delete", "manage"]),
  ...definePermissions("accounting", ["read", "create", "update", "delete", "manage"]),
  ...definePermissions("expenses", ["read", "create", "update", "delete", "approve"]),
  ...definePermissions("currencies", ["read", "manage"]),
  ...definePermissions("projects", ["read", "create", "update", "delete"]),
  ...definePermissions("tasks", ["read", "create", "update", "delete"]),
  ...definePermissions("renewals", ["read", "create", "update", "delete"]),
  ...definePermissions("reports", ["read", "export"]),
  ...definePermissions("notifications", ["read", "manage"]),
  ...definePermissions("users", ["read", "create", "update", "delete"]),
  ...definePermissions("roles", ["read", "create", "update", "delete"]),
  ...definePermissions("permissions", ["read"]),
  ...definePermissions("audit-logs", ["read"]),
  ...definePermissions("organizations", ["read", "update"]),
  ...definePermissions("document-sequences", ["read", "manage"]),
  ...definePermissions("settings", ["read", "update"]),
];

export const ERP_PERMISSION_CODES = ERP_PERMISSIONS.map((permission) =>
  permissionCode(permission.module, permission.action),
);

export const ADMIN_PERMISSION_CODES = [...ERP_PERMISSION_CODES];

export const READ_PERMISSION_CODES = ERP_PERMISSION_CODES.filter((code) => code.endsWith(":read"));

export const PERMISSION_BY_CODE = new Map(
  ERP_PERMISSIONS.map((permission) => [
    permissionCode(permission.module, permission.action),
    permission,
  ]),
);

export const PERMISSION_GROUPS = [...new Set(Object.values(PERMISSION_MODULES).map((module) => module.group))];

function uniqueCodes(codes: readonly string[]): string[] {
  return [...new Set(codes)];
}

function codesFor(
  entries: Partial<Record<PermissionModule, readonly PermissionAction[]>>,
): string[] {
  return uniqueCodes(
    Object.entries(entries).flatMap(([module, actions]) =>
      (actions ?? []).map((action) => permissionCode(module, action)),
    ),
  );
}

const crmBasic = codesFor({
  customers: ["read", "create", "update"],
  contacts: ["read", "create", "update"],
  opportunities: ["read", "create", "update"],
  resellers: ["read", "create", "update"],
  tenders: ["read", "create", "update"],
});

const salesBasic = codesFor({
  quotes: ["read", "create", "update"],
  "sales-orders": ["read", "create", "update"],
  deliveries: ["read"],
  invoices: ["read"],
  payments: ["read"],
  products: ["read"],
  reports: ["read"],
});

export const ROLE_PRESETS: RolePreset[] = [
  {
    code: "admin",
    name: "Administrator",
    description: "Unrestricted access to every module and action.",
    permissions: [...ERP_PERMISSION_CODES],
  },
  {
    code: "executive",
    name: "Executive",
    description: "Company-wide visibility with high-level approvals and report exports.",
    permissions: uniqueCodes([
      ...READ_PERMISSION_CODES,
      "reports:export",
      "quotes:approve",
      "sales-orders:approve",
      "invoices:approve",
      "purchasing:approve",
      "expenses:approve",
    ]),
  },
  {
    code: "operations-manager",
    name: "Operations Manager",
    description: "Runs day-to-day CRM, sales, procurement, inventory, and delivery operations.",
    permissions: uniqueCodes([
      ...READ_PERMISSION_CODES,
      ...codesFor({
        customers: standardActions,
        contacts: standardActions,
        opportunities: standardActions,
        resellers: standardActions,
        tenders: standardActions,
        quotes: ["read", "create", "update", "delete", "restore"],
        "sales-orders": ["read", "create", "update", "delete", "restore"],
        deliveries: ["read", "create", "update", "delete"],
        invoices: ["read", "create", "update", "restore"],
        payments: ["read", "create", "update"],
        products: standardActions,
        purchasing: ["read", "create", "update", "delete"],
        vendors: ["read", "create", "update", "delete"],
        inventory: ["read", "create", "update", "delete", "manage"],
        projects: ["read", "create", "update", "delete"],
        tasks: ["read", "create", "update", "delete"],
        renewals: ["read", "create", "update", "delete"],
        reports: ["read", "export"],
      }),
    ]),
  },
  {
    code: "sales-manager",
    name: "Sales Manager",
    description: "Manages the sales pipeline, quotations, orders, and customer relationships.",
    permissions: uniqueCodes([
      ...codesFor({
        customers: standardActions,
        contacts: standardActions,
        opportunities: standardActions,
        resellers: standardActions,
        tenders: standardActions,
        quotes: standardActions,
        "sales-orders": standardActions,
        deliveries: ["read", "create", "update"],
        invoices: ["read", "create", "update"],
        payments: ["read"],
        products: ["read"],
        reports: ["read", "export"],
      }),
      "dashboard:read",
    ]),
  },
  {
    code: "sales-executive",
    name: "Sales Executive",
    description: "Creates and maintains customer records, opportunities, quotes, and orders.",
    permissions: uniqueCodes([...crmBasic, ...salesBasic, "dashboard:read"]),
  },
  {
    code: "business-development",
    name: "Business Development",
    description: "Develops customer relationships, opportunities, resellers, and tenders.",
    permissions: uniqueCodes([
      ...codesFor({
        customers: ["read", "create", "update"],
        contacts: ["read", "create", "update"],
        opportunities: ["read", "create", "update"],
        resellers: ["read", "create", "update"],
        tenders: ["read", "create", "update"],
        quotes: ["read"],
        reports: ["read"],
      }),
      "dashboard:read",
    ]),
  },
  {
    code: "tender-manager",
    name: "Tender Manager",
    description: "Owns tender submissions, bid deadlines, and related customer records.",
    permissions: uniqueCodes([
      ...codesFor({
        customers: ["read"],
        contacts: ["read"],
        products: ["read"],
        tenders: standardActions,
        quotes: ["read", "create", "update"],
        reports: ["read", "export"],
      }),
      "dashboard:read",
    ]),
  },
  {
    code: "procurement-manager",
    name: "Procurement Manager",
    description: "Manages vendors, purchasing, approvals, and supplier performance.",
    permissions: uniqueCodes([
      ...codesFor({
        vendors: ["read", "create", "update", "delete"],
        purchasing: ["read", "create", "update", "delete", "approve"],
        products: ["read"],
        inventory: ["read"],
        reports: ["read", "export"],
      }),
      "dashboard:read",
    ]),
  },
  {
    code: "procurement-officer",
    name: "Procurement Officer",
    description: "Maintains vendors and purchase requests without approval authority.",
    permissions: uniqueCodes([
      ...codesFor({
        vendors: ["read", "create", "update"],
        purchasing: ["read", "create", "update"],
        products: ["read"],
        inventory: ["read"],
      }),
      "dashboard:read",
    ]),
  },
  {
    code: "inventory-manager",
    name: "Inventory Manager",
    description: "Controls product stock, adjustments, availability, and delivery updates.",
    permissions: uniqueCodes([
      ...codesFor({
        products: standardActions,
        inventory: ["read", "create", "update", "delete", "manage"],
        deliveries: ["read", "update"],
        purchasing: ["read"],
        reports: ["read"],
      }),
      "dashboard:read",
    ]),
  },
  {
    code: "finance-manager",
    name: "Finance Manager",
    description: "Owns invoicing, payments, accounting, expenses, and financial approvals.",
    permissions: uniqueCodes([
      ...codesFor({
        invoices: documentActions,
        payments: ["read", "create", "update", "delete"],
        accounting: ["read", "create", "update", "delete", "manage"],
        expenses: ["read", "create", "update", "delete", "approve"],
        currencies: ["read", "manage"],
        customers: ["read"],
        "sales-orders": ["read"],
        purchasing: ["read"],
        reports: ["read", "export"],
      }),
      "dashboard:read",
    ]),
  },
  {
    code: "accountant",
    name: "Accountant",
    description: "Maintains invoices, payments, accounting entries, and expense records.",
    permissions: uniqueCodes([
      ...codesFor({
        invoices: ["read", "create", "update"],
        payments: ["read", "create", "update"],
        accounting: ["read", "create", "update"],
        expenses: ["read", "create", "update"],
        currencies: ["read"],
        reports: ["read"],
      }),
      "dashboard:read",
    ]),
  },
  {
    code: "project-manager",
    name: "Project Manager",
    description: "Delivers customer projects, tasks, and delivery milestones.",
    permissions: uniqueCodes([
      ...codesFor({
        customers: ["read"],
        contacts: ["read"],
        projects: ["read", "create", "update", "delete"],
        tasks: ["read", "create", "update", "delete"],
        deliveries: ["read", "create", "update", "delete"],
        reports: ["read"],
      }),
      "dashboard:read",
    ]),
  },
  {
    code: "support-agent",
    name: "Support Agent",
    description: "Supports customers with contact updates, tasks, and notifications.",
    permissions: uniqueCodes([
      ...codesFor({
        customers: ["read", "update"],
        contacts: ["read", "create", "update"],
        tasks: ["read", "create", "update"],
        notifications: ["read"],
        reports: ["read"],
      }),
      "dashboard:read",
    ]),
  },
  {
    code: "auditor",
    name: "Auditor",
    description: "Read-only access across the business with audit and report visibility.",
    permissions: uniqueCodes([...READ_PERMISSION_CODES, "reports:export"]),
  },
  {
    code: "viewer",
    name: "Viewer",
    description: "Read-only access to every ERP module.",
    permissions: [...READ_PERMISSION_CODES],
  },
];

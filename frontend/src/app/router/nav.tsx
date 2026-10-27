import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export interface NavItem {
  path: string;
  label: string;
  group: string;
  permission?: string;
  page: LazyExoticComponent<ComponentType>;
}

export const navItems: NavItem[] = [
  {
    path: "/",
    label: "Dashboard",
    group: "Overview",
    page: lazy(() => import("@/features/dashboard/index.tsx")),
  },
  {
    path: "/customers",
    label: "Customers",
    group: "CRM",
    permission: "customers:read",
    page: lazy(() => import("@/features/customers/index.tsx")),
  },
  {
    path: "/contacts",
    label: "Contacts",
    group: "CRM",
    permission: "contacts:read",
    page: lazy(() => import("@/features/contacts/index.tsx")),
  },
  {
    path: "/opportunities",
    label: "Opportunities",
    group: "CRM",
    permission: "opportunities:read",
    page: lazy(() => import("@/features/opportunities/index.tsx")),
  },
  {
    path: "/resellers",
    label: "Resellers",
    group: "CRM",
    permission: "resellers:read",
    page: lazy(() => import("@/features/resellers/index.tsx")),
  },
  {
    path: "/tenders",
    label: "Tenders",
    group: "CRM",
    permission: "tenders:read",
    page: lazy(() => import("@/features/tenders/index.tsx")),
  },
  {
    path: "/sales",
    label: "Sales",
    group: "Sales",
    page: lazy(() => import("@/features/sales/index.tsx")),
  },
  {
    path: "/quotes",
    label: "Quotes",
    group: "Sales",
    permission: "quotes:read",
    page: lazy(() => import("@/features/quotes/index.tsx")),
  },
  {
    path: "/sales-orders",
    label: "Sales Orders",
    group: "Sales",
    permission: "sales-orders:read",
    page: lazy(() => import("@/features/sales-orders/index.tsx")),
  },
  {
    path: "/invoices",
    label: "Invoices",
    group: "Sales",
    permission: "invoices:read",
    page: lazy(() => import("@/features/invoices/index.tsx")),
  },
  {
    path: "/payments",
    label: "Payments",
    group: "Sales",
    permission: "payments:read",
    page: lazy(() => import("@/features/payments/index.tsx")),
  },
  {
    path: "/products",
    label: "Products",
    group: "Supply",
    permission: "products:read",
    page: lazy(() => import("@/features/products/index.tsx")),
  },
  {
    path: "/purchasing",
    label: "Purchasing",
    group: "Supply",
    permission: "purchasing:read",
    page: lazy(() => import("@/features/purchasing/index.tsx")),
  },
  {
    path: "/vendors",
    label: "Vendors",
    group: "Supply",
    permission: "vendors:read",
    page: lazy(() => import("@/features/vendors/index.tsx")),
  },
  {
    path: "/inventory",
    label: "Inventory",
    group: "Supply",
    permission: "inventory:read",
    page: lazy(() => import("@/features/inventory/index.tsx")),
  },
  {
    path: "/accounting",
    label: "Accounting",
    group: "Finance",
    permission: "accounting:read",
    page: lazy(() => import("@/features/accounting/index.tsx")),
  },
  {
    path: "/expenses",
    label: "Expenses",
    group: "Finance",
    permission: "expenses:read",
    page: lazy(() => import("@/features/expenses/index.tsx")),
  },
  {
    path: "/projects",
    label: "Projects",
    group: "Delivery",
    permission: "projects:read",
    page: lazy(() => import("@/features/projects/index.tsx")),
  },
  {
    path: "/tasks",
    label: "Tasks",
    group: "Delivery",
    permission: "tasks:read",
    page: lazy(() => import("@/features/tasks/index.tsx")),
  },
  {
    path: "/renewals",
    label: "Renewals",
    group: "Delivery",
    permission: "renewals:read",
    page: lazy(() => import("@/features/renewals/index.tsx")),
  },
  {
    path: "/reports",
    label: "Reports",
    group: "System",
    permission: "reports:read",
    page: lazy(() => import("@/features/reports/index.tsx")),
  },
  {
    path: "/notifications",
    label: "Notifications",
    group: "System",
    permission: "notifications:read",
    page: lazy(() => import("@/features/notifications/index.tsx")),
  },
  {
    path: "/users",
    label: "Users",
    group: "System",
    permission: "users:read",
    page: lazy(() => import("@/features/users/index.tsx")),
  },
  {
    path: "/roles",
    label: "Roles & access",
    group: "System",
    permission: "roles:read",
    page: lazy(() => import("@/features/roles/index.tsx")),
  },
  {
    path: "/settings",
    label: "Settings",
    group: "System",
    permission: "settings:read",
    page: lazy(() => import("@/features/settings/index.tsx")),
  },
];

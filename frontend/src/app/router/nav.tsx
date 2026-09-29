import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export interface NavItem {
  path: string;
  label: string;
  group: string;
  page: LazyExoticComponent<ComponentType>;
}

export const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", group: "Overview", page: lazy(() => import("@/features/dashboard/index.tsx")) },
  { path: "/customers", label: "Customers", group: "CRM", page: lazy(() => import("@/features/customers/index.tsx")) },
  { path: "/contacts", label: "Contacts", group: "CRM", page: lazy(() => import("@/features/contacts/index.tsx")) },
  { path: "/opportunities", label: "Opportunities", group: "CRM", page: lazy(() => import("@/features/opportunities/index.tsx")) },
  { path: "/resellers", label: "Resellers", group: "CRM", page: lazy(() => import("@/features/resellers/index.tsx")) },
  { path: "/tenders", label: "Tenders", group: "CRM", page: lazy(() => import("@/features/tenders/index.tsx")) },
  { path: "/sales", label: "Sales", group: "Sales", page: lazy(() => import("@/features/sales/index.tsx")) },
  { path: "/quotes", label: "Quotes", group: "Sales", page: lazy(() => import("@/features/quotes/index.tsx")) },
  { path: "/sales-orders", label: "Sales Orders", group: "Sales", page: lazy(() => import("@/features/sales-orders/index.tsx")) },
  { path: "/invoices", label: "Invoices", group: "Sales", page: lazy(() => import("@/features/invoices/index.tsx")) },
  { path: "/payments", label: "Payments", group: "Sales", page: lazy(() => import("@/features/payments/index.tsx")) },
  { path: "/products", label: "Products", group: "Supply", page: lazy(() => import("@/features/products/index.tsx")) },
  { path: "/purchasing", label: "Purchasing", group: "Supply", page: lazy(() => import("@/features/purchasing/index.tsx")) },
  { path: "/vendors", label: "Vendors", group: "Supply", page: lazy(() => import("@/features/vendors/index.tsx")) },
  { path: "/inventory", label: "Inventory", group: "Supply", page: lazy(() => import("@/features/inventory/index.tsx")) },
  { path: "/accounting", label: "Accounting", group: "Finance", page: lazy(() => import("@/features/accounting/index.tsx")) },
  { path: "/expenses", label: "Expenses", group: "Finance", page: lazy(() => import("@/features/expenses/index.tsx")) },
  { path: "/projects", label: "Projects", group: "Delivery", page: lazy(() => import("@/features/projects/index.tsx")) },
  { path: "/tasks", label: "Tasks", group: "Delivery", page: lazy(() => import("@/features/tasks/index.tsx")) },
  { path: "/renewals", label: "Renewals", group: "Delivery", page: lazy(() => import("@/features/renewals/index.tsx")) },
  { path: "/reports", label: "Reports", group: "System", page: lazy(() => import("@/features/reports/index.tsx")) },
  { path: "/notifications", label: "Notifications", group: "System", page: lazy(() => import("@/features/notifications/index.tsx")) },
  { path: "/users", label: "Users", group: "System", page: lazy(() => import("@/features/users/index.tsx")) },
  { path: "/settings", label: "Settings", group: "System", page: lazy(() => import("@/features/settings/index.tsx")) },
];

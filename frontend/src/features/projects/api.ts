import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export const PROJECT_STATUSES = ["PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_INITIAL_STATUSES: ProjectStatus[] = ["PLANNED", "IN_PROGRESS"];

export interface ProjectCustomerRef {
  id: string;
  customerNumber: string;
  displayName: string;
  email: string | null;
  currencyCode: string;
}

export interface ProjectContactRef {
  id: string;
  customerId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
}

export interface ProjectOwnerRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ProjectCurrencyRef {
  code: string;
  name: string;
}

export interface ProjectFinancials {
  income: string;
  cost: string;
  profit: string;
  marginPercent: string;
  currencyCode: string;
  source: "live";
  breakdown: {
    invoiceTotal: string;
    paymentsReceived: string;
    outstanding: string;
    quoteTotal: string;
    salesOrderTotal: string;
    expenseTotal: string;
    billTotal: string;
    invoiceCount: number;
    paymentCount: number;
  };
}

export interface Project {
  id: string;
  organizationId: string;
  projectNumber: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  customerId: string | null;
  contactId: string | null;
  ownerUserId: string | null;
  invoiceId: string | null;
  customerContactName: string | null;
  customerContactEmail: string | null;
  customerContactPhone: string | null;
  supplierCompany: string | null;
  supplierContactName: string | null;
  supplierContactEmail: string | null;
  supplierContactPhone: string | null;
  currencyCode: string;
  startDate: string | null;
  dueDate: string | null;
  notes: string | null;
  createdById: string;
  updatedById: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFormOptions {
  customers: ProjectCustomerRef[];
  contacts: ProjectContactRef[];
  owners: ProjectOwnerRef[];
  currencies: ProjectCurrencyRef[];
  statuses: ProjectStatus[];
}

export interface Page<T> {
  items: T[];
  pageInfo: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}

export interface ProjectListParams {
  q?: string;
  status?: ProjectStatus;
  customerId?: string;
  ownerUserId?: string;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
  cursor?: string;
  limit?: number;
  sort?: "createdAt" | "name" | "projectNumber";
  order?: "asc" | "desc";
}

export interface ProjectCreateWrite {
  name: string;
  description?: string;
  status?: ProjectStatus;
  customerId?: string;
  contactId?: string;
  ownerUserId?: string;
  customerContactName?: string;
  customerContactEmail?: string;
  customerContactPhone?: string;
  supplierCompany?: string;
  supplierContactName?: string;
  supplierContactEmail?: string;
  supplierContactPhone?: string;
  currencyCode?: string;
  startDate?: string;
  dueDate?: string;
  notes?: string;
}

export interface ProjectUpdateWrite {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  customerId?: string | null;
  contactId?: string | null;
  ownerUserId?: string | null;
  invoiceId?: string | null;
  customerContactName?: string | null;
  customerContactEmail?: string | null;
  customerContactPhone?: string | null;
  supplierCompany?: string | null;
  supplierContactName?: string | null;
  supplierContactEmail?: string | null;
  supplierContactPhone?: string | null;
  currencyCode?: string;
  startDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
}

export const PROJECT_ACTIVITY_KINDS = [
  "lead",
  "opportunity",
  "tender",
  "quote",
  "salesOrder",
  "invoice",
  "payment",
  "contact",
] as const;
export type ProjectActivityKind = (typeof PROJECT_ACTIVITY_KINDS)[number];

export interface ProjectActivityItem {
  id: string;
  kind: ProjectActivityKind;
  number: string;
  title: string;
  status: string;
  date: string;
  amount: string;
  currencyCode: string;
  href: string | null;
  meta: string;
  linkedToProject: boolean;
}

export interface ProjectActivityGroup {
  kind: ProjectActivityKind;
  label: string;
  permission: string;
  available: boolean;
  count: number;
  total: string;
  currencyCode: string;
  listHref: string;
  items: ProjectActivityItem[];
}

export interface ProjectInvoiceSummary {
  total: string;
  paid: string;
  balance: string;
  count: number;
  draft: number;
  sent: number;
  partiallyPaid: number;
  paidCount: number;
  overdue: number;
  void: number;
  open: number;
}

export interface ProjectActivity {
  customer: {
    id: string;
    customerNumber: string;
    displayName: string;
    email: string | null;
    currencyCode: string;
  } | null;
  generatedAt: string;
  currencyCode: string;
  groups: Record<ProjectActivityKind, ProjectActivityGroup>;
  timeline: ProjectActivityItem[];
  invoiceSummary: ProjectInvoiceSummary;
  financials: ProjectFinancials;
  upcomingModules: { kind: string; label: string; available: boolean }[];
}

export interface AuditEvent {
  id: string;
  action: string;
  module: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

function data<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data as T);
}

export function listProjects(params: Record<string, string | number | boolean | undefined>): Promise<Page<Project>> {
  return data(http.get<ApiSuccess<Page<Project>>>("/api/v1/projects", { params }));
}

export function getProjectFormOptions(): Promise<ProjectFormOptions> {
  return data(http.get<ApiSuccess<ProjectFormOptions>>("/api/v1/projects/form-options"));
}

export function getProject(id: string): Promise<Project> {
  return data(http.get<ApiSuccess<Project>>(`/api/v1/projects/${id}`));
}

export function getProjectFinancials(id: string): Promise<ProjectFinancials> {
  return data(http.get<ApiSuccess<ProjectFinancials>>(`/api/v1/projects/${id}/financials`));
}

export function getProjectActivity(id: string): Promise<ProjectActivity> {
  return data(http.get<ApiSuccess<ProjectActivity>>(`/api/v1/projects/${id}/activity`));
}

export function createProject(body: ProjectCreateWrite): Promise<Project> {
  return data(http.post("/api/v1/projects", body));
}

export function updateProject(id: string, body: ProjectUpdateWrite): Promise<Project> {
  return data(http.patch(`/api/v1/projects/${id}`, body));
}

export function deleteProject(id: string): Promise<{ id: string; deletedAt: string }> {
  return data(http.delete(`/api/v1/projects/${id}`));
}

export function listProjectAudit(id: string): Promise<Page<AuditEvent>> {
  return data(http.get(`/api/v1/projects/${id}/audit`, { params: { limit: 20 } }));
}

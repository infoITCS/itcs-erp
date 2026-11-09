import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "UNQUALIFIED" | "CONVERTED" | "WON";
export type LeadSource =
  | "WEBSITE"
  | "REFERRAL"
  | "COLD_CALL"
  | "SOCIAL_MEDIA"
  | "ADVERTISEMENT"
  | "PARTNER"
  | "TENDER"
  | "OTHER";
export type LeadPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ComparisonPeriod = "30d" | "90d" | "12m" | "all";

export const LEAD_STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "UNQUALIFIED",
  "CONVERTED",
  "WON",
];

export const MANUAL_LEAD_STATUSES: LeadStatus[] = ["CONTACTED", "QUALIFIED", "UNQUALIFIED"];

export const LEAD_STATUS_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["CONTACTED", "QUALIFIED", "UNQUALIFIED"],
  CONTACTED: ["QUALIFIED", "UNQUALIFIED"],
  QUALIFIED: ["UNQUALIFIED"],
  UNQUALIFIED: ["CONTACTED", "QUALIFIED"],
  CONVERTED: [],
  WON: [],
};

export const LEAD_SOURCES: LeadSource[] = [
  "WEBSITE",
  "REFERRAL",
  "COLD_CALL",
  "SOCIAL_MEDIA",
  "ADVERTISEMENT",
  "PARTNER",
  "TENDER",
  "OTHER",
];

export const LEAD_PRIORITIES: LeadPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

export interface LeadOwnerRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface LeadCustomerRef {
  id: string;
  customerNumber: string;
  displayName: string;
  status: "ACTIVE" | "INACTIVE" | "HOLD";
}

export interface LeadContactRef {
  id: string;
  displayName: string;
  email: string | null;
}

export interface LeadOpportunityRef {
  id: string;
  opportunityNumber: string;
  title: string;
  stage: string;
  estimatedValue: string;
  currencyCode: string;
  wonAt: string | null;
  lostAt: string | null;
  closedAt: string | null;
}

export interface Lead {
  id: string;
  organizationId: string;
  leadNumber: string;
  firstName: string;
  lastName: string;
  displayName: string;
  companyName: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  countryCode: string;
  currencyCode: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  estimatedValue: string;
  ownerUserId: string;
  nextAction: string | null;
  nextActionDueAt: string | null;
  description: string | null;
  notes: string | null;
  qualifiedAt: string | null;
  unqualifiedAt: string | null;
  unqualifiedReason: string | null;
  convertedAt: string | null;
  wonAt: string | null;
  convertedCustomerId: string | null;
  convertedContactId: string | null;
  createdById: string;
  updatedById: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: LeadOwnerRef | null;
  convertedCustomer: LeadCustomerRef | null;
  convertedContact: LeadContactRef | null;
  opportunity: LeadOpportunityRef | null;
}

export interface LeadFormOptions {
  owners: LeadOwnerRef[];
  sources: LeadSource[];
  statuses: LeadStatus[];
  priorities: LeadPriority[];
}

export interface Page<T> {
  items: T[];
  pageInfo: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}

export interface LeadListParams {
  q?: string;
  status?: LeadStatus;
  source?: LeadSource;
  ownerUserId?: string;
  priority?: LeadPriority;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
  includeDeleted?: boolean;
  sort?: "createdAt" | "displayName" | "leadNumber" | "estimatedValue";
  order?: "asc" | "desc";
}

export interface LeadCreateWrite {
  firstName: string;
  lastName: string;
  displayName?: string;
  companyName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  countryCode: string;
  currencyCode: string;
  source: LeadSource;
  priority?: LeadPriority;
  estimatedValue?: string;
  ownerUserId?: string;
  nextAction?: string;
  nextActionDueAt?: string;
  description?: string;
  notes?: string;
}

export interface LeadUpdateWrite {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  companyName?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  countryCode?: string;
  currencyCode?: string;
  source?: LeadSource;
  priority?: LeadPriority;
  estimatedValue?: string;
  ownerUserId?: string;
  nextAction?: string | null;
  nextActionDueAt?: string | null;
  description?: string | null;
  notes?: string | null;
}

export interface ChangeLeadStatusWrite {
  status: LeadStatus;
  unqualifiedReason?: string;
  nextAction?: string;
  nextActionDueAt?: string;
}

export interface ConvertOpportunityWrite {
  title: string;
  description?: string;
  estimatedValue?: string;
  currencyCode?: string;
  expectedCloseDate?: string;
  ownerUserId?: string;
  nextAction?: string;
  nextActionDueAt?: string;
  notes?: string;
}

export interface ConvertAccountCustomerWrite {
  legalName: string;
  displayName?: string;
  customerType: "COMPANY" | "INDIVIDUAL" | "B2B" | "B2C" | "WHOLESALE";
  entityType: "COMPANY" | "INDIVIDUAL";
  email: string | null;
  phone: string | null;
  website: string | null;
  countryCode?: string;
  currencyCode?: string;
  contact?: {
    firstName: string;
    lastName: string;
    jobTitle?: string;
    email?: string;
    phone?: string;
  };
}

export type ConvertLeadWrite =
  | { mode: "ACCOUNT"; customer: ConvertAccountCustomerWrite; opportunity: ConvertOpportunityWrite }
  | {
      mode: "PROSPECT";
      opportunity: ConvertOpportunityWrite & {
        prospectDisplayName: string;
        prospectLegalName?: string;
        prospectEmail?: string;
        prospectPhone?: string;
        prospectCountryCode?: string;
      };
    };

export interface LeadAnalyticsSourceRow {
  source: string;
  leads: number;
  qualified: number;
  unqualified: number;
  converted: number;
  wonLeads: number;
  estimatedValue: number;
  opportunities: number;
  won: number;
  lost: number;
  openOpportunities: number;
  pipelineValueBase: number;
  wonValueBase: number;
  conversionRate: number;
  winRate: number;
}

export interface LeadAnalytics {
  period: ComparisonPeriod;
  baseCurrencyCode: string;
  generatedAt: string;
  totals: {
    leads: number;
    new: number;
    contacted: number;
    qualified: number;
    unqualified: number;
    converted: number;
    wonLeads: number;
    convertedOrWon: number;
    conversionRate: number;
    estimatedLeadValue: number;
    opportunities: number;
    openOpportunities: number;
    won: number;
    lost: number;
    winRate: number;
    pipelineValueBase: number;
    wonValueBase: number;
  };
  bySource: LeadAnalyticsSourceRow[];
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

export function listLeads(params: Record<string, string | number | boolean | undefined>): Promise<Page<Lead>> {
  return data(http.get<ApiSuccess<Page<Lead>>>("/api/v1/leads", { params }));
}

export function getLeadAnalytics(period: ComparisonPeriod): Promise<LeadAnalytics> {
  return data(http.get<ApiSuccess<LeadAnalytics>>("/api/v1/leads/analytics", { params: { period } }));
}

export function getLeadFormOptions(): Promise<LeadFormOptions> {
  return data(http.get<ApiSuccess<LeadFormOptions>>("/api/v1/leads/form-options"));
}

export function getLead(id: string): Promise<Lead> {
  return data(http.get<ApiSuccess<Lead>>(`/api/v1/leads/${id}`));
}

export function createLead(body: LeadCreateWrite): Promise<Lead> {
  return data(http.post("/api/v1/leads", body));
}

export function updateLead(id: string, body: LeadUpdateWrite): Promise<Lead> {
  return data(http.patch(`/api/v1/leads/${id}`, body));
}

export function deleteLead(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/leads/${id}`));
}

export function restoreLead(id: string): Promise<Lead> {
  return data(http.post(`/api/v1/leads/${id}/restore`));
}

export function changeLeadStatus(id: string, body: ChangeLeadStatusWrite): Promise<Lead> {
  return data(http.post(`/api/v1/leads/${id}/status`, body));
}

export function convertLead(id: string, body: ConvertLeadWrite): Promise<Lead> {
  return data(http.post(`/api/v1/leads/${id}/convert`, body));
}

export function listLeadAudit(id: string): Promise<Page<AuditEvent>> {
  return data(http.get(`/api/v1/leads/${id}/audit`, { params: { limit: 20 } }));
}

export function leadStatusLabel(status: string): string {
  return status
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

export function leadSourceLabel(source: string): string {
  return source
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatMoney(amount: string | number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${amount} ${currency}`;
  }
}

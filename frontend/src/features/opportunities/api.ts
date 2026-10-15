import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";
import type { CustomerWrite } from "@/features/customers/api.ts";

export type OpportunityStage =
  | "NEW"
  | "QUALIFICATION"
  | "NEEDS_ANALYSIS"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export const OPEN_STAGES: OpportunityStage[] = ["NEW", "QUALIFICATION", "NEEDS_ANALYSIS", "PROPOSAL", "NEGOTIATION"];
export const ALL_STAGES: OpportunityStage[] = [...OPEN_STAGES, "WON", "LOST"];

export type OpportunityLeadSource =
  | "WEBSITE"
  | "REFERRAL"
  | "COLD_CALL"
  | "SOCIAL_MEDIA"
  | "ADVERTISEMENT"
  | "PARTNER"
  | "TENDER"
  | "OTHER";

export const LEAD_SOURCES: OpportunityLeadSource[] = [
  "WEBSITE",
  "REFERRAL",
  "COLD_CALL",
  "SOCIAL_MEDIA",
  "ADVERTISEMENT",
  "PARTNER",
  "TENDER",
  "OTHER",
];

export type OpportunityLostReason =
  | "PRICE"
  | "COMPETITOR"
  | "NO_BUDGET"
  | "NO_DECISION"
  | "TIMING"
  | "SCOPE_MISMATCH"
  | "INTERNAL"
  | "OTHER";

export const LOST_REASONS: OpportunityLostReason[] = [
  "PRICE",
  "COMPETITOR",
  "NO_BUDGET",
  "NO_DECISION",
  "TIMING",
  "SCOPE_MISMATCH",
  "INTERNAL",
  "OTHER",
];

export interface OpportunityCustomerRef {
  id: string;
  customerNumber: string;
  displayName: string;
  status: "ACTIVE" | "INACTIVE" | "HOLD";
  email: string | null;
}

export interface OpportunityContactRef {
  id: string;
  displayName: string;
  email: string | null;
}

export interface OpportunityResellerRef {
  id: string;
  displayName: string;
}

export interface OpportunityOwnerRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Opportunity {
  id: string;
  opportunityNumber: string;
  title: string;
  description: string | null;
  stage: OpportunityStage;
  customerId: string | null;
  contactId: string | null;
  resellerId: string | null;
  ownerUserId: string;
  leadSource: OpportunityLeadSource | null;
  estimatedValue: string;
  currencyCode: string;
  exchangeRateToBase: string | null;
  estimatedValueBase: string | null;
  baseCurrencyCode: string | null;
  probabilityPercent: number;
  expectedCloseDate: string | null;
  nextAction: string | null;
  nextActionDueAt: string | null;
  lostReason: OpportunityLostReason | null;
  lostReasonDetail: string | null;
  competitorName: string | null;
  wonAt: string | null;
  lostAt: string | null;
  closedAt: string | null;
  reopenedAt: string | null;
  prospectDisplayName: string | null;
  prospectLegalName: string | null;
  prospectEmail: string | null;
  prospectPhone: string | null;
  prospectCountryCode: string | null;
  notes: string | null;
  createdById: string;
  updatedById: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: OpportunityCustomerRef | null;
  contact: OpportunityContactRef | null;
  reseller: OpportunityResellerRef | null;
  owner: OpportunityOwnerRef | null;
}

export interface OpportunityProductInterest {
  id: string;
  organizationId: string;
  opportunityId: string;
  productId: string;
  quantity: string;
  estimatedUnitAmount: string | null;
  productCode: string;
  productName: string;
  notes: string | null;
  sortOrder: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityFormOptions {
  owners: OpportunityOwnerRef[];
  resellers: OpportunityResellerRef[];
  leadSources: OpportunityLeadSource[];
  lostReasons: OpportunityLostReason[];
  stages: OpportunityStage[];
}

export interface Page<T> {
  items: T[];
  pageInfo: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}

export interface OpportunityListParams {
  q?: string;
  stage?: OpportunityStage;
  customerId?: string;
  resellerId?: string;
  ownerUserId?: string;
  leadSource?: OpportunityLeadSource;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
  includeDeleted?: boolean;
  sort?: "createdAt" | "title" | "opportunityNumber";
  order?: "asc" | "desc";
}

export interface OpportunityCreateWrite {
  title: string;
  description?: string;
  customerId?: string;
  contactId?: string;
  resellerId?: string;
  ownerUserId?: string;
  leadSource?: OpportunityLeadSource;
  estimatedValue?: string;
  currencyCode: string;
  probabilityPercent?: number;
  expectedCloseDate?: string;
  nextAction?: string;
  nextActionDueAt?: string;
  competitorName?: string;
  notes?: string;
  prospectDisplayName?: string;
  prospectLegalName?: string;
  prospectEmail?: string;
  prospectPhone?: string;
  prospectCountryCode?: string;
}

export interface OpportunityUpdateWrite {
  title?: string;
  description?: string | null;
  contactId?: string | null;
  resellerId?: string | null;
  ownerUserId?: string;
  leadSource?: OpportunityLeadSource | null;
  estimatedValue?: string;
  currencyCode?: string;
  probabilityPercent?: number;
  expectedCloseDate?: string | null;
  nextAction?: string | null;
  nextActionDueAt?: string | null;
  competitorName?: string | null;
  notes?: string | null;
  prospectDisplayName?: string | null;
  prospectLegalName?: string | null;
  prospectEmail?: string | null;
  prospectPhone?: string | null;
  prospectCountryCode?: string | null;
}

export interface ChangeStageWrite {
  stage: OpportunityStage;
  probabilityPercent?: number;
  applyStageDefault?: boolean;
  expectedCloseDate?: string;
}

export interface MarkWonWrite {
  probabilityPercent?: number;
  applyStageDefault?: boolean;
}

export interface MarkLostWrite {
  lostReason: OpportunityLostReason;
  lostReasonDetail?: string;
  competitorName?: string;
  probabilityPercent?: number;
  applyStageDefault?: boolean;
}

export interface ReopenWrite {
  stage?: OpportunityStage;
  probabilityPercent?: number;
  applyStageDefault?: boolean;
}

export type ConvertWrite = { mode: "LINK"; customerId: string } | { mode: "CREATE"; customer: CustomerWrite };

export interface ProductInterestWrite {
  productId: string;
  quantity?: string;
  estimatedUnitAmount?: string;
  notes?: string;
  sortOrder?: number;
}

export interface ProductInterestUpdateWrite {
  quantity?: string;
  estimatedUnitAmount?: string | null;
  notes?: string | null;
  sortOrder?: number;
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

export function listOpportunities(
  params: Record<string, string | number | boolean | undefined>,
): Promise<Page<Opportunity>> {
  return data(http.get<ApiSuccess<Page<Opportunity>>>("/api/v1/opportunities", { params }));
}

export function getOpportunityFormOptions(): Promise<OpportunityFormOptions> {
  return data(http.get<ApiSuccess<OpportunityFormOptions>>("/api/v1/opportunities/form-options"));
}

export function getOpportunity(id: string): Promise<Opportunity> {
  return data(http.get<ApiSuccess<Opportunity>>(`/api/v1/opportunities/${id}`));
}

export function createOpportunity(body: OpportunityCreateWrite): Promise<Opportunity> {
  return data(http.post("/api/v1/opportunities", body));
}

export function updateOpportunity(id: string, body: OpportunityUpdateWrite): Promise<Opportunity> {
  return data(http.patch(`/api/v1/opportunities/${id}`, body));
}

export function deleteOpportunity(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/opportunities/${id}`));
}

export function restoreOpportunity(id: string): Promise<Opportunity> {
  return data(http.post(`/api/v1/opportunities/${id}/restore`));
}

export function changeOpportunityStage(id: string, body: ChangeStageWrite): Promise<Opportunity> {
  return data(http.post(`/api/v1/opportunities/${id}/stage`, body));
}

export function markOpportunityWon(id: string, body: MarkWonWrite): Promise<Opportunity> {
  return data(http.post(`/api/v1/opportunities/${id}/won`, body));
}

export function markOpportunityLost(id: string, body: MarkLostWrite): Promise<Opportunity> {
  return data(http.post(`/api/v1/opportunities/${id}/lost`, body));
}

export function reopenOpportunity(id: string, body: ReopenWrite): Promise<Opportunity> {
  return data(http.post(`/api/v1/opportunities/${id}/reopen`, body));
}

export function convertOpportunity(id: string, body: ConvertWrite): Promise<Opportunity> {
  return data(http.post(`/api/v1/opportunities/${id}/convert`, body));
}

export function listProductInterests(opportunityId: string): Promise<OpportunityProductInterest[]> {
  return data(http.get(`/api/v1/opportunities/${opportunityId}/products`));
}

export function createProductInterest(
  opportunityId: string,
  body: ProductInterestWrite,
): Promise<OpportunityProductInterest> {
  return data(http.post(`/api/v1/opportunities/${opportunityId}/products`, body));
}

export function updateProductInterest(
  opportunityId: string,
  interestId: string,
  body: ProductInterestUpdateWrite,
): Promise<OpportunityProductInterest> {
  return data(http.patch(`/api/v1/opportunities/${opportunityId}/products/${interestId}`, body));
}

export function deleteProductInterest(opportunityId: string, interestId: string): Promise<{ id: string; deleted: boolean }> {
  return data(http.delete(`/api/v1/opportunities/${opportunityId}/products/${interestId}`));
}

export function listOpportunityAudit(opportunityId: string): Promise<Page<AuditEvent>> {
  return data(http.get(`/api/v1/opportunities/${opportunityId}/audit`, { params: { limit: 20 } }));
}

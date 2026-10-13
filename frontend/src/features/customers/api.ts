import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export interface CustomerSummary {
  id: string;
  customerNumber: string;
  customerCode: string | null;
  entityType: "COMPANY" | "INDIVIDUAL";
  customerType: "COMPANY" | "INDIVIDUAL" | "B2B" | "B2C" | "WHOLESALE";
  customerCategory: CustomerCategory | null;
  rating: CustomerRating | null;
  priority: CustomerPriority;
  legalName: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  countryCode: string;
  currencyCode: string;
  status: "ACTIVE" | "INACTIVE" | "HOLD";
  createdAt: string;
  deletedAt: string | null;
  employeeCount: number | null;
  incorporationStatus: IncorporationStatus | null;
  businessRegistrationDate: string | null;
  sameAsBilling: boolean;
  openingBalance?: string | number | null;
  taxNumber?: string | null;
  contacts?: Array<{ id: string; displayName: string; email: string | null }>;
}

export interface CustomerAddress {
  id: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  geofenceRadiusMeters?: number | null;
  purpose: "BILLING" | "SHIPPING";
  isPrimary: boolean;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  countryCode: string;
}

export interface CustomerDetail extends CustomerSummary {
  website: string | null;
  industry: string | null;
  middleName: string | null;
  registrationNumber: string | null;
  leadSource: CustomerLeadSource | null;
  assignedSalesRepId: string | null;
  taxNumber: string | null;
  taxIdType: "NTN" | "STRN" | "OTHER" | null;
  taxExemptionCode: string | null;
  defaultTaxCodeId: string | null;
  identityDocumentType: IdentityDocumentType | null;
  identityDocumentNumber: string | null;
  taxExempt: boolean;
  pricesIncludeTax: boolean;
  emailMarketingOptIn: boolean;
  creditHold: boolean;
  creditLimit: string;
  preferredPaymentMethod: PreferredPaymentMethod | null;
  preferredCommunicationChannel: PreferredCommunicationChannel | null;
  paymentTermId: string | null;
  pricingGroupId: string | null;
  accountingCategoryId: string | null;
  accountingCategory: { id: string; code: string; name: string } | null;
  openingBalance: string;
  openingBalanceDate: string | null;
  notes: string | null;
  addresses: CustomerAddress[];
  contacts: Contact[];
}

export interface Contact {
  id: string;
  customerId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  jobTitle: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  role?: CustomerContactRole | null;
  emailOptIn: boolean;
  phoneOptIn: boolean;
  smsOptIn: boolean;
  whatsappOptIn: boolean;
  status: "ACTIVE" | "INACTIVE";
  notes: string | null;
  roleAssignments?: Array<{ role: CustomerContactRole }>;
}

export type CustomerLeadSource = "WEBSITE" | "REFERRAL" | "COLD_CALL" | "SOCIAL_MEDIA" | "ADVERTISEMENT" | "PARTNER" | "TENDER" | "OTHER";
export type CustomerContactRole = "BILLING" | "PROCUREMENT" | "FINANCE" | "OPERATIONS" | "SALES" | "OTHER";
export type CustomerCategory = "RETAIL" | "WHOLESALE" | "CORPORATE" | "VIP" | "PARTNER" | "OTHER";
export type CustomerRating = "HOT" | "WARM" | "COLD" | "MISCELLANEOUS";
export type CustomerPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type IncorporationStatus = "REGISTERED" | "PENDING" | "UNREGISTERED" | "NOT_APPLICABLE";
export type IdentityDocumentType = "CNIC" | "PASSPORT";
export type PreferredPaymentMethod = "BANK_TRANSFER" | "CASH" | "CARD" | "CHEQUE" | "MOBILE_WALLET" | "OTHER";
export type PreferredCommunicationChannel = "EMAIL" | "PHONE" | "SMS" | "WHATSAPP";

export interface CustomerFormOptions {
  salesReps: Array<{ id: string; firstName: string; lastName: string; email: string }>;
  paymentTerms: Array<{ id: string; code: string; name: string; dueDays: number; requiresPrepayment: boolean }>;
  pricingGroups: Array<{
    id: string;
    code: string;
    name: string;
    groupType: "PRICING_TIER" | "DISCOUNT_GROUP";
    discountPercent: string | null;
  }>;
  taxCodes: Array<{ id: string; code: string; name: string; rate: string | number }>;
  accountingCategories: Array<{ id: string; code: string; name: string }>;
}

export interface PaymentTermOption {
  id: string;
  code: string;
  name: string;
  dueDays: number;
  requiresPrepayment: boolean;
}

export interface AccountingCategoryOption {
  id: string;
  code: string;
  name: string;
}

export interface Page<T> {
  items: T[];
  pageInfo: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}

export interface CustomerWrite {
  entityType: CustomerSummary["entityType"];
  customerType: CustomerSummary["customerType"];
  customerCategory?: CustomerCategory | null;
  rating?: CustomerRating | null;
  priority?: CustomerPriority;
  customerCode?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  incorporationStatus?: IncorporationStatus | null;
  businessRegistrationDate?: string | null;
  registrationNumber?: string | null;
  sameAsBilling?: boolean;
  leadSource?: CustomerLeadSource | null;
  assignedSalesRepId?: string | null;
  legalName: string;
  displayName: string;
  middleName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  countryCode: string;
  currencyCode: string;
  taxNumber?: string | null;
  taxIdType?: "NTN" | "STRN" | "OTHER" | null;
  taxExemptionCode?: string | null;
  defaultTaxCodeId?: string | null;
  identityDocumentType?: IdentityDocumentType | null;
  identityDocumentNumber?: string | null;
  taxExempt?: boolean;
  pricesIncludeTax?: boolean;
  emailMarketingOptIn?: boolean;
  creditHold?: boolean;
  status?: CustomerSummary["status"];
  creditLimit?: string;
  preferredPaymentMethod?: PreferredPaymentMethod | null;
  preferredCommunicationChannel?: PreferredCommunicationChannel | null;
  paymentTermId?: string | null;
  pricingGroupId?: string | null;
  accountingCategoryId?: string | null;
  openingBalance?: string;
  openingBalanceDate?: string | null;
  notes?: string | null;
  addresses?: AddressWrite[];
  contacts?: ContactWrite[];
}

export interface AddressWrite {
  id?: string;
  purpose: "BILLING" | "SHIPPING";
  isPrimary?: boolean;
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters?: number;
}

export interface ContactWrite {
  id?: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  jobTitle?: string;
  department?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  isPrimary?: boolean;
  role?: CustomerContactRole;
  emailOptIn?: boolean;
  phoneOptIn?: boolean;
  smsOptIn?: boolean;
  whatsappOptIn?: boolean;
  status?: "ACTIVE" | "INACTIVE";
  notes?: string;
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

export function listCustomers(params: Record<string, string | number | undefined>): Promise<Page<CustomerSummary>> {
  return data(http.get<ApiSuccess<Page<CustomerSummary>>>("/api/v1/customers", { params }));
}

export function getCustomer(id: string): Promise<CustomerDetail> {
  return data(http.get<ApiSuccess<CustomerDetail>>(`/api/v1/customers/${id}`));
}

export function getCustomerFormOptions(): Promise<CustomerFormOptions> {
  return data(http.get<ApiSuccess<CustomerFormOptions>>("/api/v1/customers/form-options"));
}

export function createCustomerPaymentTerm(body: { name: string; dueDays: number; requiresPrepayment: boolean }): Promise<PaymentTermOption> {
  return data(http.post<ApiSuccess<PaymentTermOption>>("/api/v1/customers/payment-terms", body));
}

export function createCustomerAccountingCategory(body: { name: string; code?: string }): Promise<AccountingCategoryOption> {
  return data(http.post<ApiSuccess<AccountingCategoryOption>>("/api/v1/customers/accounting-categories", body));
}

export function createCustomer(body: CustomerWrite): Promise<{ customer: CustomerDetail; possibleDuplicate: boolean }> {
  return data(http.post("/api/v1/customers", body));
}

export function updateCustomer(id: string, body: CustomerWrite): Promise<CustomerDetail> {
  return data(http.patch(`/api/v1/customers/${id}`, body));
}

export function deleteCustomer(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/customers/${id}`));
}

export function permanentlyDeleteCustomer(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/customers/${id}/permanent`));
}

export function restoreCustomer(id: string): Promise<CustomerDetail> {
  return data(http.post(`/api/v1/customers/${id}/restore`));
}

export function createAddress(customerId: string, body: AddressWrite): Promise<CustomerAddress> {
  return data(http.post(`/api/v1/customers/${customerId}/addresses`, body));
}

export function updateAddress(customerId: string, addressId: string, body: AddressWrite): Promise<CustomerAddress> {
  return data(http.patch(`/api/v1/customers/${customerId}/addresses/${addressId}`, body));
}

export function deleteAddress(customerId: string, addressId: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/customers/${customerId}/addresses/${addressId}`));
}

export function listContacts(customerId: string): Promise<Page<Contact>> {
  return data(http.get(`/api/v1/customers/${customerId}/contacts`, { params: { limit: 100 } }));
}

export function createContact(customerId: string, body: ContactWrite): Promise<Contact> {
  return data(http.post(`/api/v1/customers/${customerId}/contacts`, body));
}

export function updateContact(id: string, body: Partial<ContactWrite>): Promise<Contact> {
  return data(http.patch(`/api/v1/contacts/${id}`, body));
}

export function deleteContact(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/contacts/${id}`));
}

export function listCustomerAudit(customerId: string): Promise<Page<AuditEvent>> {
  return data(
    http.get("/api/v1/audit-logs", {
      params: { subjectId: customerId, limit: 20 },
    }),
  );
}

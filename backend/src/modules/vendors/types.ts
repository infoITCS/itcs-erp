export const VENDORS_MODULE = "vendors" as const;

export const VENDOR_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;

export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
};

export interface VendorSummary {
  id: string;
  organizationId: string;
  vendorNumber: string;
  code: string | null;
  name: string;
  legalName: string | null;
  displayName: string | null;
  status: VendorStatus;
  vendorType: string | null;
  category: string | null;
  currencyCode: string;
  paymentTermId: string | null;
  taxCodeId: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  countryCode: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

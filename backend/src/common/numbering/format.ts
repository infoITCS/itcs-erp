import { DocumentType } from "@prisma/client";

type PurchasingDocumentType = "GOODS_RECEIPT" | "VENDOR_PAYMENT";

export const DOCUMENT_PREFIX: Record<DocumentType | PurchasingDocumentType, string> = {
  QUOTE: "QT",
  SALES_ORDER: "SO",
  INVOICE: "INV",
  PURCHASE_ORDER: "PO",
  BILL: "BILL",
  GOODS_RECEIPT: "GRN",
  VENDOR_PAYMENT: "VPAY",
  TENDER: "TND",
  PAYMENT: "PAY",
  RENEWAL: "RN",
  CUSTOMER: "CUS",
  PRODUCT: "PRD",
  RESELLER: "RSL",
  OPPORTUNITY: "OPP",
  LEAD: "LEAD",
  PROJECT: "PRJ",
};

export const DOCUMENT_TYPES = (Object.keys(DOCUMENT_PREFIX) as string[]).filter((value) =>
  Object.prototype.hasOwnProperty.call(DocumentType, value),
) as DocumentType[];

export function formatDocumentNumber(prefix: string, year: number, sequence: number, padding: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(padding, "0")}`;
}

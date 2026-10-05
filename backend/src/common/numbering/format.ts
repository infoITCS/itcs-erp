import type { DocumentType } from "@prisma/client";

export const DOCUMENT_PREFIX: Record<DocumentType, string> = {
  QUOTE: "QT",
  SALES_ORDER: "SO",
  INVOICE: "INV",
  PURCHASE_ORDER: "PO",
  BILL: "BILL",
  TENDER: "TND",
  PAYMENT: "PAY",
  RENEWAL: "RN",
  CUSTOMER: "CUS",
};

export const DOCUMENT_TYPES = Object.keys(DOCUMENT_PREFIX) as DocumentType[];

export function formatDocumentNumber(prefix: string, year: number, sequence: number, padding: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(padding, "0")}`;
}

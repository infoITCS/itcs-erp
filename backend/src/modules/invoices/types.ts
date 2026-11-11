import { ValidationFailedError } from "../../common/errors/app-error";

export const INVOICES_MODULE = "invoices" as const;

export const INVOICE_STATUSES = [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "VOID",
] as const;
export type InvoiceStatusValue = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatusValue, readonly InvoiceStatusValue[]> = {
  DRAFT: ["SENT", "VOID"],
  SENT: ["PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"],
  PARTIALLY_PAID: ["PAID", "OVERDUE", "VOID"],
  OVERDUE: ["PARTIALLY_PAID", "PAID", "VOID"],
  PAID: [],
  VOID: [],
};

export const INVOICE_MANUAL_STATUSES = ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"] as const;
export type InvoiceManualStatus = (typeof INVOICE_MANUAL_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatusValue, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  VOID: "Void",
};

export function assertInvoiceTransition(current: InvoiceStatusValue, next: InvoiceStatusValue): void {
  if (!INVOICE_STATUS_TRANSITIONS[current].includes(next)) {
    throw new ValidationFailedError({
      status: [`A ${INVOICE_STATUS_LABELS[current]} invoice cannot move to ${INVOICE_STATUS_LABELS[next]}`],
    });
  }
}

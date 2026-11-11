export const PAYMENTS_MODULE = "payments" as const;

export const PAYMENT_METHODS = [
  "BANK_TRANSFER",
  "CASH",
  "CARD",
  "CHEQUE",
  "MOBILE_WALLET",
  "OTHER",
] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodValue, string> = {
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CARD: "Card",
  CHEQUE: "Cheque",
  MOBILE_WALLET: "Mobile wallet",
  OTHER: "Other",
};

export const PAYABLE_INVOICE_STATUSES = ["SENT", "PARTIALLY_PAID", "OVERDUE"] as const;

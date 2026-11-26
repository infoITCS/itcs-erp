import { ValidationFailedError } from "../../common/errors/app-error";

export const PURCHASING_MODULE = "purchasing" as const;

export const PURCHASE_ORDER_STATUSES = [
  "DRAFT",
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "BILLED",
  "CLOSED",
  "CANCELLED",
] as const;
export type PurchaseOrderStatusValue = (typeof PURCHASE_ORDER_STATUSES)[number];

export const GOODS_RECEIPT_STATUSES = ["DRAFT", "POSTED", "CANCELLED"] as const;
export type GoodsReceiptStatusValue = (typeof GOODS_RECEIPT_STATUSES)[number];

export const VENDOR_BILL_STATUSES = ["DRAFT", "APPROVED", "PARTIALLY_PAID", "PAID", "VOID"] as const;
export type VendorBillStatusValue = (typeof VENDOR_BILL_STATUSES)[number];

export const VENDOR_PAYMENT_STATUSES = ["DRAFT", "PAID", "CANCELLED"] as const;
export type VendorPaymentStatusValue = (typeof VENDOR_PAYMENT_STATUSES)[number];

export const VENDOR_PAYMENT_METHODS = ["BANK_TRANSFER", "CASH", "CHECK", "CHEQUE", "MOBILE_WALLET", "ONLINE", "OTHER"] as const;
export type VendorPaymentMethodValue = (typeof VENDOR_PAYMENT_METHODS)[number];

export const PURCHASE_ORDER_STATUS_TRANSITIONS: Record<PurchaseOrderStatusValue, readonly PurchaseOrderStatusValue[]> = {
  DRAFT: ["APPROVED", "CANCELLED"],
  APPROVED: ["SENT", "CANCELLED"],
  SENT: ["PARTIALLY_RECEIVED", "CANCELLED"],
  PARTIALLY_RECEIVED: ["RECEIVED"],
  RECEIVED: ["BILLED"],
  BILLED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export const GOODS_RECEIPT_STATUS_TRANSITIONS: Record<GoodsReceiptStatusValue, readonly GoodsReceiptStatusValue[]> = {
  DRAFT: ["POSTED", "CANCELLED"],
  POSTED: [],
  CANCELLED: [],
};

export const VENDOR_BILL_STATUS_TRANSITIONS: Record<VendorBillStatusValue, readonly VendorBillStatusValue[]> = {
  DRAFT: ["APPROVED"],
  APPROVED: ["PARTIALLY_PAID", "VOID"],
  PARTIALLY_PAID: ["PAID", "VOID"],
  PAID: [],
  VOID: [],
};

export const VENDOR_PAYMENT_STATUS_TRANSITIONS: Record<VendorPaymentStatusValue, readonly VendorPaymentStatusValue[]> = {
  DRAFT: ["PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

export const PURCHASE_ORDER_MANUAL_STATUSES = ["APPROVED", "SENT", "CLOSED", "CANCELLED"] as const;

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatusValue, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  SENT: "Sent",
  PARTIALLY_RECEIVED: "Partially received",
  RECEIVED: "Received",
  BILLED: "Billed",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const GOODS_RECEIPT_STATUS_LABELS: Record<GoodsReceiptStatusValue, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

export const VENDOR_BILL_STATUS_LABELS: Record<VendorBillStatusValue, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  VOID: "Void",
};

export const VENDOR_PAYMENT_STATUS_LABELS: Record<VendorPaymentStatusValue, string> = {
  DRAFT: "Draft",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export const VENDOR_PAYMENT_METHOD_LABELS: Record<VendorPaymentMethodValue, string> = {
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CHECK: "Check",
  CHEQUE: "Cheque",
  MOBILE_WALLET: "Mobile wallet",
  ONLINE: "Online",
  OTHER: "Other",
};

export const DEFAULT_EXPENSE_ACCOUNT = "Inventory - Products (50100)";
export const DEFAULT_LIABILITY_ACCOUNT = "Accounts Payable (20100)";

function assertTransition<TStatus extends string>(
  transitions: Record<TStatus, readonly TStatus[]>,
  labels: Record<TStatus, string>,
  document: string,
  current: TStatus,
  next: TStatus,
): void {
  if (!transitions[current]?.includes(next)) {
    throw new ValidationFailedError({
      status: [`A ${labels[current]} ${document} cannot move to ${labels[next]}`],
    });
  }
}

export function assertPurchaseOrderTransition(
  current: PurchaseOrderStatusValue,
  next: PurchaseOrderStatusValue,
): void {
  assertTransition(PURCHASE_ORDER_STATUS_TRANSITIONS, PURCHASE_ORDER_STATUS_LABELS, "purchase order", current, next);
}

export function assertGoodsReceiptTransition(
  current: GoodsReceiptStatusValue,
  next: GoodsReceiptStatusValue,
): void {
  assertTransition(GOODS_RECEIPT_STATUS_TRANSITIONS, GOODS_RECEIPT_STATUS_LABELS, "goods receipt", current, next);
}

export function assertVendorBillTransition(current: VendorBillStatusValue, next: VendorBillStatusValue): void {
  assertTransition(VENDOR_BILL_STATUS_TRANSITIONS, VENDOR_BILL_STATUS_LABELS, "vendor bill", current, next);
}

export function assertVendorPaymentTransition(
  current: VendorPaymentStatusValue,
  next: VendorPaymentStatusValue,
): void {
  assertTransition(VENDOR_PAYMENT_STATUS_TRANSITIONS, VENDOR_PAYMENT_STATUS_LABELS, "vendor payment", current, next);
}

export function statusOptions<TStatus extends string>(
  statuses: readonly TStatus[],
  labels: Record<TStatus, string>,
): Array<{ value: TStatus; label: string }> {
  return statuses.map((status) => ({ value: status, label: labels[status] }));
}

export function transitionOptions<TStatus extends string>(
  transitions: Record<TStatus, readonly TStatus[]>,
  statuses: readonly TStatus[],
): Record<TStatus, readonly TStatus[]> {
  return Object.fromEntries(statuses.map((status) => [status, transitions[status]])) as Record<
    TStatus,
    readonly TStatus[]
  >;
}

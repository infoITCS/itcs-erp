import { ValidationFailedError } from "../../common/errors/app-error";

export const SALES_ORDERS_MODULE = "sales-orders" as const;

export const SALES_ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PROCESSING",
  "FULFILLED",
  "CLOSED",
  "CANCELLED",
] as const;
export type SalesOrderStatusValue = (typeof SALES_ORDER_STATUSES)[number];

export const SALES_ORDER_STATUS_TRANSITIONS: Record<SalesOrderStatusValue, readonly SalesOrderStatusValue[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "FULFILLED", "CANCELLED"],
  PROCESSING: ["FULFILLED", "CANCELLED"],
  FULFILLED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export const SALES_ORDER_MANUAL_STATUSES = [
  "CONFIRMED",
  "PROCESSING",
  "FULFILLED",
  "CLOSED",
  "CANCELLED",
] as const;
export type SalesOrderManualStatus = (typeof SALES_ORDER_MANUAL_STATUSES)[number];

export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatusValue, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  FULFILLED: "Fulfilled",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export function assertSalesOrderTransition(current: SalesOrderStatusValue, next: SalesOrderStatusValue): void {
  if (!SALES_ORDER_STATUS_TRANSITIONS[current].includes(next)) {
    throw new ValidationFailedError({
      status: [
        `A ${SALES_ORDER_STATUS_LABELS[current]} sales order cannot move to ${SALES_ORDER_STATUS_LABELS[next]}`,
      ],
    });
  }
}

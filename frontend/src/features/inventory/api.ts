import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";
import type { Page } from "../sales/shared.tsx";

export const INVENTORY_PERMISSIONS = {
  read: "inventory:read",
  create: "inventory:create",
  manage: "inventory:manage",
} as const;

export interface InventoryUnitOfMeasure {
  code?: string | null;
  name?: string | null;
}

export interface InventoryProductOption {
  id: string;
  code?: string | null;
  name: string;
  unitOfMeasure?: string | InventoryUnitOfMeasure | null;
  trackInventory?: boolean;
}

export interface StockItem {
  id?: string;
  productId: string;
  product?: InventoryProductOption | null;
  productCode?: string | null;
  productName?: string | null;
  quantity?: string;
  quantityOnHand?: string;
  availableQuantity?: string;
  reservedQuantity?: string;
  committedQuantity?: string;
  location?: string | null;
  warehouse?: string | null;
  unitOfMeasure?: string | InventoryUnitOfMeasure | null;
  updatedAt?: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  product?: InventoryProductOption | null;
  productCode?: string | null;
  productName?: string | null;
  movementType?: string;
  type?: string;
  quantity: string;
  direction?: string;
  balanceAfter?: string | null;
  location?: string | null;
  reference?: string | null;
  referenceType?: string | null;
  reason?: string | null;
  source?: string | null;
  createdAt?: string;
  createdBy?: { id: string; firstName?: string; lastName?: string; email?: string } | null;
}

export interface InventoryOption {
  value: string;
  label: string;
}

export interface InventoryFormOptions {
  products: InventoryProductOption[];
  locations: InventoryOption[];
  reasons: InventoryOption[];
  movementTypes: InventoryOption[];
}

export interface InventoryAdjustmentWrite {
  productId: string;
  quantity: string;
  location?: string;
  reason?: string;
}

function data<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data as T);
}

export function listStock(params: Record<string, string | number | boolean | undefined>): Promise<Page<StockItem>> {
  return data(http.get<ApiSuccess<Page<StockItem>>>("/api/v1/inventory/stock", { params }));
}

export function listInventoryMovements(params: Record<string, string | number | boolean | undefined>): Promise<Page<InventoryMovement>> {
  return data(http.get<ApiSuccess<Page<InventoryMovement>>>("/api/v1/inventory/movements", { params }));
}

export function getInventoryFormOptions(): Promise<InventoryFormOptions> {
  return data(http.get<ApiSuccess<InventoryFormOptions>>("/api/v1/inventory/form-options"));
}

export function createInventoryAdjustment(body: InventoryAdjustmentWrite): Promise<InventoryMovement> {
  const reason = body.reason?.trim() ?? "";
  if (reason.length < 3 || reason.length > 500) {
    throw new Error("Enter a reason with 3 to 500 characters.");
  }
  return data(http.post("/api/v1/inventory/adjustments", body));
}

import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";
import type { Page } from "../sales/shared.tsx";

export const INVENTORY_PERMISSIONS = {
  read: "inventory:read",
  create: "inventory:create",
  update: "inventory:update",
  delete: "inventory:delete",
} as const;

export interface InventoryProductOption {
  id: string;
  code?: string | null;
  name: string;
  unitOfMeasure?: string | null;
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
  unitOfMeasure?: string | null;
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

export interface InventoryFormOptions {
  products: InventoryProductOption[];
  locations: string[];
  reasons: string[];
  movementTypes: string[];
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
  return data(http.post("/api/v1/inventory/adjustments", body));
}

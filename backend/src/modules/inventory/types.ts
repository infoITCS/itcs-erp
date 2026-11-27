export const INVENTORY_MODULE = "inventory" as const;

export const INVENTORY_MOVEMENT_TYPES = [
  "PURCHASE_RECEIPT",
  "PURCHASE_RETURN",
  "ADJUSTMENT",
  "SALE",
] as const;

export type InventoryMovementTypeValue = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export const INVENTORY_MOVEMENT_TYPE_LABELS: Record<InventoryMovementTypeValue, string> = {
  PURCHASE_RECEIPT: "Purchase receipt",
  PURCHASE_RETURN: "Purchase return",
  ADJUSTMENT: "Adjustment",
  SALE: "Sale issue",
};

export const INVENTORY_ADJUSTMENT_REASONS = [
  { value: "DAMAGE", label: "Damage" },
  { value: "CORRECTION", label: "Correction" },
  { value: "CYCLE_COUNT", label: "Cycle count" },
  { value: "SUPPLIER_RETURN", label: "Supplier return" },
  { value: "OTHER", label: "Other" },
] as const;

export const DEFAULT_LOCATION = "MAIN LOCATION";

export const INVENTORY_MODULE = "inventory" as const;

export const INVENTORY_MOVEMENT_TYPES = [
  "PURCHASE_RECEIPT",
  "PURCHASE_RETURN",
  "ADJUSTMENT",
] as const;

export type InventoryMovementTypeValue = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export const INVENTORY_MOVEMENT_TYPE_LABELS: Record<InventoryMovementTypeValue, string> = {
  PURCHASE_RECEIPT: "Purchase receipt",
  PURCHASE_RETURN: "Purchase return",
  ADJUSTMENT: "Adjustment",
};

export const DEFAULT_LOCATION = "MAIN LOCATION";

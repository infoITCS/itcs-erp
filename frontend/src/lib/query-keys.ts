export const queryKeys = {
  health: ["health"] as const,
  list: (moduleName: string, params: Record<string, unknown>) => [moduleName, "list", params] as const,
};

export const purchasingKeys = {
  all: () => ["purchasing"] as const,
  hub: () => ["purchasing", "hub"] as const,
  orders: {
    all: () => ["purchasing", "orders"] as const,
    lists: () => ["purchasing", "orders", "list"] as const,
    list: (params: Record<string, unknown>) => ["purchasing", "orders", "list", params] as const,
    details: () => ["purchasing", "orders", "detail"] as const,
    detail: (id: string) => ["purchasing", "orders", "detail", id] as const,
    formOptions: () => ["purchasing", "orders", "form-options"] as const,
    receiptOptions: (id: string) => ["purchasing", "orders", "receipt-options", id] as const,
    receivable: () => ["purchasing", "orders", "receivable"] as const,
  },
  receipts: {
    all: () => ["purchasing", "receipts"] as const,
    lists: () => ["purchasing", "receipts", "list"] as const,
    list: (params: Record<string, unknown>) => ["purchasing", "receipts", "list", params] as const,
    details: () => ["purchasing", "receipts", "detail"] as const,
    detail: (id: string) => ["purchasing", "receipts", "detail", id] as const,
  },
  bills: {
    all: () => ["purchasing", "bills"] as const,
    lists: () => ["purchasing", "bills", "list"] as const,
    list: (params: Record<string, unknown>) => ["purchasing", "bills", "list", params] as const,
    details: () => ["purchasing", "bills", "detail"] as const,
    detail: (id: string) => ["purchasing", "bills", "detail", id] as const,
    formOptions: () => ["purchasing", "bills", "form-options"] as const,
  },
  payments: {
    all: () => ["purchasing", "payments"] as const,
    lists: () => ["purchasing", "payments", "list"] as const,
    list: (params: Record<string, unknown>) => ["purchasing", "payments", "list", params] as const,
    details: () => ["purchasing", "payments", "detail"] as const,
    detail: (id: string) => ["purchasing", "payments", "detail", id] as const,
    formOptions: () => ["purchasing", "payments", "form-options"] as const,
  },
  formOptions: () => ["purchasing", "form-options"] as const,
};

export const vendorKeys = {
  all: () => ["vendors"] as const,
  lists: () => ["vendors", "list"] as const,
  list: (params: Record<string, unknown>) => ["vendors", "list", params] as const,
  details: () => ["vendors", "detail"] as const,
  detail: (id: string) => ["vendors", "detail", id] as const,
  formOptions: () => ["vendors", "form-options"] as const,
};

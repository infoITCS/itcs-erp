import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";
import type {
  CurrencyRef,
  DocumentLine,
  DocumentLineInput,
  Page,
  PaymentTermRef,
  ProductOption,
  TaxCodeOption,
} from "../sales/shared.tsx";
import type { VendorOption } from "@/features/vendors/api.ts";

type ProductOptionApi = Omit<ProductOption, "taxCode"> & { taxCode?: string | { code?: string | null } | null };

function normalizeProductOption(product: ProductOptionApi): ProductOption {
  const taxCode = typeof product.taxCode === "string" ? product.taxCode : product.taxCode?.code ?? null;
  return { ...product, taxCode };
}

function normalizeProductOptions(products: ProductOptionApi[] | undefined): ProductOption[] {
  return (products ?? []).map(normalizeProductOption);
}

export const PURCHASING_PERMISSIONS = {
  read: "purchasing:read",
  create: "purchasing:create",
  update: "purchasing:update",
  delete: "purchasing:delete",
  approve: "purchasing:approve",
  restore: "purchasing:restore",
} as const;

export type PurchaseOrderStatus =
  | "DRAFT"
  | "APPROVED"
  | "SENT"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "BILLED"
  | "CLOSED"
  | "CANCELLED";

export const PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  "DRAFT",
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "BILLED",
  "CLOSED",
  "CANCELLED",
];

export const PURCHASE_ORDER_STATUS_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ["APPROVED", "CANCELLED"],
  APPROVED: ["SENT", "CANCELLED"],
  SENT: ["CANCELLED"],
  PARTIALLY_RECEIVED: ["CANCELLED"],
  RECEIVED: ["CLOSED", "CANCELLED"],
  BILLED: ["CLOSED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
};

export type ReceiptStatus = "DRAFT" | "POSTED" | "CANCELLED";
export const RECEIPT_STATUSES: ReceiptStatus[] = ["DRAFT", "POSTED", "CANCELLED"];

export type BillStatus = "DRAFT" | "APPROVED" | "PARTIALLY_PAID" | "PAID" | "VOID";
export const BILL_STATUSES: BillStatus[] = ["DRAFT", "APPROVED", "PARTIALLY_PAID", "PAID", "VOID"];

export type VendorPaymentStatus = "DRAFT" | "PAID" | "CANCELLED";
export const VENDOR_PAYMENT_STATUSES: VendorPaymentStatus[] = ["DRAFT", "PAID", "CANCELLED"];

export type VendorPaymentMethod = "BANK_TRANSFER" | "CASH" | "CHECK" | "CHEQUE" | "MOBILE_WALLET" | "ONLINE" | "OTHER";

export const VENDOR_PAYMENT_METHODS: VendorPaymentMethod[] = [
  "BANK_TRANSFER",
  "CASH",
  "CHECK",
  "CHEQUE",
  "MOBILE_WALLET",
  "ONLINE",
  "OTHER",
];

export interface PurchaseOrderLine extends DocumentLine {
  purchaseOrderLineId?: string;
  receivedQuantity?: string;
  sourceSalesOrderLineId?: string | null;
  location?: string | null;
}

export interface PurchaseOrder {
  id: string;
  organizationId?: string;
  purchaseOrderNumber?: string | null;
  orderNumber?: string | null;
  vendorId: string;
  vendor?: VendorOption | null;
  sourceSalesOrderId?: string | null;
  sourceSalesOrder?: { id: string; salesOrderNumber: string; status: string; total: string } | null;
  status: PurchaseOrderStatus;
  orderDate?: string;
  issueDate?: string;
  expectedDeliveryDate?: string | null;
  vendorReference?: string | null;
  currencyCode: string;
  exchangeRateToBase?: string | null;
  paymentTermId?: string | null;
  paymentTerm?: PaymentTermRef | null;
  subtotal?: string;
  discountTotal?: string;
  taxTotal?: string;
  total: string;
  notes?: string | null;
  terms?: string | null;
  approvedAt?: string | null;
  sentAt?: string | null;
  receivedAt?: string | null;
  billedAt?: string | null;
  closedAt?: string | null;
  cancelledAt?: string | null;
  createdById?: string;
  updatedById?: string;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lines?: PurchaseOrderLine[];
  receipts?: Array<{ id: string; receiptNumber?: string | null; status: ReceiptStatus; receiptDate: string; total?: string }>;
  bills?: Array<{ id: string; billNumber?: string | null; status: BillStatus; billDate: string; total: string }>;
  _count?: { lines?: number; receipts?: number; bills?: number };
}

export interface PurchaseOrderOption {
  id: string;
  purchaseOrderNumber?: string | null;
  orderNumber?: string | null;
  vendorId: string;
  vendor?: VendorOption | null;
  currencyCode: string;
  status: PurchaseOrderStatus;
  orderDate?: string;
  issueDate?: string;
  expectedDeliveryDate?: string | null;
  total?: string;
  availableLines?: ReceivableLineOption[];
  lines?: PurchaseOrderLine[];
}

export interface PurchaseOrderFormOptions {
  vendors: VendorOption[];
  currencies: CurrencyRef[];
  paymentTerms: PaymentTermRef[];
  taxCodes: TaxCodeOption[];
  products: ProductOption[];
  statuses: Array<{ value: PurchaseOrderStatus; label: string }>;
}

export interface CreatePurchaseOrderFromSalesOrderWrite {
  salesOrderId: string;
  vendorId: string;
  ownerUserId?: string;
  orderDate?: string;
  expectedDeliveryDate?: string | null;
  vendorReference?: string | null;
  notes?: string | null;
}

export interface PurchaseOrderWrite {
  vendorId: string;
  orderDate?: string;
  issueDate?: string;
  expectedDeliveryDate?: string | null;
  vendorReference?: string | null;
  currencyCode: string;
  paymentTermId?: string | null;
  notes?: string | null;
  terms?: string | null;
  lines: DocumentLineInput[];
}

export interface ReceivableLineOption {
  id: string;
  purchaseOrderLineId?: string;
  productId?: string | null;
  productCode?: string | null;
  description?: string | null;
  productName?: string;
  quantity: string;
  orderedQuantity?: string;
  receivedQuantity?: string;
  pendingQuantity?: string;
  availableQuantity?: string;
  unitPrice?: string;
  location?: string | null;
}

export interface ReceiptLine {
  id?: string;
  purchaseOrderLineId: string;
  productId?: string | null;
  productCode?: string | null;
  description?: string | null;
  productName?: string;
  orderedQuantity?: string;
  quantity?: string;
  receivedQuantity?: string;
  location?: string | null;
  unitOfMeasure?: string | null;
}

export interface GoodsReceipt {
  id: string;
  organizationId?: string;
  receiptNumber?: string | null;
  purchaseOrderId: string;
  purchaseOrder?: PurchaseOrderOption | null;
  vendorId?: string;
  vendor?: VendorOption | null;
  status: ReceiptStatus;
  receiptDate: string;
  currencyCode: string;
  vendorReference?: string | null;
  notes?: string | null;
  total?: string;
  postedAt?: string | null;
  createdById?: string;
  updatedById?: string;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lines?: ReceiptLine[];
}

export interface GoodsReceiptWrite {
  purchaseOrderId: string;
  receiptDate: string;
  vendorReference?: string | null;
  notes?: string | null;
  lines: Array<{
    purchaseOrderLineId: string;
    receivedQuantity: string;
    location?: string | null;
  }>;
}

export interface BillLine extends DocumentLine {
  expenseAccount?: string | null;
}

export interface VendorBillPayment {
  id: string;
  paymentNumber?: string | null;
  paidDate?: string;
  amount: string;
  status?: VendorPaymentStatus;
}

export interface VendorBill {
  id: string;
  organizationId?: string;
  billNumber?: string | null;
  vendorId: string;
  vendor?: VendorOption | null;
  purchaseOrderId?: string | null;
  purchaseOrder?: PurchaseOrderOption | null;
  status: BillStatus;
  billDate: string;
  dueDate?: string | null;
  vendorReference?: string | null;
  currencyCode: string;
  paymentTermId?: string | null;
  paymentTerm?: PaymentTermRef | null;
  expenseAccount?: string | null;
  liabilityAccount?: string | null;
  subtotal?: string;
  discountTotal?: string;
  taxTotal?: string;
  total: string;
  amountPaid?: string;
  balance?: string;
  notes?: string | null;
  approvedAt?: string | null;
  voidedAt?: string | null;
  createdById?: string;
  updatedById?: string;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lines?: BillLine[];
  payments?: VendorBillPayment[];
  _count?: { lines?: number; payments?: number };
}

export interface BillOption {
  id: string;
  billNumber?: string | null;
  vendorId: string;
  vendor?: VendorOption | null;
  currencyCode: string;
  status: BillStatus;
  billDate?: string;
  dueDate?: string | null;
  total?: string;
  amountPaid?: string;
  pendingAmount?: string;
  availableBalance?: string;
  balance?: string;
}

export interface BillFormOptions {
  vendors: VendorOption[];
  currencies: CurrencyRef[];
  paymentTerms: PaymentTermRef[];
  taxCodes: TaxCodeOption[];
  products: ProductOption[];
  purchaseOrders: PurchaseOrderOption[];
  expenseAccounts: string[];
  liabilityAccounts: string[];
  statuses: Array<{ value: BillStatus; label: string }>;
}

export interface BillLineWrite extends DocumentLineInput {
  expenseAccount?: string;
}

export interface VendorBillWrite {
  vendorId: string;
  billDate: string;
  dueDate?: string | null;
  vendorReference?: string | null;
  currencyCode: string;
  paymentTermId?: string | null;
  expenseAccount?: string | null;
  liabilityAccount?: string | null;
  notes?: string | null;
  lines: BillLineWrite[];
}

export interface VendorBillCreate extends VendorBillWrite {
  purchaseOrderId?: string;
}

export interface PaymentAllocation {
  id?: string;
  billId: string;
  amount: string;
  bill?: BillOption | null;
}

export interface VendorPayment {
  id: string;
  organizationId?: string;
  paymentNumber?: string | null;
  vendorId: string;
  vendor?: VendorOption | null;
  paidDate: string;
  method: VendorPaymentMethod;
  amount: string;
  currencyCode: string;
  reference?: string | null;
  notes?: string | null;
  bankAccount?: string | null;
  status: VendorPaymentStatus;
  approvedAt?: string | null;
  paidAt?: string | null;
  createdById?: string;
  updatedById?: string;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  allocations?: PaymentAllocation[];
  _count?: { allocations?: number };
}

export interface VendorPaymentFormOptions {
  vendors: VendorOption[];
  currencies: CurrencyRef[];
  bills: BillOption[];
  methods: Array<{ value: VendorPaymentMethod; label: string }>;
  statuses: Array<{ value: VendorPaymentStatus; label: string }>;
}

export interface VendorPaymentWrite {
  vendorId: string;
  paidDate: string;
  method: VendorPaymentMethod;
  amount: string;
  currencyCode: string;
  reference?: string | null;
  notes?: string | null;
  bankAccount?: string | null;
  allocations: Array<{ billId: string; amount: string }>;
}

function data<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data as T);
}

export function listPurchaseOrders(params: Record<string, string | number | boolean | undefined>): Promise<Page<PurchaseOrder>> {
  return data(http.get<ApiSuccess<Page<PurchaseOrder>>>("/api/v1/purchasing/orders", { params }));
}

export function getPurchaseOrderFormOptions(): Promise<PurchaseOrderFormOptions> {
  return data(http.get<ApiSuccess<PurchaseOrderFormOptions>>("/api/v1/purchasing/orders/form-options")).then((options) => ({
    ...options,
    products: normalizeProductOptions(options.products as unknown as ProductOptionApi[]),
  }));
}

export function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  return data(http.get<ApiSuccess<PurchaseOrder>>(`/api/v1/purchasing/orders/${id}`));
}

export function createPurchaseOrder(body: PurchaseOrderWrite): Promise<PurchaseOrder> {
  return data(http.post("/api/v1/purchasing/orders", body));
}

export function createPurchaseOrderFromSalesOrder(body: CreatePurchaseOrderFromSalesOrderWrite): Promise<PurchaseOrder> {
  return data(http.post("/api/v1/purchasing/orders/from-sales-order", body));
}

export function updatePurchaseOrder(id: string, body: Partial<PurchaseOrderWrite>): Promise<PurchaseOrder> {
  return data(http.patch(`/api/v1/purchasing/orders/${id}`, body));
}

export function deletePurchaseOrder(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/purchasing/orders/${id}`));
}

export function restorePurchaseOrder(id: string): Promise<PurchaseOrder> {
  return data(http.post(`/api/v1/purchasing/orders/${id}/restore`));
}

export function changePurchaseOrderStatus(id: string, status: PurchaseOrderStatus, reason?: string): Promise<PurchaseOrder> {
  return data(http.post(`/api/v1/purchasing/orders/${id}/status`, { status, reason: reason || undefined }));
}

export function listGoodsReceipts(params: Record<string, string | number | boolean | undefined>): Promise<Page<GoodsReceipt>> {
  return data(http.get<ApiSuccess<Page<GoodsReceipt>>>("/api/v1/purchasing/receipts", { params }));
}

export function getPurchaseOrderReceiptOptions(id: string): Promise<PurchaseOrder> {
  return data(http.get<ApiSuccess<PurchaseOrder>>(`/api/v1/purchasing/orders/${id}`));
}

export function getGoodsReceipt(id: string): Promise<GoodsReceipt> {
  return data(http.get<ApiSuccess<GoodsReceipt>>(`/api/v1/purchasing/receipts/${id}`));
}

export function createGoodsReceipt(body: GoodsReceiptWrite): Promise<GoodsReceipt> {
  return data(http.post("/api/v1/purchasing/receipts", body));
}

export function postGoodsReceipt(id: string): Promise<GoodsReceipt> {
  return data(http.post(`/api/v1/purchasing/receipts/${id}/post`));
}

export function deleteGoodsReceipt(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/purchasing/receipts/${id}`));
}

export function restoreGoodsReceipt(id: string): Promise<GoodsReceipt> {
  return data(http.post(`/api/v1/purchasing/receipts/${id}/restore`));
}

export function listVendorBills(params: Record<string, string | number | boolean | undefined>): Promise<Page<VendorBill>> {
  return data(http.get<ApiSuccess<Page<VendorBill>>>("/api/v1/purchasing/bills", { params }));
}

export function getBillFormOptions(): Promise<BillFormOptions> {
  return data(http.get<ApiSuccess<BillFormOptions>>("/api/v1/purchasing/bills/form-options")).then((options) => ({
    ...options,
    products: normalizeProductOptions(options.products as unknown as ProductOptionApi[]),
  }));
}

export function getVendorBill(id: string): Promise<VendorBill> {
  return data(http.get<ApiSuccess<VendorBill>>(`/api/v1/purchasing/bills/${id}`));
}

export function createVendorBill(body: VendorBillCreate): Promise<VendorBill> {
  return data(http.post("/api/v1/purchasing/bills", body));
}

export function updateVendorBill(id: string, body: Partial<VendorBillWrite>): Promise<VendorBill> {
  return data(http.patch(`/api/v1/purchasing/bills/${id}`, body));
}

export function approveVendorBill(id: string): Promise<VendorBill> {
  return data(http.post(`/api/v1/purchasing/bills/${id}/approve`));
}

export function voidVendorBill(id: string): Promise<VendorBill> {
  return data(http.post(`/api/v1/purchasing/bills/${id}/void`));
}

export function deleteVendorBill(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/purchasing/bills/${id}`));
}

export function restoreVendorBill(id: string): Promise<VendorBill> {
  return data(http.post(`/api/v1/purchasing/bills/${id}/restore`));
}

export function listVendorPayments(params: Record<string, string | number | boolean | undefined>): Promise<Page<VendorPayment>> {
  return data(http.get<ApiSuccess<Page<VendorPayment>>>("/api/v1/purchasing/payments", { params }));
}

export function getVendorPaymentFormOptions(): Promise<VendorPaymentFormOptions> {
  return data(http.get<ApiSuccess<VendorPaymentFormOptions>>("/api/v1/purchasing/payments/form-options"));
}

export function getVendorPayment(id: string): Promise<VendorPayment> {
  return data(http.get<ApiSuccess<VendorPayment>>(`/api/v1/purchasing/payments/${id}`));
}

export function createVendorPayment(body: VendorPaymentWrite): Promise<VendorPayment> {
  return data(http.post("/api/v1/purchasing/payments", body));
}

export function updateVendorPayment(id: string, body: Partial<VendorPaymentWrite>): Promise<VendorPayment> {
  return data(http.patch(`/api/v1/purchasing/payments/${id}`, body));
}

export function approveVendorPayment(id: string): Promise<VendorPayment> {
  return data(http.post(`/api/v1/purchasing/payments/${id}/approve`));
}

export function deleteVendorPayment(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/purchasing/payments/${id}`));
}

export function restoreVendorPayment(id: string): Promise<VendorPayment> {
  return data(http.post(`/api/v1/purchasing/payments/${id}/restore`));
}

import { DocumentType, Prisma, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { ValidationFailedError } from "../../common/errors/app-error";
import { allocateDocumentNumberIn } from "../../common/numbering/allocate";
import { createdAtRange } from "../../common/pagination/list-query";
import { cursorFilter, decodeCursor, toCursorPage } from "../../common/pagination/cursor";
import { applyInventoryMovement } from "../inventory/valuation";
import { applyVendorBillPaymentDelta } from "./money";
import { assertPurchaseOrderTransition } from "./types";
import type {
  OrderListQuery,
  ReceiptListQuery,
  BillListQuery,
  PaymentListQuery,
} from "./validation";
import type {
  GoodsReceiptStatusValue,
  PurchaseOrderStatusValue,
  VendorBillStatusValue,
  VendorPaymentMethodValue,
  VendorPaymentStatusValue,
} from "./types";

export type DecimalLike = string | number | { toString(): string };

interface ModelDelegate {
  findMany(args?: Record<string, unknown>): Promise<unknown[]>;
  findFirst(args?: Record<string, unknown>): Promise<unknown>;
  findUnique(args?: Record<string, unknown>): Promise<unknown>;
  aggregate(args?: Record<string, unknown>): Promise<unknown>;
  create(args?: Record<string, unknown>): Promise<unknown>;
  createMany(args?: Record<string, unknown>): Promise<unknown>;
  update(args?: Record<string, unknown>): Promise<unknown>;
  updateMany(args?: Record<string, unknown>): Promise<{ count: number }>;
  deleteMany(args?: Record<string, unknown>): Promise<{ count: number }>;
  upsert(args?: Record<string, unknown>): Promise<unknown>;
}

interface PurchasingDb {
  purchaseOrder: ModelDelegate;
  purchaseOrderLine: ModelDelegate;
  goodsReceipt: ModelDelegate;
  goodsReceiptLine: ModelDelegate;
  vendorBill: ModelDelegate;
  vendorBillLine: ModelDelegate;
  vendorPayment: ModelDelegate;
  vendorPaymentAllocation: ModelDelegate;
  inventoryMovement: ModelDelegate;
  inventoryBalance: ModelDelegate;
  vendor: ModelDelegate;
  product: ModelDelegate;
  taxCode: ModelDelegate;
  paymentTerm: ModelDelegate;
  currency: ModelDelegate;
  exchangeRate: ModelDelegate;
  organization: ModelDelegate;
  salesOrder: ModelDelegate;
  salesOrderLine: ModelDelegate;
  user: ModelDelegate;
}

export interface VendorSummary {
  id: string;
  status: string;
  vendorNumber?: string;
  code?: string | null;
  name?: string;
  displayName?: string;
  currencyCode?: string;
  paymentTermId?: string | null;
}

export interface ProductSummary {
  id: string;
  code?: string;
  name?: string;
  taxCodeId?: string | null;
  unitOfMeasure?: { code: string } | null;
  taxCode?: { id: string; code: string; rate: DecimalLike } | null;
  receivingLocation?: string | null;
  deliveryLocation?: string | null;
  trackInventory?: boolean;
  weightedAveragePrice?: DecimalLike;
  allowNegativeStock?: boolean;
}

export interface SalesOrderPurchaseLine {
  id: string;
  productId: string | null;
  productCode: string | null;
  productName: string;
  description: string | null;
  unitOfMeasure: string | null;
  quantity: DecimalLike;
  fulfilledQuantity: DecimalLike;
  unitPrice: DecimalLike;
  taxCodeId: string | null;
  taxCode: string | null;
  taxRate: DecimalLike;
}

export interface SalesOrderPurchaseSource {
  id: string;
  salesOrderNumber: string;
  status: string;
  currencyCode: string;
  lines: SalesOrderPurchaseLine[];
}

export interface TaxCodeSummary {
  id: string;
  code: string;
  rate: DecimalLike;
}

export interface LineSnapshot {
  productId: string | null;
  productCode: string | null;
  productName: string;
  description?: string | null;
  unitOfMeasure?: string | null;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxCodeId: string | null;
  taxCode: string | null;
  taxRate: string;
  lineSubtotal: string;
  lineDiscount: string;
  lineTax: string;
  lineTotal: string;
  sourceSalesOrderLineId?: string | null;
  sortOrder: number;
}

export interface OrderLineRow extends LineSnapshot {
  id: string;
  receivedQuantity: DecimalLike;
  billedQuantity: DecimalLike;
}

export interface OrderSummaryRow {
  id: string;
  receiptNumber?: string | null;
  status: string;
  receiptDate?: Date;
  billNumber?: string | null;
  billDate?: Date;
  total?: DecimalLike;
  amountPaid?: DecimalLike;
}

export interface OrderRow {
  id: string;
  organizationId: string;
  purchaseOrderNumber: string;
  vendorId: string;
  sourceSalesOrderId: string | null;
  ownerUserId: string;
  status: PurchaseOrderStatusValue;
  orderDate: Date;
  expectedDeliveryDate: Date | null;
  vendorReference: string | null;
  currencyCode: string;
  exchangeRateToBase: DecimalLike | null;
  baseCurrencyCode: string | null;
  paymentTermId: string | null;
  subtotal: DecimalLike;
  discountTotal: DecimalLike;
  taxTotal: DecimalLike;
  total: DecimalLike;
  totalBase: DecimalLike | null;
  amountReceived: DecimalLike;
  amountBilled: DecimalLike;
  notes: string | null;
  terms: string | null;
  createdById: string;
  updatedById: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  vendor?: VendorSummary | null;
  lines: OrderLineRow[];
  receipts?: OrderSummaryRow[];
  bills?: OrderSummaryRow[];
}

export interface ReceiptLineRow {
  id: string;
  purchaseOrderLineId: string;
  productId: string | null;
  productCode: string | null;
  productName: string;
  description: string | null;
  unitOfMeasure: string | null;
  orderedQuantity: DecimalLike;
  receivedQuantity: DecimalLike;
  unitCost: DecimalLike;
  lineTotal: DecimalLike;
  location: string;
  sortOrder: number;
}

export interface ReceiptRow {
  id: string;
  organizationId: string;
  receiptNumber: string;
  purchaseOrderId: string;
  vendorId: string;
  status: GoodsReceiptStatusValue;
  receiptDate: Date;
  vendorReference: string | null;
  currencyCode: string;
  notes: string | null;
  postedAt: Date | null;
  createdById: string;
  updatedById: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: ReceiptLineRow[];
  purchaseOrder?: OrderRow | null;
}

export interface BillLineRow extends LineSnapshot {
  id: string;
  receivedQuantity?: DecimalLike;
  billedQuantity?: DecimalLike;
}

export interface BillRow {
  id: string;
  organizationId: string;
  billNumber: string;
  purchaseOrderId: string | null;
  vendorId: string;
  ownerUserId: string;
  status: VendorBillStatusValue;
  billDate: Date;
  dueDate: Date | null;
  vendorReference: string | null;
  currencyCode: string;
  exchangeRateToBase: DecimalLike | null;
  baseCurrencyCode: string | null;
  paymentTermId: string | null;
  expenseAccount: string | null;
  liabilityAccount: string | null;
  subtotal: DecimalLike;
  discountTotal: DecimalLike;
  taxTotal: DecimalLike;
  total: DecimalLike;
  totalBase: DecimalLike | null;
  amountPaid: DecimalLike;
  notes: string | null;
  createdById: string;
  updatedById: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: BillLineRow[];
  purchaseOrder?: OrderRow | null;
  vendor?: VendorSummary | null;
  payments?: Array<{
    id: string;
    paymentNumber?: string | null;
    status?: string;
    paidDate?: Date;
    amount?: DecimalLike;
    currencyCode?: string;
  }>;
}

export interface AllocationRow {
  id: string;
  billId: string;
  amount: DecimalLike;
  bill?: Pick<BillRow, "id" | "billNumber" | "status" | "total" | "amountPaid" | "vendorId" | "currencyCode"> | null;
}

export interface PaymentRow {
  id: string;
  organizationId: string;
  paymentNumber: string;
  vendorId: string;
  paidDate: Date;
  method: VendorPaymentMethodValue;
  amount: DecimalLike;
  currencyCode: string;
  reference: string | null;
  notes: string | null;
  status: VendorPaymentStatusValue;
  bankAccount: string | null;
  createdById: string;
  updatedById: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  allocations: AllocationRow[];
  vendor?: VendorSummary | null;
}

export interface OrderWriteData {
  vendorId: string;
  sourceSalesOrderId?: string | null;
  ownerUserId: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  vendorReference?: string | null;
  currencyCode: string;
  exchangeRateToBase?: string | null;
  baseCurrencyCode?: string | null;
  paymentTermId?: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  totalBase?: string | null;
  notes?: string | null;
  terms?: string | null;
  lines: LineSnapshot[];
}

export interface ReceiptWriteData {
  purchaseOrderId: string;
  vendorId: string;
  receiptDate: string;
  vendorReference?: string | null;
  currencyCode: string;
  notes?: string | null;
  lines: Array<{
    purchaseOrderLineId: string;
    productId: string | null;
    productCode: string | null;
    productName: string;
    description: string | null;
    unitOfMeasure: string | null;
    orderedQuantity: string;
    receivedQuantity: string;
    unitCost: string;
    lineTotal: string;
    location: string;
    sortOrder: number;
  }>;
}

export interface BillWriteData {
  purchaseOrderId?: string | null;
  vendorId: string;
  ownerUserId: string;
  billDate: string;
  dueDate?: string | null;
  vendorReference?: string | null;
  currencyCode: string;
  exchangeRateToBase?: string | null;
  baseCurrencyCode?: string | null;
  paymentTermId?: string | null;
  expenseAccount?: string | null;
  liabilityAccount?: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  totalBase?: string | null;
  notes?: string | null;
  lines: LineSnapshot[];
}

export interface PaymentWriteData {
  vendorId: string;
  paidDate: string;
  method: VendorPaymentMethodValue;
  amount: string;
  currencyCode: string;
  reference?: string | null;
  notes?: string | null;
  bankAccount?: string | null;
  allocations: Array<{ billId: string; amount: string }>;
}

export interface InventoryMovementWrite {
  organizationId: string;
  productId: string;
  movementType: "PURCHASE_RECEIPT" | "SALE";
  quantity: string;
  unitCost: string;
  location: string;
  referenceType: string;
  referenceId: string;
  balanceAfter: string;
  createdById: string;
}

export interface InventoryBalanceWrite {
  organizationId: string;
  productId: string;
  location: string;
  quantity: string;
  averageCost: string;
}

export interface ReceiptPostingPayload {
  status: PurchaseOrderStatusValue;
  amountReceived: string;
  lineUpdates: Array<{ id: string; receivedQuantity: string }>;
  receiptLines: Array<{
    purchaseOrderLineId: string;
    productId: string;
    receivedQuantity: string;
    unitCost: string;
    location: string;
  }>;
}

export interface BillApprovalPayload {
  amountBilled: string;
  lineUpdates: Array<{ id: string; billedQuantity: string }>;
}

function db(client: PrismaClient | Prisma.TransactionClient): PurchasingDb {
  return client as unknown as PurchasingDb;
}

function documentType(value: string): DocumentType {
  return value as unknown as DocumentType;
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const receiptSummarySelect = {
  id: true,
  receiptNumber: true,
  status: true,
  receiptDate: true,
  postedAt: true,
  lines: { select: { lineTotal: true } },
};

const billSummarySelect = {
  id: true,
  billNumber: true,
  status: true,
  billDate: true,
  dueDate: true,
  total: true,
  amountPaid: true,
};

const orderListSelect = {
  id: true,
  organizationId: true,
  purchaseOrderNumber: true,
  vendorId: true,
  sourceSalesOrderId: true,
  ownerUserId: true,
  status: true,
  orderDate: true,
  expectedDeliveryDate: true,
  vendorReference: true,
  currencyCode: true,
  subtotal: true,
  discountTotal: true,
  taxTotal: true,
  total: true,
  totalBase: true,
  amountReceived: true,
  amountBilled: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  vendor: { select: { id: true, vendorNumber: true, displayName: true, status: true, currencyCode: true } },
  receipts: { select: receiptSummarySelect, orderBy: { receiptDate: "desc" } },
  bills: { select: billSummarySelect, orderBy: { billDate: "desc" } },
  _count: { select: { lines: true, receipts: true, bills: true } },
};

const orderLineSelect = {
  id: true,
  productId: true,
  productCode: true,
  productName: true,
  description: true,
  unitOfMeasure: true,
  quantity: true,
  unitPrice: true,
  discountPercent: true,
  taxCodeId: true,
  taxCode: true,
  taxRate: true,
  lineSubtotal: true,
  lineDiscount: true,
  lineTax: true,
  lineTotal: true,
  receivedQuantity: true,
  billedQuantity: true,
  sourceSalesOrderLineId: true,
  sortOrder: true,
};

const billLineSelect = {
  id: true,
  productId: true,
  productCode: true,
  productName: true,
  description: true,
  unitOfMeasure: true,
  quantity: true,
  unitPrice: true,
  discountPercent: true,
  taxCodeId: true,
  taxCode: true,
  taxRate: true,
  lineSubtotal: true,
  lineDiscount: true,
  lineTax: true,
  lineTotal: true,
  sortOrder: true,
};

const receiptListSelect = {
  id: true,
  organizationId: true,
  receiptNumber: true,
  purchaseOrderId: true,
  vendorId: true,
  status: true,
  receiptDate: true,
  vendorReference: true,
  currencyCode: true,
  notes: true,
  postedAt: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  purchaseOrder: { select: { id: true, purchaseOrderNumber: true, status: true } },
  _count: { select: { lines: true } },
};

const billListSelect = {
  id: true,
  organizationId: true,
  billNumber: true,
  purchaseOrderId: true,
  vendorId: true,
  ownerUserId: true,
  status: true,
  billDate: true,
  dueDate: true,
  vendorReference: true,
  currencyCode: true,
  subtotal: true,
  discountTotal: true,
  taxTotal: true,
  total: true,
  totalBase: true,
  amountPaid: true,
  notes: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  vendor: { select: { id: true, vendorNumber: true, displayName: true, status: true } },
  purchaseOrder: { select: { id: true, purchaseOrderNumber: true, status: true } },
  _count: { select: { lines: true } },
};

const paymentListSelect = {
  id: true,
  organizationId: true,
  paymentNumber: true,
  vendorId: true,
  paidDate: true,
  method: true,
  amount: true,
  currencyCode: true,
  reference: true,
  notes: true,
  status: true,
  bankAccount: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  vendor: { select: { id: true, vendorNumber: true, displayName: true, status: true } },
  _count: { select: { allocations: true } },
};

const paymentSummarySelect = {
  id: true,
  paymentNumber: true,
  status: true,
  paidDate: true,
  amount: true,
  currencyCode: true,
};

function toDecimal(value: DecimalLike | null | undefined): Prisma.Decimal {
  return new Prisma.Decimal(value === null || value === undefined ? 0 : value.toString());
}

function mapOrderSummaries<T extends OrderRow>(row: T): T {
  return {
    ...row,
    receipts: (row.receipts ?? []).map((receipt) => {
      const { lines, ...summary } = receipt as OrderSummaryRow & { lines?: Array<{ lineTotal: DecimalLike }> };
      return {
        ...summary,
        total: sumDecimal((lines ?? []).map((line) => line.lineTotal)),
      };
    }),
    bills: row.bills ?? [],
  };
}

function sumDecimal(values: DecimalLike[]): string {
  return values
    .reduce<Prisma.Decimal>((sum, value) => sum.add(toDecimal(value)), new Prisma.Decimal(0))
    .toFixed(4);
}

function mapBillLines(
  lines: BillLineRow[],
  orderLines: Array<{ productId: string | null; receivedQuantity: DecimalLike; billedQuantity: DecimalLike }>,
): BillLineRow[] {
  if (orderLines.length === 0) {
    return lines;
  }
  return lines.map((line) => {
    const matches = orderLines.filter((orderLine) => orderLine.productId && orderLine.productId === line.productId);
    return {
      ...line,
      receivedQuantity: sumDecimal(matches.map((orderLine) => orderLine.receivedQuantity)),
      billedQuantity: sumDecimal(matches.map((orderLine) => orderLine.billedQuantity)),
    };
  });
}

export class PurchasingRepository extends BaseRepository {
  constructor(client: PrismaClient) {
    super(client);
  }

  async listOrders(organizationId: string, query: OrderListQuery) {
    const decoded = query.cursor ? decodeCursor(query.cursor) : null;
    const range = createdAtRange(query.from, query.to);
    const rows = (await db(this.db).purchaseOrder.findMany({
      where: {
        organizationId,
        ...(query.includeDeleted ? {} : { deletedAt: null }),
        ...(query.status ? { status: query.status } : {}),
        ...(query.vendorId ? { vendorId: query.vendorId } : {}),
        ...(range ? { createdAt: range } : {}),
        ...(decoded || query.q
          ? {
              AND: [
                ...(decoded ? [cursorFilter(decoded, query.order)] : []),
                ...(query.q
                  ? [
                      {
                        OR: [
                          { purchaseOrderNumber: { contains: query.q, mode: "insensitive" } },
                          { vendorReference: { contains: query.q, mode: "insensitive" } },
                          { vendor: { displayName: { contains: query.q, mode: "insensitive" } } },
                        ],
                      },
                    ]
                  : []),
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: query.order }, { id: query.order }],
      take: query.limit + 1,
      select: orderListSelect,
    })) as OrderRow[];
    return toCursorPage(rows.map(mapOrderSummaries), query.limit);
  }

  async findOrder(
    organizationId: string,
    id: string,
    includeDeleted = false,
    client: PrismaClient | Prisma.TransactionClient = this.db,
  ) {
    const row = (await db(client).purchaseOrder.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: {
        ...orderListSelect,
        exchangeRateToBase: true,
        baseCurrencyCode: true,
        paymentTermId: true,
        notes: true,
        terms: true,
        lines: { orderBy: { sortOrder: "asc" }, select: orderLineSelect },
      },
    })) as OrderRow | null;
    return row ? mapOrderSummaries(row) : null;
  }

  async findVendor(organizationId: string, vendorId: string) {
    return (await db(this.db).vendor.findFirst({
      where: { id: vendorId, organizationId, deletedAt: null },
      select: {
        id: true,
        vendorNumber: true,
        displayName: true,
        status: true,
        currencyCode: true,
        paymentTermId: true,
      },
    })) as VendorSummary | null;
  }

  async findOrganization(organizationId: string) {
    return (await db(this.db).organization.findUnique({
      where: { id: organizationId },
      select: { baseCurrencyCode: true },
    })) as { baseCurrencyCode: string } | null;
  }

  async currencyIsActive(code: string): Promise<boolean> {
    const row = (await db(this.db).currency.findUnique({
      where: { code },
      select: { isActive: true },
    })) as { isActive: boolean } | null;
    return row?.isActive === true;
  }

  async findExchangeRateValue(
    organizationId: string,
    baseCurrencyCode: string,
    quoteCurrencyCode: string,
    asOf = new Date(),
  ): Promise<string | null> {
    const row = (await db(this.db).exchangeRate.findFirst({
      where: {
        organizationId,
        baseCurrencyCode,
        quoteCurrencyCode,
        isActive: true,
        effectiveDate: { lte: asOf },
      },
      orderBy: { effectiveDate: "desc" },
      select: { rate: true },
    })) as { rate: DecimalLike } | null;
    return row ? row.rate.toString() : null;
  }

  async findPaymentTerm(organizationId: string, paymentTermId: string) {
    return (await db(this.db).paymentTerm.findFirst({
      where: { id: paymentTermId, organizationId, isActive: true },
      select: { id: true, code: true, name: true, dueDays: true },
    })) as { id: string; dueDays: number } | null;
  }

  async findActiveOrgUser(organizationId: string, userId: string) {
    return (await db(this.db).user.findFirst({
      where: { id: userId, status: "ACTIVE", memberships: { some: { organizationId, status: "ACTIVE" } } },
      select: { id: true },
    })) as { id: string } | null;
  }

  async findProductsByIds(organizationId: string, ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    return (await db(this.db).product.findMany({
      where: { id: { in: ids }, organizationId, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        taxCodeId: true,
        receivingLocation: true,
        unitOfMeasure: { select: { code: true } },
        taxCode: { select: { id: true, code: true, rate: true } },
      },
    })) as ProductSummary[];
  }

  async findSalesOrderForPurchase(organizationId: string, id: string) {
    return (await db(this.db).salesOrder.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: {
        id: true,
        salesOrderNumber: true,
        status: true,
        currencyCode: true,
        lines: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            productId: true,
            productCode: true,
            productName: true,
            description: true,
            unitOfMeasure: true,
            quantity: true,
            fulfilledQuantity: true,
            unitPrice: true,
            taxCodeId: true,
            taxCode: true,
            taxRate: true,
          },
        },
      },
    })) as SalesOrderPurchaseSource | null;
  }

  async sumInventoryByProducts(organizationId: string, productIds: string[]) {
    if (productIds.length === 0) {
      return [];
    }
    const rows = (await db(this.db).inventoryBalance.findMany({
      where: { organizationId, productId: { in: productIds } },
      select: { productId: true, quantity: true },
    })) as Array<{ productId: string; quantity: DecimalLike }>;
    const totals = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      const current = totals.get(row.productId) ?? new Prisma.Decimal(0);
      totals.set(row.productId, current.add(new Prisma.Decimal(row.quantity.toString())));
    }
    return [...totals.entries()].map(([productId, quantity]) => ({ productId, quantity: quantity.toFixed(4) }));
  }

  async findTaxCodesByIds(organizationId: string, ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    return (await db(this.db).taxCode.findMany({
      where: { id: { in: ids }, organizationId },
      select: { id: true, code: true, rate: true },
    })) as TaxCodeSummary[];
  }

  async formOptions(organizationId: string) {
    const [vendors, products, currencies, paymentTerms, taxCodes, owners, orders, bills] = (await Promise.all([
      db(this.db).vendor.findMany({
        where: { organizationId, deletedAt: null, status: "ACTIVE" },
        orderBy: { displayName: "asc" },
        take: 500,
        select: {
          id: true,
          vendorNumber: true,
          code: true,
          name: true,
          displayName: true,
          status: true,
          currencyCode: true,
          paymentTermId: true,
        },
      }),
      db(this.db).product.findMany({
        where: { organizationId, deletedAt: null, status: "ACTIVE" },
        orderBy: { name: "asc" },
        take: 500,
        select: {
          id: true,
          code: true,
          name: true,
          taxCodeId: true,
          receivingLocation: true,
          deliveryLocation: true,
          trackInventory: true,
          weightedAveragePrice: true,
          allowNegativeStock: true,
          unitOfMeasure: { select: { code: true } },
          taxCode: { select: { id: true, code: true, rate: true } },
        },
      }),
      db(this.db).currency.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
        select: { code: true, name: true, symbol: true },
      }),
      db(this.db).paymentTerm.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true, dueDays: true },
      }),
      db(this.db).taxCode.findMany({
        where: { organizationId, isActive: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true, rate: true },
      }),
      db(this.db).user.findMany({
        where: { status: "ACTIVE", memberships: { some: { organizationId, status: "ACTIVE" } } },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      db(this.db).purchaseOrder.findMany({
        where: {
          organizationId,
          deletedAt: null,
          status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED", "RECEIVED", "BILLED"] },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          purchaseOrderNumber: true,
          vendorId: true,
          status: true,
          currencyCode: true,
          total: true,
          amountReceived: true,
          amountBilled: true,
        },
      }),
      db(this.db).vendorBill.findMany({
        where: { organizationId, deletedAt: null, status: { in: ["APPROVED", "PARTIALLY_PAID"] } },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          billNumber: true,
          vendorId: true,
          status: true,
          currencyCode: true,
          total: true,
          amountPaid: true,
          dueDate: true,
        },
      }),
    ])) as [
      VendorSummary[],
      ProductSummary[],
      Array<{ code: string; name: string; symbol: string }>,
      Array<{ id: string; code: string; name: string; dueDays: number }>,
      Array<{ id: string; code: string; name: string; rate: DecimalLike }>,
      Array<{ id: string; firstName: string; lastName: string; email: string }>,
      Array<{ id: string; purchaseOrderNumber: string; vendorId: string; status: string; total: DecimalLike }>,
      Array<{ id: string; billNumber: string; vendorId: string; status: string; total: DecimalLike; amountPaid: DecimalLike }>,
    ];

    const orderIds = orders.map((order) => order.id);
    const orderLines = orderIds.length
      ? ((await db(this.db).purchaseOrderLine.findMany({
          where: { organizationId, purchaseOrderId: { in: orderIds } },
          orderBy: [{ purchaseOrderId: "asc" }, { sortOrder: "asc" }],
          select: {
            id: true,
            purchaseOrderId: true,
            productId: true,
            productCode: true,
            productName: true,
            description: true,
            unitOfMeasure: true,
            quantity: true,
            receivedQuantity: true,
            unitPrice: true,
            sortOrder: true,
          },
        })) as Array<{
          id: string;
          purchaseOrderId: string;
          productId: string | null;
          productCode: string | null;
          productName: string;
          description: string | null;
          unitOfMeasure: string | null;
          quantity: DecimalLike;
          receivedQuantity: DecimalLike;
          unitPrice: DecimalLike;
          sortOrder: number;
        }>)
      : [];
    const pendingReceipts = await this.sumPendingReceiptQuantities(
      organizationId,
      orderLines.map((line) => line.id),
    );
    const mappedOrderLines = orderLines.map((line) => {
      const pendingQuantity = pendingReceipts.get(line.id) ?? "0.0000";
      return {
        ...line,
        pendingQuantity,
        availableQuantity: toDecimal(line.quantity)
          .sub(toDecimal(line.receivedQuantity))
          .sub(toDecimal(pendingQuantity))
          .toFixed(4),
      };
    });
    const linesByOrder = new Map<string, typeof mappedOrderLines>();
    for (const line of mappedOrderLines) {
      const lines = linesByOrder.get(line.purchaseOrderId) ?? [];
      lines.push(line);
      linesByOrder.set(line.purchaseOrderId, lines);
    }

    const billIds = bills.map((bill) => bill.id);
    const pendingPayments = await this.sumPendingAllocations(organizationId, billIds);
    const mappedBills = bills.map((bill) => {
      const pendingAmount = pendingPayments.get(bill.id) ?? "0.0000";
      const balance = toDecimal(bill.total).sub(toDecimal(bill.amountPaid));
      return {
        ...bill,
        pendingAmount,
        availableBalance: balance.sub(toDecimal(pendingAmount)).toFixed(4),
      };
    });

    return {
      vendors,
      products: products.map((product) => ({
        ...product,
        unitOfMeasure: product.unitOfMeasure?.code ?? null,
        taxCode: product.taxCode?.code ?? null,
        taxRate: product.taxCode?.rate.toString() ?? "0",
      })),
      currencies,
      paymentTerms,
      taxCodes,
      owners,
      orders: orders.map((order) => ({ ...order, lines: linesByOrder.get(order.id) ?? [] })),
      orderLines: mappedOrderLines,
      bills: mappedBills,
    };
  }

  async createOrder(organizationId: string, actorId: string, input: OrderWriteData) {
    return this.transaction(async (tx) => {
      const client = db(tx);
      const purchaseOrderNumber = await allocateDocumentNumberIn(tx, organizationId, documentType("PURCHASE_ORDER"));
      const created = (await client.purchaseOrder.create({
        data: {
          organizationId,
          purchaseOrderNumber,
          vendorId: input.vendorId,
          sourceSalesOrderId: input.sourceSalesOrderId ?? null,
          ownerUserId: input.ownerUserId,
          status: "DRAFT",
          orderDate: dateOnly(input.orderDate),
          expectedDeliveryDate: input.expectedDeliveryDate ? dateOnly(input.expectedDeliveryDate) : null,
          vendorReference: input.vendorReference ?? null,
          currencyCode: input.currencyCode,
          exchangeRateToBase: input.exchangeRateToBase ?? null,
          baseCurrencyCode: input.baseCurrencyCode ?? null,
          paymentTermId: input.paymentTermId ?? null,
          subtotal: input.subtotal,
          discountTotal: input.discountTotal,
          taxTotal: input.taxTotal,
          total: input.total,
          totalBase: input.totalBase ?? null,
          notes: input.notes ?? null,
          terms: input.terms ?? null,
          createdById: actorId,
          updatedById: actorId,
          lines: { create: input.lines.map((line) => ({ ...line, organizationId })) },
        },
        select: { id: true },
      })) as { id: string };
      return this.findOrder(organizationId, created.id, false, tx);
    });
  }

  async updateOrder(organizationId: string, id: string, actorId: string, input: OrderWriteData) {
    const updated = await this.transaction(async (tx) => {
      const client = db(tx);
      const existing = (await client.purchaseOrder.findFirst({
        where: { id, organizationId, deletedAt: null, status: "DRAFT" },
        select: { id: true },
      })) as { id: string } | null;
      if (!existing) {
        return false;
      }
      await client.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id, organizationId } });
      await client.purchaseOrder.update({
        where: { id },
        data: {
          vendorId: input.vendorId,
          ownerUserId: input.ownerUserId,
          orderDate: dateOnly(input.orderDate),
          expectedDeliveryDate: input.expectedDeliveryDate ? dateOnly(input.expectedDeliveryDate) : null,
          vendorReference: input.vendorReference ?? null,
          currencyCode: input.currencyCode,
          exchangeRateToBase: input.exchangeRateToBase ?? null,
          baseCurrencyCode: input.baseCurrencyCode ?? null,
          paymentTermId: input.paymentTermId ?? null,
          subtotal: input.subtotal,
          discountTotal: input.discountTotal,
          taxTotal: input.taxTotal,
          total: input.total,
          totalBase: input.totalBase ?? null,
          notes: input.notes ?? null,
          terms: input.terms ?? null,
          updatedById: actorId,
          lines: { create: input.lines.map((line) => ({ ...line, organizationId })) },
        },
      });
      return true;
    });
    return updated ? this.findOrder(organizationId, id) : null;
  }

  async softDeleteOrder(organizationId: string, id: string, actorId: string) {
    const result = await db(this.db).purchaseOrder.updateMany({
      where: { id, organizationId, deletedAt: null, status: "DRAFT" },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
  }

  async restoreOrder(organizationId: string, id: string, actorId: string) {
    const result = await db(this.db).purchaseOrder.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null, updatedById: actorId },
    });
    return result.count === 1;
  }

  async changeOrderStatus(
    organizationId: string,
    id: string,
    actorId: string,
    status: PurchaseOrderStatusValue,
  ) {
    const now = new Date();
    const result = await db(this.db).purchaseOrder.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: {
        status,
        updatedById: actorId,
        ...(status === "APPROVED" ? { approvedAt: now } : {}),
        ...(status === "SENT" ? { sentAt: now } : {}),
        ...(status === "CLOSED" ? { closedAt: now } : {}),
        ...(status === "CANCELLED" ? { cancelledAt: now } : {}),
      },
    });
    return result.count === 1;
  }

  async listReceipts(organizationId: string, query: ReceiptListQuery) {
    const decoded = query.cursor ? decodeCursor(query.cursor) : null;
    const range = createdAtRange(query.from, query.to);
    const rows = (await db(this.db).goodsReceipt.findMany({
      where: {
        organizationId,
        ...(query.includeDeleted ? {} : { deletedAt: null }),
        ...(query.status ? { status: query.status } : {}),
        ...(query.vendorId ? { vendorId: query.vendorId } : {}),
        ...(query.purchaseOrderId ? { purchaseOrderId: query.purchaseOrderId } : {}),
        ...(range ? { createdAt: range } : {}),
        ...(decoded || query.q
          ? {
              AND: [
                ...(decoded ? [cursorFilter(decoded, query.order)] : []),
                ...(query.q
                  ? [
                      {
                        OR: [
                          { receiptNumber: { contains: query.q, mode: "insensitive" } },
                          { vendorReference: { contains: query.q, mode: "insensitive" } },
                        ],
                      },
                    ]
                  : []),
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: query.order }, { id: query.order }],
      take: query.limit + 1,
      select: receiptListSelect,
    })) as ReceiptRow[];
    return toCursorPage(rows, query.limit);
  }

  async findReceipt(
    organizationId: string,
    id: string,
    includeDeleted = false,
    client: PrismaClient | Prisma.TransactionClient = this.db,
  ) {
    return (await db(client).goodsReceipt.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: {
        ...receiptListSelect,
        notes: true,
        lines: { orderBy: { sortOrder: "asc" }, select: { id: true, purchaseOrderLineId: true, productId: true, productCode: true, productName: true, description: true, unitOfMeasure: true, orderedQuantity: true, receivedQuantity: true, unitCost: true, lineTotal: true, location: true, sortOrder: true } },
      },
    })) as ReceiptRow | null;
  }

  async sumPendingReceiptQuantities(
    organizationId: string,
    purchaseOrderLineIds: string[],
    excludeReceiptId?: string,
  ) {
    if (purchaseOrderLineIds.length === 0) {
      return new Map<string, string>();
    }
    const rows = (await db(this.db).goodsReceiptLine.findMany({
      where: {
        purchaseOrderLineId: { in: purchaseOrderLineIds },
        goodsReceipt: {
          organizationId,
          status: "DRAFT",
          deletedAt: null,
          ...(excludeReceiptId ? { id: { not: excludeReceiptId } } : {}),
        },
      },
      select: { purchaseOrderLineId: true, receivedQuantity: true },
    })) as Array<{ purchaseOrderLineId: string; receivedQuantity: DecimalLike }>;

    const result = new Map<string, string>();
    for (const row of rows) {
      const current = result.get(row.purchaseOrderLineId) ?? "0";
      result.set(row.purchaseOrderLineId, toDecimal(current).add(toDecimal(row.receivedQuantity)).toFixed(4));
    }
    return result;
  }

  async createReceipt(organizationId: string, actorId: string, input: ReceiptWriteData) {
    return this.transaction(async (tx) => {
      const client = db(tx);
      const receiptNumber = await allocateDocumentNumberIn(tx, organizationId, documentType("GOODS_RECEIPT"));
      const created = (await client.goodsReceipt.create({
        data: {
          organizationId,
          receiptNumber,
          purchaseOrderId: input.purchaseOrderId,
          vendorId: input.vendorId,
          status: "DRAFT",
          receiptDate: dateOnly(input.receiptDate),
          vendorReference: input.vendorReference ?? null,
          currencyCode: input.currencyCode,
          notes: input.notes ?? null,
          createdById: actorId,
          updatedById: actorId,
          lines: { create: input.lines.map((line) => ({ ...line, organizationId })) },
        },
        select: { id: true },
      })) as { id: string };
      return this.findReceipt(organizationId, created.id, false, tx);
    });
  }

  async findBalance(organizationId: string, productId: string, location: string) {
    return (await db(this.db).inventoryBalance.findFirst({
      where: { organizationId, productId, location },
      select: { quantity: true, averageCost: true },
    })) as { quantity: DecimalLike; averageCost: DecimalLike } | null;
  }

  async postReceipt(organizationId: string, actorId: string, id: string, payload: ReceiptPostingPayload) {
    return this.transaction(async (tx) => {
      const client = db(tx);
      const receipt = (await client.goodsReceipt.findFirst({
        where: { id, organizationId, deletedAt: null, status: "DRAFT" },
        select: { id: true, purchaseOrderId: true },
      })) as { id: string; purchaseOrderId: string } | null;
      if (!receipt) {
        return null;
      }

      const purchaseOrder = client.purchaseOrder?.findFirst
        ? ((await client.purchaseOrder.findFirst({
            where: { id: receipt.purchaseOrderId, organizationId },
            select: {
              sourceSalesOrderId: true,
              lines: { select: { id: true, sourceSalesOrderLineId: true } },
            },
          })) as {
            sourceSalesOrderId: string | null;
            lines: Array<{ id: string; sourceSalesOrderLineId: string | null }>;
          } | null)
        : null;
      const sourceLineByPurchaseLine = new Map(
        (purchaseOrder?.lines ?? [])
          .filter((line) => line.sourceSalesOrderLineId)
          .map((line) => [line.id, line.sourceSalesOrderLineId as string]),
      );
      let salesLines: Array<{
        id: string;
        quantity: DecimalLike;
        fulfilledQuantity: DecimalLike;
        cogsAmount: DecimalLike;
      }> = [];
      if (purchaseOrder?.sourceSalesOrderId && sourceLineByPurchaseLine.size > 0) {
        salesLines = (await client.salesOrderLine.findMany({
          where: { organizationId, id: { in: [...sourceLineByPurchaseLine.values()] } },
          select: { id: true, quantity: true, fulfilledQuantity: true, cogsAmount: true },
        })) as typeof salesLines;
      }
      const salesUpdates = new Map<string, { quantity: Prisma.Decimal; cogs: Prisma.Decimal }>();

      for (const line of payload.lineUpdates) {
        await client.purchaseOrderLine.update({
          where: { id: line.id },
          data: { receivedQuantity: line.receivedQuantity },
        });
      }
      await client.purchaseOrder.update({
        where: { id: receipt.purchaseOrderId },
        data: {
          status: payload.status,
          amountReceived: payload.amountReceived,
          ...(payload.status === "RECEIVED" ? { receivedAt: new Date() } : {}),
          updatedById: actorId,
        },
      });
      await client.goodsReceipt.update({
        where: { id },
        data: { status: "POSTED", postedAt: new Date(), updatedById: actorId },
      });

      const movements: InventoryMovementWrite[] = [];
      const balances = new Map<string, InventoryBalanceWrite>();
      for (const line of payload.receiptLines) {
        const key = `${line.productId}:${line.location}`;
        const previous =
          balances.get(key) ??
          ((await client.inventoryBalance.findFirst({
            where: { organizationId, productId: line.productId, location: line.location },
            select: { quantity: true, averageCost: true },
          })) as { quantity: DecimalLike; averageCost: DecimalLike } | null);
        const applied = applyInventoryMovement(previous, line.receivedQuantity, line.unitCost, false);
        balances.set(key, {
          organizationId,
          productId: line.productId,
          location: line.location,
          quantity: applied.quantity,
          averageCost: applied.averageCost,
        });
        movements.push({
          organizationId,
          productId: line.productId,
          movementType: "PURCHASE_RECEIPT",
          quantity: line.receivedQuantity,
          unitCost: line.unitCost,
          location: line.location,
          referenceType: "GOODS_RECEIPT",
          referenceId: id,
          balanceAfter: applied.balanceAfter,
          createdById: actorId,
        });

        const salesLineId = sourceLineByPurchaseLine.get(line.purchaseOrderLineId);
        const salesLine = salesLineId ? salesLines.find((candidate) => candidate.id === salesLineId) : undefined;
        if (purchaseOrder?.sourceSalesOrderId && salesLine) {
          const remaining = new Prisma.Decimal(salesLine.quantity.toString()).sub(
            new Prisma.Decimal(salesLine.fulfilledQuantity.toString()),
          );
          const received = new Prisma.Decimal(line.receivedQuantity);
          const saleQuantity = remaining.lt(received) ? remaining : received;
          if (saleQuantity.gt(0)) {
            const issue = applyInventoryMovement(
              { quantity: applied.quantity, averageCost: applied.averageCost },
              saleQuantity.neg().toFixed(4),
              applied.averageCost,
              false,
            );
            balances.set(key, {
              organizationId,
              productId: line.productId,
              location: line.location,
              quantity: issue.quantity,
              averageCost: issue.averageCost,
            });
            movements.push({
              organizationId,
              productId: line.productId,
              movementType: "SALE",
              quantity: issue.delta,
              unitCost: applied.averageCost,
              location: line.location,
              referenceType: "SALES_ORDER",
              referenceId: purchaseOrder.sourceSalesOrderId,
              balanceAfter: issue.balanceAfter,
              createdById: actorId,
            });
            const current = salesUpdates.get(salesLine.id) ?? {
              quantity: new Prisma.Decimal(0),
              cogs: new Prisma.Decimal(0),
            };
            salesUpdates.set(salesLine.id, {
              quantity: current.quantity.add(saleQuantity),
              cogs: current.cogs.add(saleQuantity.mul(applied.averageCost)),
            });
          }
        }
      }
      if (movements.length > 0) {
        await client.inventoryMovement.createMany({ data: movements });
      }
      for (const balance of balances.values()) {
        await client.inventoryBalance.upsert({
          where: {
            organizationId_productId_location: {
              organizationId,
              productId: balance.productId,
              location: balance.location,
            },
          },
          create: balance,
          update: {
            quantity: balance.quantity,
            averageCost: balance.averageCost,
            updatedAt: new Date(),
          },
        });
      }

      for (const [lineId, update] of salesUpdates) {
        const salesLine = salesLines.find((candidate) => candidate.id === lineId);
        if (!salesLine) {
          continue;
        }
        await client.salesOrderLine.update({
          where: { id: lineId },
          data: {
            fulfilledQuantity: new Prisma.Decimal(salesLine.fulfilledQuantity.toString())
              .add(update.quantity)
              .toFixed(4),
            cogsAmount: new Prisma.Decimal(salesLine.cogsAmount.toString()).add(update.cogs).toFixed(4),
          },
        });
      }
      if (purchaseOrder?.sourceSalesOrderId && salesUpdates.size > 0) {
        const refreshed = (await client.salesOrderLine.findMany({
          where: { organizationId, salesOrderId: purchaseOrder.sourceSalesOrderId },
          select: { quantity: true, fulfilledQuantity: true, cogsAmount: true },
        })) as Array<{ quantity: DecimalLike; fulfilledQuantity: DecimalLike; cogsAmount: DecimalLike }>;
        const cogsTotal = refreshed.reduce(
          (sum, line) => sum.add(new Prisma.Decimal(line.cogsAmount.toString())),
          new Prisma.Decimal(0),
        );
        const isFulfilled = refreshed.every((line) =>
          new Prisma.Decimal(line.fulfilledQuantity.toString()).gte(new Prisma.Decimal(line.quantity.toString())),
        );
        await client.salesOrder.update({
          where: { id: purchaseOrder.sourceSalesOrderId },
          data: {
            cogsTotal: cogsTotal.toFixed(4),
            updatedById: actorId,
            ...(isFulfilled ? { status: "FULFILLED" as const, fulfilledAt: new Date() } : {}),
          },
        });
      }

      return this.findReceipt(organizationId, id, false, tx);
    });
  }

  async softDeleteReceipt(organizationId: string, id: string, actorId: string) {
    const result = await db(this.db).goodsReceipt.updateMany({
      where: { id, organizationId, deletedAt: null, status: "DRAFT" },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
  }

  async restoreReceipt(organizationId: string, id: string, actorId: string) {
    const result = await db(this.db).goodsReceipt.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null, updatedById: actorId },
    });
    return result.count === 1;
  }

  async cancelReceipt(organizationId: string, id: string, actorId: string) {
    const result = await db(this.db).goodsReceipt.updateMany({
      where: { id, organizationId, deletedAt: null, status: "DRAFT" },
      data: { status: "CANCELLED", updatedById: actorId },
    });
    return result.count === 1;
  }

  async listBills(organizationId: string, query: BillListQuery) {
    const decoded = query.cursor ? decodeCursor(query.cursor) : null;
    const range = createdAtRange(query.from, query.to);
    const rows = (await db(this.db).vendorBill.findMany({
      where: {
        organizationId,
        ...(query.includeDeleted ? {} : { deletedAt: null }),
        ...(query.status ? { status: query.status } : {}),
        ...(query.vendorId ? { vendorId: query.vendorId } : {}),
        ...(query.purchaseOrderId ? { purchaseOrderId: query.purchaseOrderId } : {}),
        ...(range ? { createdAt: range } : {}),
        ...(decoded || query.q
          ? {
              AND: [
                ...(decoded ? [cursorFilter(decoded, query.order)] : []),
                ...(query.q
                  ? [
                      {
                        OR: [
                          { billNumber: { contains: query.q, mode: "insensitive" } },
                          { vendorReference: { contains: query.q, mode: "insensitive" } },
                          { vendor: { displayName: { contains: query.q, mode: "insensitive" } } },
                        ],
                      },
                    ]
                  : []),
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: query.order }, { id: query.order }],
      take: query.limit + 1,
      select: billListSelect,
    })) as BillRow[];
    return toCursorPage(rows, query.limit);
  }

  async findBill(
    organizationId: string,
    id: string,
    includeDeleted = false,
    client: PrismaClient | Prisma.TransactionClient = this.db,
  ) {
    const billWithAllocations = (await db(client).vendorBill.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: {
        ...billListSelect,
        exchangeRateToBase: true,
        baseCurrencyCode: true,
        paymentTermId: true,
        expenseAccount: true,
        liabilityAccount: true,
        lines: { orderBy: { sortOrder: "asc" }, select: billLineSelect },
        paymentAllocations: {
          orderBy: { createdAt: "asc" },
          select: { payment: { select: paymentSummarySelect } },
        },
      },
    })) as (BillRow & {
      paymentAllocations: Array<{ payment: NonNullable<BillRow["payments"]>[number] }>;
    }) | null;
    if (!billWithAllocations) {
      return null;
    }
    const { paymentAllocations, ...billBase } = billWithAllocations;
    const bill: BillRow = {
      ...billBase,
      payments: paymentAllocations.map((allocation) => allocation.payment),
    };
    if (!bill.purchaseOrderId) {
      return bill;
    }
    const orderLines = (await db(client).purchaseOrderLine.findMany({
      where: { organizationId, purchaseOrderId: bill.purchaseOrderId },
      select: { productId: true, receivedQuantity: true, billedQuantity: true },
    })) as Array<{ productId: string | null; receivedQuantity: DecimalLike; billedQuantity: DecimalLike }>;
    return { ...bill, lines: mapBillLines(bill.lines, orderLines) };
  }

  async createBill(organizationId: string, actorId: string, input: BillWriteData) {
    return this.transaction(async (tx) => {
      const client = db(tx);
      const billNumber = await allocateDocumentNumberIn(tx, organizationId, documentType("BILL"));
      const created = (await client.vendorBill.create({
        data: {
          organizationId,
          billNumber,
          purchaseOrderId: input.purchaseOrderId ?? null,
          vendorId: input.vendorId,
          ownerUserId: input.ownerUserId,
          status: "DRAFT",
          billDate: dateOnly(input.billDate),
          dueDate: input.dueDate ? dateOnly(input.dueDate) : null,
          vendorReference: input.vendorReference ?? null,
          currencyCode: input.currencyCode,
          exchangeRateToBase: input.exchangeRateToBase ?? null,
          baseCurrencyCode: input.baseCurrencyCode ?? null,
          paymentTermId: input.paymentTermId ?? null,
          expenseAccount: input.expenseAccount ?? null,
          liabilityAccount: input.liabilityAccount ?? null,
          subtotal: input.subtotal,
          discountTotal: input.discountTotal,
          taxTotal: input.taxTotal,
          total: input.total,
          totalBase: input.totalBase ?? null,
          notes: input.notes ?? null,
          createdById: actorId,
          updatedById: actorId,
          lines: { create: input.lines.map((line) => ({ ...line, organizationId })) },
        },
        select: { id: true },
      })) as { id: string };
      return this.findBill(organizationId, created.id, false, tx);
    });
  }

  async updateBill(organizationId: string, id: string, actorId: string, input: BillWriteData) {
    const updated = await this.transaction(async (tx) => {
      const client = db(tx);
      const existing = (await client.vendorBill.findFirst({
        where: { id, organizationId, deletedAt: null, status: "DRAFT" },
        select: { id: true },
      })) as { id: string } | null;
      if (!existing) {
        return false;
      }
      await client.vendorBillLine.deleteMany({ where: { billId: id, organizationId } });
      await client.vendorBill.update({
        where: { id },
        data: {
          vendorId: input.vendorId,
          ownerUserId: input.ownerUserId,
          billDate: dateOnly(input.billDate),
          dueDate: input.dueDate ? dateOnly(input.dueDate) : null,
          vendorReference: input.vendorReference ?? null,
          currencyCode: input.currencyCode,
          exchangeRateToBase: input.exchangeRateToBase ?? null,
          baseCurrencyCode: input.baseCurrencyCode ?? null,
          paymentTermId: input.paymentTermId ?? null,
          expenseAccount: input.expenseAccount ?? null,
          liabilityAccount: input.liabilityAccount ?? null,
          subtotal: input.subtotal,
          discountTotal: input.discountTotal,
          taxTotal: input.taxTotal,
          total: input.total,
          totalBase: input.totalBase ?? null,
          notes: input.notes ?? null,
          updatedById: actorId,
          lines: { create: input.lines.map((line) => ({ ...line, organizationId })) },
        },
      });
      return true;
    });
    return updated ? this.findBill(organizationId, id) : null;
  }

  async approveBill(organizationId: string, id: string, actorId: string, payload: BillApprovalPayload) {
    return this.transaction(async (tx) => {
      const client = db(tx);
      const bill = (await client.vendorBill.findFirst({
        where: { id, organizationId, deletedAt: null, status: "DRAFT" },
        select: { id: true, purchaseOrderId: true, currencyCode: true },
      })) as { id: string; purchaseOrderId: string | null; currencyCode: string } | null;
      if (!bill) {
        return null;
      }
      if (bill.purchaseOrderId) {
        const order = (await client.purchaseOrder.findFirst({
          where: { id: bill.purchaseOrderId, organizationId },
          select: { status: true, currencyCode: true },
        })) as { status: PurchaseOrderStatusValue; currencyCode: string } | null;
        if (!order) {
          return null;
        }
        assertPurchaseOrderTransition(order.status, "BILLED");
        if (order.currencyCode !== bill.currencyCode) {
          throw new ValidationFailedError({ currencyCode: ["A purchase-order bill must use the order currency"] });
        }
      }
      await client.vendorBill.update({
        where: { id },
        data: { status: "APPROVED", approvedAt: new Date(), updatedById: actorId },
      });
      if (bill.purchaseOrderId) {
        for (const line of payload.lineUpdates) {
          await client.purchaseOrderLine.update({
            where: { id: line.id },
            data: { billedQuantity: { increment: line.billedQuantity } },
          });
        }
        await client.purchaseOrder.update({
          where: { id: bill.purchaseOrderId },
          data: {
            status: "BILLED",
            amountBilled: payload.amountBilled,
            billedAt: new Date(),
            updatedById: actorId,
          },
        });
      }
      return this.findBill(organizationId, id, false, tx);
    });
  }

  async voidBill(organizationId: string, id: string, actorId: string) {
    return this.transaction(async (tx) => {
      const client = db(tx);
      const bill = (await client.vendorBill.findFirst({
        where: {
          id,
          organizationId,
          deletedAt: null,
          status: { in: ["APPROVED", "PARTIALLY_PAID"] },
          amountPaid: 0,
        },
        select: { id: true, purchaseOrderId: true },
      })) as { id: string; purchaseOrderId: string | null } | null;
      if (!bill) {
        return false;
      }
      await client.vendorBill.update({
        where: { id },
        data: { status: "VOID", voidedAt: new Date(), updatedById: actorId },
      });
      if (bill.purchaseOrderId) {
        const [order, remainingBills, orderLines] = await Promise.all([
          client.purchaseOrder.findFirst({
            where: { id: bill.purchaseOrderId, organizationId },
            select: { id: true },
          }),
          client.vendorBill.findMany({
            where: {
              organizationId,
              purchaseOrderId: bill.purchaseOrderId,
              deletedAt: null,
              id: { not: id },
              status: { in: ["APPROVED", "PARTIALLY_PAID", "PAID"] },
            },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              total: true,
              lines: { orderBy: { sortOrder: "asc" }, select: { productId: true, quantity: true } },
            },
          }),
          client.purchaseOrderLine.findMany({
            where: { organizationId, purchaseOrderId: bill.purchaseOrderId },
            orderBy: { sortOrder: "asc" },
            select: { id: true, productId: true, quantity: true, billedQuantity: true },
          }),
        ]);
        const orderRow = order as { id: string } | null;
        const bills = remainingBills as Array<{
          id: string;
          total: DecimalLike;
          lines: Array<{ productId: string | null; quantity: DecimalLike }>;
        }>;
        const lines = orderLines as Array<{
          id: string;
          productId: string | null;
          quantity: DecimalLike;
          billedQuantity: DecimalLike;
        }>;
        if (orderRow) {
          const targets = new Map<string, string>(lines.map((line) => [line.id, "0.0000"]));
          for (const remaining of bills) {
            const requested = new Map<string, Prisma.Decimal>();
            for (const line of remaining.lines) {
              if (!line.productId) {
                continue;
              }
              requested.set(
                line.productId,
                (requested.get(line.productId) ?? new Prisma.Decimal(0)).add(toDecimal(line.quantity)),
              );
            }
            for (const line of lines) {
              if (!line.productId) {
                continue;
              }
              const remainingRequest = requested.get(line.productId) ?? new Prisma.Decimal(0);
              if (remainingRequest.lte(0)) {
                continue;
              }
              const current = toDecimal(targets.get(line.id) ?? "0");
              const capacity = toDecimal(line.quantity).sub(current);
              const applied = capacity.gt(remainingRequest) ? remainingRequest : capacity;
              if (applied.lte(0)) {
                continue;
              }
              targets.set(line.id, current.add(applied).toFixed(4));
              requested.set(line.productId, remainingRequest.sub(applied));
            }
          }
          for (const line of lines) {
            await client.purchaseOrderLine.update({
              where: { id: line.id },
              data: { billedQuantity: targets.get(line.id) ?? "0.0000" },
            });
          }
          await client.purchaseOrder.update({
            where: { id: bill.purchaseOrderId },
            data: {
              amountBilled: sumDecimal(bills.map((remaining) => remaining.total)),
              status: bills.length > 0 ? "BILLED" : "RECEIVED",
              ...(bills.length > 0 ? { billedAt: new Date() } : { billedAt: null }),
              updatedById: actorId,
            },
          });
        }
      }
      return true;
    });
  }

  async softDeleteBill(organizationId: string, id: string, actorId: string) {
    const result = await db(this.db).vendorBill.updateMany({
      where: { id, organizationId, deletedAt: null, status: "DRAFT" },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
  }

  async restoreBill(organizationId: string, id: string, actorId: string) {
    const result = await db(this.db).vendorBill.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null, updatedById: actorId },
    });
    return result.count === 1;
  }

  async listPayments(organizationId: string, query: PaymentListQuery) {
    const decoded = query.cursor ? decodeCursor(query.cursor) : null;
    const range = createdAtRange(query.from, query.to);
    const rows = (await db(this.db).vendorPayment.findMany({
      where: {
        organizationId,
        ...(query.includeDeleted ? {} : { deletedAt: null }),
        ...(query.status ? { status: query.status } : {}),
        ...(query.vendorId ? { vendorId: query.vendorId } : {}),
        ...(query.billId ? { allocations: { some: { billId: query.billId } } } : {}),
        ...(range ? { createdAt: range } : {}),
        ...(decoded || query.q
          ? {
              AND: [
                ...(decoded ? [cursorFilter(decoded, query.order)] : []),
                ...(query.q
                  ? [
                      {
                        OR: [
                          { paymentNumber: { contains: query.q, mode: "insensitive" } },
                          { reference: { contains: query.q, mode: "insensitive" } },
                        ],
                      },
                    ]
                  : []),
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: query.order }, { id: query.order }],
      take: query.limit + 1,
      select: paymentListSelect,
    })) as PaymentRow[];
    return toCursorPage(rows, query.limit);
  }

  async findPayment(
    organizationId: string,
    id: string,
    includeDeleted = false,
    client: PrismaClient | Prisma.TransactionClient = this.db,
  ) {
    return (await db(client).vendorPayment.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: {
        ...paymentListSelect,
        allocations: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            billId: true,
            amount: true,
            bill: { select: { id: true, billNumber: true, status: true, total: true, amountPaid: true, vendorId: true, currencyCode: true } },
          },
        },
      },
    })) as PaymentRow | null;
  }

  async findBillsForAllocation(organizationId: string, billIds: string[]) {
    if (billIds.length === 0) {
      return [];
    }
    return (await db(this.db).vendorBill.findMany({
      where: { id: { in: billIds }, organizationId, deletedAt: null },
      select: { id: true, billNumber: true, vendorId: true, status: true, total: true, amountPaid: true, currencyCode: true },
    })) as Array<Pick<BillRow, "id" | "billNumber" | "vendorId" | "status" | "total" | "amountPaid" | "currencyCode">>;
  }

  async sumPendingAllocations(organizationId: string, billIds: string[], excludePaymentId?: string) {
    if (billIds.length === 0) {
      return new Map<string, string>();
    }
    const rows = (await db(this.db).vendorPaymentAllocation.findMany({
      where: {
        billId: { in: billIds },
        payment: {
          organizationId,
          status: "DRAFT",
          deletedAt: null,
          ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
        },
      },
      select: { billId: true, amount: true },
    })) as Array<{ billId: string; amount: DecimalLike }>;

    const result = new Map<string, string>();
    for (const row of rows) {
      const current = result.get(row.billId) ?? "0";
      result.set(row.billId, toDecimal(current).add(toDecimal(row.amount)).toFixed(4));
    }
    return result;
  }

  async createPayment(organizationId: string, actorId: string, input: PaymentWriteData) {
    return this.transaction(async (tx) => {
      const client = db(tx);
      const hasVendorPaymentType = Object.prototype.hasOwnProperty.call(DocumentType, "VENDOR_PAYMENT");
      const paymentNumber = await allocateDocumentNumberIn(
        tx,
        organizationId,
        documentType(hasVendorPaymentType ? "VENDOR_PAYMENT" : "PAYMENT"),
      );
      const created = (await client.vendorPayment.create({
        data: {
          organizationId,
          paymentNumber,
          vendorId: input.vendorId,
          paidDate: dateOnly(input.paidDate),
          method: input.method,
          amount: input.amount,
          currencyCode: input.currencyCode,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          status: "DRAFT",
          bankAccount: input.bankAccount ?? null,
          createdById: actorId,
          updatedById: actorId,
          allocations: {
            create: input.allocations.map((allocation) => ({
              billId: allocation.billId,
              amount: allocation.amount,
              organizationId,
            })),
          },
        },
        select: { id: true },
      })) as { id: string };
      return this.findPayment(organizationId, created.id, false, tx);
    });
  }

  async updatePayment(organizationId: string, id: string, actorId: string, input: Partial<PaymentWriteData>) {
    const updated = await this.transaction(async (tx) => {
      const client = db(tx);
      const existing = (await client.vendorPayment.findFirst({
        where: { id, organizationId, deletedAt: null, status: "DRAFT" },
        select: { id: true },
      })) as { id: string } | null;
      if (!existing) {
        return false;
      }
      if (input.allocations) {
        await client.vendorPaymentAllocation.deleteMany({ where: { paymentId: id, organizationId } });
      }
      await client.vendorPayment.update({
        where: { id },
        data: {
          ...(input.vendorId ? { vendorId: input.vendorId } : {}),
          ...(input.paidDate ? { paidDate: dateOnly(input.paidDate) } : {}),
          ...(input.method ? { method: input.method } : {}),
          ...(input.amount ? { amount: input.amount } : {}),
          ...(input.currencyCode ? { currencyCode: input.currencyCode } : {}),
          ...(input.reference !== undefined ? { reference: input.reference ?? null } : {}),
          ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
          ...(input.bankAccount !== undefined ? { bankAccount: input.bankAccount ?? null } : {}),
          ...(input.allocations
            ? {
                allocations: {
                  create: input.allocations.map((allocation) => ({
                    billId: allocation.billId,
                    amount: allocation.amount,
                    organizationId,
                  })),
                },
              }
            : {}),
          updatedById: actorId,
        },
      });
      return true;
    });
    return updated ? this.findPayment(organizationId, id) : null;
  }

  async approvePayment(
    organizationId: string,
    id: string,
    actorId: string,
    billUpdates: Array<{ billId: string; amountPaid: string; status: string }>,
  ) {
    return this.transaction(async (tx) => {
      const client = db(tx);
      const payment = (await client.vendorPayment.findFirst({
        where: { id, organizationId, deletedAt: null, status: "DRAFT" },
        select: { id: true, vendorId: true, currencyCode: true },
      })) as { id: string; vendorId: string; currencyCode: string } | null;
      if (!payment) {
        return null;
      }
      const allocations = (await client.vendorPaymentAllocation.findMany({
        where: { paymentId: id, organizationId },
        select: { billId: true, amount: true },
      })) as Array<{ billId: string; amount: DecimalLike }>;
      const deltas = new Map<string, Prisma.Decimal>();
      for (const allocation of allocations) {
        deltas.set(
          allocation.billId,
          (deltas.get(allocation.billId) ?? new Prisma.Decimal(0)).add(toDecimal(allocation.amount)),
        );
      }
      if (billUpdates.some((update) => !deltas.has(update.billId)) || billUpdates.length !== deltas.size) {
        throw new ValidationFailedError({ allocations: ["One or more allocations are no longer available"] });
      }

      const appliedUpdates: Array<{ billId: string; amountPaid: string; status: string }> = [];
      for (const [billId, delta] of deltas) {
        const bill = (await client.vendorBill.findFirst({
          where: { id: billId, organizationId, deletedAt: null },
          select: { id: true, vendorId: true, status: true, total: true, amountPaid: true, currencyCode: true },
        })) as {
          id: string;
          vendorId: string;
          status: VendorBillStatusValue;
          total: DecimalLike;
          amountPaid: DecimalLike;
          currencyCode: string;
        } | null;
        if (!bill || bill.vendorId !== payment.vendorId) {
          throw new ValidationFailedError({ allocations: ["All bills must belong to the payment vendor"] });
        }
        if (bill.status !== "APPROVED" && bill.status !== "PARTIALLY_PAID") {
          throw new ValidationFailedError({ allocations: ["Only approved bills can be paid"] });
        }
        if (bill.currencyCode !== payment.currencyCode) {
          throw new ValidationFailedError({ currencyCode: ["Payment and bill currencies must match"] });
        }
        const applied = applyVendorBillPaymentDelta(bill, delta.toFixed(4));
        appliedUpdates.push({ billId, amountPaid: applied.amountPaid, status: applied.status });
      }

      await client.vendorPayment.update({
        where: { id },
        data: { status: "PAID", updatedById: actorId },
      });
      for (const update of appliedUpdates) {
        await client.vendorBill.update({
          where: { id: update.billId },
          data: {
            amountPaid: update.amountPaid,
            status: update.status,
            ...(update.status === "PAID" ? { paidAt: new Date() } : {}),
            updatedById: actorId,
          },
        });
      }
      return this.findPayment(organizationId, id, false, tx);
    });
  }

  async softDeletePayment(organizationId: string, id: string, actorId: string) {
    const result = await db(this.db).vendorPayment.updateMany({
      where: { id, organizationId, deletedAt: null, status: "DRAFT" },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
  }

  async restorePayment(organizationId: string, id: string, actorId: string) {
    const result = await db(this.db).vendorPayment.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null, updatedById: actorId },
    });
    return result.count === 1;
  }

  async cancelPayment(organizationId: string, id: string, actorId: string) {
    const result = await db(this.db).vendorPayment.updateMany({
      where: { id, organizationId, deletedAt: null, status: "DRAFT" },
      data: { status: "CANCELLED", updatedById: actorId },
    });
    return result.count === 1;
  }
}

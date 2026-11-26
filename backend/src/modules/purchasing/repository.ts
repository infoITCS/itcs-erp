import { DocumentType, type PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { BaseRepository } from "../../common/database/base-repository";
import { allocateDocumentNumberIn } from "../../common/numbering/allocate";
import { createdAtRange } from "../../common/pagination/list-query";
import { cursorFilter, decodeCursor, toCursorPage } from "../../common/pagination/cursor";
import { applyVendorBillPaymentDelta } from "./money";
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
  user: ModelDelegate;
}

export interface VendorSummary {
  id: string;
  vendorNumber?: string;
  displayName?: string;
  status?: string;
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
  sortOrder: number;
}

export interface OrderLineRow extends LineSnapshot {
  id: string;
  receivedQuantity: DecimalLike;
  billedQuantity: DecimalLike;
}

export interface OrderRow {
  id: string;
  organizationId: string;
  purchaseOrderNumber: string;
  vendorId: string;
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
}

export interface AllocationRow {
  id: string;
  billId: string;
  amount: DecimalLike;
  bill?: Pick<BillRow, "id" | "billNumber" | "status" | "total" | "amountPaid" | "vendorId"> | null;
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
  movementType: "PURCHASE_RECEIPT";
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
  movements: InventoryMovementWrite[];
  balances: InventoryBalanceWrite[];
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

const orderListSelect = {
  id: true,
  organizationId: true,
  purchaseOrderNumber: true,
  vendorId: true,
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
  _count: { select: { lines: true, receipts: true, bills: true } },
};

const lineSelect = {
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
    return toCursorPage(rows, query.limit);
  }

  async findOrder(organizationId: string, id: string, includeDeleted = false) {
    return (await db(this.db).purchaseOrder.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: {
        ...orderListSelect,
        exchangeRateToBase: true,
        baseCurrencyCode: true,
        paymentTermId: true,
        notes: true,
        terms: true,
        lines: { orderBy: { sortOrder: "asc" }, select: lineSelect },
      },
    })) as OrderRow | null;
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
        select: { id: true, vendorNumber: true, displayName: true, currencyCode: true, paymentTermId: true },
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

    return {
      vendors,
      products: products.map((product) => ({
        ...product,
        unitOfMeasure: product.unitOfMeasure?.code ?? null,
        taxRate: product.taxCode?.rate.toString() ?? "0",
      })),
      currencies,
      paymentTerms,
      taxCodes,
      owners,
      orders,
      bills,
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
      return this.findOrder(organizationId, created.id);
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

  async findReceipt(organizationId: string, id: string, includeDeleted = false) {
    return (await db(this.db).goodsReceipt.findFirst({
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
        receipt: {
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
      result.set(row.purchaseOrderLineId, (Number(current) + Number(row.receivedQuantity)).toFixed(4));
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
      return this.findReceipt(organizationId, created.id);
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

      for (const line of payload.lineUpdates) {
        await client.purchaseOrderLine.update({
          where: { id: line.id },
          data: { receivedQuantity: { increment: line.receivedQuantity } },
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
      if (payload.movements.length > 0) {
        await client.inventoryMovement.createMany({ data: payload.movements });
      }
      for (const balance of payload.balances) {
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
      return this.findReceipt(organizationId, id);
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

  async findBill(organizationId: string, id: string, includeDeleted = false) {
    return (await db(this.db).vendorBill.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: {
        ...billListSelect,
        exchangeRateToBase: true,
        baseCurrencyCode: true,
        paymentTermId: true,
        expenseAccount: true,
        liabilityAccount: true,
        lines: { orderBy: { sortOrder: "asc" }, select: lineSelect },
      },
    })) as BillRow | null;
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
      return this.findBill(organizationId, created.id);
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
        select: { id: true, purchaseOrderId: true },
      })) as { id: string; purchaseOrderId: string | null } | null;
      if (!bill) {
        return null;
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
      return this.findBill(organizationId, id);
    });
  }

  async voidBill(organizationId: string, id: string, actorId: string) {
    const result = await db(this.db).vendorBill.updateMany({
      where: { id, organizationId, deletedAt: null, status: { in: ["APPROVED", "PARTIALLY_PAID"] }, amountPaid: 0 },
      data: { status: "VOID", voidedAt: new Date(), updatedById: actorId },
    });
    return result.count === 1;
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

  async findPayment(organizationId: string, id: string, includeDeleted = false) {
    return (await db(this.db).vendorPayment.findFirst({
      where: { id, organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: {
        ...paymentListSelect,
        allocations: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            billId: true,
            amount: true,
            bill: { select: { id: true, billNumber: true, status: true, total: true, amountPaid: true, vendorId: true } },
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
      select: { id: true, billNumber: true, vendorId: true, status: true, total: true, amountPaid: true },
    })) as Array<Pick<BillRow, "id" | "billNumber" | "vendorId" | "status" | "total" | "amountPaid">>;
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
      result.set(row.billId, (Number(result.get(row.billId) ?? 0) + Number(row.amount)).toFixed(4));
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
      return this.findPayment(organizationId, created.id);
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
        select: { id: true },
      })) as { id: string } | null;
      if (!payment) {
        return null;
      }
      await client.vendorPayment.update({
        where: { id },
        data: { status: "PAID", updatedById: actorId },
      });
      for (const update of billUpdates) {
        const bill = (await client.vendorBill.findFirst({
          where: { id: update.billId, organizationId, deletedAt: null },
          select: { id: true, status: true, total: true, amountPaid: true },
        })) as { id: string; status: VendorBillStatusValue; total: DecimalLike; amountPaid: DecimalLike } | null;
        if (!bill) {
          continue;
        }
        const allocation = (await client.vendorPaymentAllocation.aggregate({
          where: { paymentId: id, billId: update.billId },
          _sum: { amount: true },
        })) as { _sum: { amount: DecimalLike | null } };
        const delta = allocation._sum.amount?.toString() ?? "0";
        const applied = applyVendorBillPaymentDelta(bill, delta);
        await client.vendorBill.update({
          where: { id: update.billId },
          data: {
            amountPaid: applied.amountPaid,
            status: applied.status,
            ...(applied.status === "PAID" ? { paidAt: new Date() } : {}),
            updatedById: actorId,
          },
        });
      }
      return this.findPayment(organizationId, id);
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
}

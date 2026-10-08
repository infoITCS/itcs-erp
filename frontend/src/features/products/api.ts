import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export type ProductType = "PHYSICAL_PRODUCT" | "SERVICE";
export type ProductStatus = "ACTIVE" | "INACTIVE";
export type PriceType = "SALES" | "PURCHASE";

export interface ProductPrice {
  id: string;
  productId: string;
  priceType: PriceType;
  priceListCode: string;
  currencyCode: string;
  amount: string;
  effectiveDate: string;
  expiryDate: string | null;
  isActive: boolean;
}

export interface ProductSummary {
  id: string;
  code: string;
  name: string;
  productType: ProductType;
  status: ProductStatus;
  trackInventory: boolean;
  category: { id: string; code: string; name: string } | null;
  unitOfMeasure: { id: string; code: string; name: string };
  taxCode: { id: string; code: string; name: string; rate: string } | null;
  prices?: ProductPrice[];
  createdAt: string;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  notes: string | null;
  categoryId: string | null;
  unitOfMeasureId: string;
  taxCodeId: string | null;
  prices: ProductPrice[];
}

export interface Category {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface TaxCode {
  id: string;
  code: string;
  name: string;
  rate: string;
  isActive: boolean;
}

export interface Page<T> {
  items: T[];
  pageInfo: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}

export interface ProductWrite {
  code?: string;
  name: string;
  description?: string;
  productType: ProductType;
  status?: ProductStatus;
  categoryId?: string | null;
  unitOfMeasureId: string;
  taxCodeId?: string | null;
  trackInventory?: boolean;
  notes?: string;
  initialSalesPrice?: PriceWrite;
}

export interface PriceWrite {
  priceType: PriceType;
  priceListCode?: string;
  currencyCode: string;
  amount: string;
  effectiveDate: string;
  expiryDate?: string;
  isActive?: boolean;
}

export interface CategoryWrite {
  code: string;
  name: string;
  description?: string;
  parentId?: string | null;
  isActive?: boolean;
}

export interface AuditEvent {
  id: string;
  action: string;
  module: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

function data<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data as T);
}

export function listProducts(params: Record<string, string | number | boolean | undefined>): Promise<Page<ProductSummary>> {
  return data(http.get<ApiSuccess<Page<ProductSummary>>>("/api/v1/products", { params }));
}

export function getProduct(id: string): Promise<ProductDetail> {
  return data(http.get<ApiSuccess<ProductDetail>>(`/api/v1/products/${id}`));
}

export function createProduct(body: ProductWrite): Promise<ProductDetail> {
  return data(http.post("/api/v1/products", body));
}

export function updateProduct(id: string, body: Partial<ProductWrite>): Promise<ProductDetail> {
  return data(http.patch(`/api/v1/products/${id}`, body));
}

export function deleteProduct(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/products/${id}`));
}

export function restoreProduct(id: string): Promise<ProductDetail> {
  return data(http.post(`/api/v1/products/${id}/restore`));
}

export function listPrices(productId: string): Promise<ProductPrice[]> {
  return data(http.get(`/api/v1/products/${productId}/prices`));
}

export function createPrice(productId: string, body: PriceWrite): Promise<ProductPrice> {
  return data(http.post(`/api/v1/products/${productId}/prices`, body));
}

export function updatePrice(id: string, body: PriceWrite): Promise<ProductPrice> {
  return data(http.patch(`/api/v1/prices/${id}`, body));
}

export function deletePrice(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/prices/${id}`));
}

export function listCategories(): Promise<Category[]> {
  return data(http.get("/api/v1/categories"));
}

export function createCategory(body: CategoryWrite): Promise<Category> {
  return data(http.post("/api/v1/categories", body));
}

export function updateCategory(id: string, body: Partial<CategoryWrite>): Promise<Category> {
  return data(http.patch(`/api/v1/categories/${id}`, body));
}

export function deleteCategory(id: string): Promise<{ id: string }> {
  return data(http.delete(`/api/v1/categories/${id}`));
}

export function listUnitsOfMeasure(): Promise<UnitOfMeasure[]> {
  return data(http.get("/api/v1/units-of-measure"));
}

export function listTaxCodes(): Promise<TaxCode[]> {
  return data(http.get("/api/v1/tax-codes"));
}

export function listProductAudit(productId: string): Promise<Page<AuditEvent>> {
  return data(
    http.get("/api/v1/audit-logs", {
      params: { subjectId: productId, limit: 20 },
    }),
  );
}

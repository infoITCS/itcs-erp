import { http } from "@/lib/http.ts";
import type { ApiSuccess } from "@/types/api.ts";

export type ProductType = "PHYSICAL_PRODUCT" | "SERVICE";
export type ProductStatus = "ACTIVE" | "INACTIVE";
export type PriceType = "SALES" | "PURCHASE";
export type ValuationMethod = "WEIGHTED_AVERAGE" | "FIFO";
export type DimensionUnit = "METER" | "CENTIMETER" | "INCH" | "FOOT";

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
  description: string | null;
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
  valuationMethod: ValuationMethod;
  weightedAveragePrice: string;
  allowNegativeStock: boolean;
  minimumStockQuantity: string;
  receivingLocation: string;
  deliveryLocation: string;
  inventoryAccount: string | null;
  inventoryTransitAccount: string | null;
  privateNote: string | null;
  netWeight: string;
  width: string;
  length: string;
  height: string;
  dimensionUnit: DimensionUnit;
  cogsAccount: string;
  incomeAccount: string;
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

export interface UnitWrite {
  code: string;
  name: string;
  isActive?: boolean;
}

export interface TaxCodeWrite {
  code: string;
  name: string;
  rate: string;
  isActive?: boolean;
}

export interface Page<T> {
  items: T[];
  pageInfo: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}

export interface ProductFormOptions {
  locations: string[];
  accounts: string[];
  valuationMethods: Array<{ value: ValuationMethod; label: string }>;
  dimensionUnits: Array<{ value: DimensionUnit; label: string }>;
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
  valuationMethod?: ValuationMethod;
  weightedAveragePrice?: string;
  allowNegativeStock?: boolean;
  minimumStockQuantity?: string;
  receivingLocation?: string;
  deliveryLocation?: string;
  inventoryAccount?: string | null;
  inventoryTransitAccount?: string | null;
  privateNote?: string | null;
  netWeight?: string;
  width?: string;
  length?: string;
  height?: string;
  dimensionUnit?: DimensionUnit;
  cogsAccount?: string;
  incomeAccount?: string;
  notes?: string | null;
  initialSalesPrice?: PriceWrite;
  initialPurchasePrice?: PriceWrite;
}

export interface PriceWrite {
  priceType: PriceType;
  priceListCode?: string;
  currencyCode: string;
  amount: string;
  effectiveDate: string;
  expiryDate?: string | null;
  isActive?: boolean;
}

export interface CategoryWrite {
  code: string;
  name: string;
  description?: string;
  parentId?: string | null;
  isActive?: boolean;
}

export interface ProductListParams extends Record<string, string | number | boolean | undefined> {
  q?: string;
  status?: ProductStatus;
  productType?: ProductType;
  categoryId?: string;
  trackInventory?: boolean;
  sort?: "createdAt" | "name" | "code";
  order?: "asc" | "desc";
  cursor?: string;
  limit?: number;
}

function data<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return promise.then((response) => response.data.data as T);
}

export function listProducts(params: ProductListParams): Promise<Page<ProductSummary>> {
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

export function createUnitOfMeasure(body: UnitWrite): Promise<UnitOfMeasure> {
  return data(http.post("/api/v1/units-of-measure", body));
}

export function listTaxCodes(): Promise<TaxCode[]> {
  return data(http.get("/api/v1/tax-codes"));
}

export function createTaxCode(body: TaxCodeWrite): Promise<TaxCode> {
  return data(http.post("/api/v1/tax-codes", body));
}

export function getProductFormOptions(): Promise<ProductFormOptions> {
  return data(http.get("/api/v1/products/form-options"));
}

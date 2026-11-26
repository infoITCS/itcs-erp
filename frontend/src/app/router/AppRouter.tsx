import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layouts/AppLayout.tsx";
import { LoginPage } from "@/features/auth/index.tsx";
import { MicrosoftCallbackPage } from "@/features/auth/callback.tsx";
import { hasPermission, useHasPermission, useSessionUser } from "@/hooks/useSession.ts";
import { GuestOnly, RequireAuth } from "./RequireAuth.tsx";
import { navItems } from "./nav.tsx";

const CustomerFormPage = lazy(() => import("@/features/customers/form-page.tsx"));
const CustomerDetailPage = lazy(() => import("@/features/customers/detail-page.tsx"));
const ProductFormPage = lazy(() => import("@/features/products/form-page.tsx"));
const ProductDetailPage = lazy(() => import("@/features/products/detail-page.tsx"));
const ResellerFormPage = lazy(() => import("@/features/resellers/form-page.tsx"));
const ResellerDetailPage = lazy(() => import("@/features/resellers/detail-page.tsx"));
const LeadFormPage = lazy(() => import("@/features/leads/form-page.tsx"));
const LeadDetailPage = lazy(() => import("@/features/leads/detail-page.tsx"));
const OpportunityFormPage = lazy(() => import("@/features/opportunities/form-page.tsx"));
const OpportunityDetailPage = lazy(() => import("@/features/opportunities/detail-page.tsx"));
const TenderFormPage = lazy(() => import("@/features/tenders/form-page.tsx"));
const TenderDetailPage = lazy(() => import("@/features/tenders/detail-page.tsx"));
const ProjectFormPage = lazy(() => import("@/features/projects/form-page.tsx"));
const ProjectDetailPage = lazy(() => import("@/features/projects/detail-page.tsx"));
const QuoteFormPage = lazy(() => import("@/features/quotes/form-page.tsx"));
const QuoteDetailPage = lazy(() => import("@/features/quotes/detail-page.tsx"));
const SalesOrderFormPage = lazy(() => import("@/features/sales-orders/form-page.tsx"));
const SalesOrderDetailPage = lazy(() => import("@/features/sales-orders/detail-page.tsx"));
const InvoiceFormPage = lazy(() => import("@/features/invoices/form-page.tsx"));
const InvoiceDetailPage = lazy(() => import("@/features/invoices/detail-page.tsx"));
const PaymentFormPage = lazy(() => import("@/features/payments/form-page.tsx"));
const PaymentDetailPage = lazy(() => import("@/features/payments/detail-page.tsx"));
const VendorFormPage = lazy(() => import("@/features/vendors/form-page.tsx"));
const VendorDetailPage = lazy(() => import("@/features/vendors/detail-page.tsx"));
const PurchaseOrdersPage = lazy(() => import("@/features/purchasing/orders/index.tsx"));
const PurchaseOrderFormPage = lazy(() => import("@/features/purchasing/orders/form-page.tsx"));
const PurchaseOrderDetailPage = lazy(() => import("@/features/purchasing/orders/detail-page.tsx"));
const GoodsReceiptsPage = lazy(() => import("@/features/purchasing/receipts/index.tsx"));
const GoodsReceiptFormPage = lazy(() => import("@/features/purchasing/receipts/form-page.tsx"));
const GoodsReceiptDetailPage = lazy(() => import("@/features/purchasing/receipts/detail-page.tsx"));
const VendorBillsPage = lazy(() => import("@/features/purchasing/bills/index.tsx"));
const VendorBillFormPage = lazy(() => import("@/features/purchasing/bills/form-page.tsx"));
const VendorBillDetailPage = lazy(() => import("@/features/purchasing/bills/detail-page.tsx"));
const VendorPaymentsPage = lazy(() => import("@/features/purchasing/payments/index.tsx"));
const VendorPaymentFormPage = lazy(() => import("@/features/purchasing/payments/form-page.tsx"));
const VendorPaymentDetailPage = lazy(() => import("@/features/purchasing/payments/detail-page.tsx"));
const StockMovementsPage = lazy(() => import("@/features/inventory/movements.tsx"));

const explicitlyRoutedPaths = new Set([
  "/purchasing/orders",
  "/purchasing/receipts",
  "/purchasing/bills",
  "/purchasing/payments",
  "/inventory/movements",
]);

function PageLoading() {
  return <p className="text-sm text-slate-500">Loading page…</p>;
}

function RequirePermission({
  permission,
  children,
}: {
  permission: string | string[];
  children: ReactNode;
}) {
  const user = useSessionUser();
  const allowed = useHasPermission(permission);
  if (!allowed) {
    const firstAllowed =
      navItems.find((item) => hasPermission(user, item.permission))?.path ?? "/settings";
    return <Navigate to={firstAllowed} replace />;
  }
  return <>{children}</>;
}

function NotFoundPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-1 text-sm text-slate-600">That route is not part of the ERP shell.</p>
    </section>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<MicrosoftCallbackPage />} />
        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            {navItems
              .filter((item) => !explicitlyRoutedPaths.has(item.path))
              .map((item) => (
                <Route
                  key={item.path}
                  path={item.path}
                  element={
                    <Suspense fallback={<PageLoading />}>
                      {item.permission ? (
                        <RequirePermission permission={item.permission}>
                          <item.page />
                        </RequirePermission>
                      ) : (
                        <item.page />
                      )}
                    </Suspense>
                  }
                />
              ))}
            <Route
              path="/customers/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="customers:create">
                    <CustomerFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/customers/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="customers:update">
                    <CustomerFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/customers/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="customers:read">
                    <CustomerDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/products/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="products:create">
                    <ProductFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/products/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="products:update">
                    <ProductFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/products/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="products:read">
                    <ProductDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/leads/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="leads:create">
                    <LeadFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/leads/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="leads:update">
                    <LeadFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/leads/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="leads:read">
                    <LeadDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/opportunities/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="opportunities:create">
                    <OpportunityFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/opportunities/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="opportunities:update">
                    <OpportunityFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/opportunities/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="opportunities:read">
                    <OpportunityDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/tenders/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="tenders:create">
                    <TenderFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/tenders/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="tenders:update">
                    <TenderFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/tenders/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="tenders:read">
                    <TenderDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/projects/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="projects:create">
                    <ProjectFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/projects/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="projects:update">
                    <ProjectFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="projects:read">
                    <ProjectDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/resellers/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="resellers:create">
                    <ResellerFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/resellers/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="resellers:update">
                    <ResellerFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/resellers/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="resellers:read">
                    <ResellerDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/quotes/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="quotes:create">
                    <QuoteFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/quotes/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="quotes:update">
                    <QuoteFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/quotes/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="quotes:read">
                    <QuoteDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/sales-orders/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="sales-orders:create">
                    <SalesOrderFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/sales-orders/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="sales-orders:update">
                    <SalesOrderFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/sales-orders/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="sales-orders:read">
                    <SalesOrderDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/invoices/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="invoices:create">
                    <InvoiceFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/invoices/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="invoices:update">
                    <InvoiceFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/invoices/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="invoices:read">
                    <InvoiceDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/payments/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="payments:create">
                    <PaymentFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/payments/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="payments:update">
                    <PaymentFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/payments/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="payments:read">
                    <PaymentDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/vendors/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="vendors:create">
                    <VendorFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/vendors/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="vendors:update">
                    <VendorFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/vendors/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="vendors:read">
                    <VendorDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/purchasing/orders"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="purchasing:read">
                    <PurchaseOrdersPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/purchasing/orders/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="purchasing:create">
                    <PurchaseOrderFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/purchasing/orders/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="purchasing:update">
                    <PurchaseOrderFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/purchasing/orders/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="purchasing:read">
                    <PurchaseOrderDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/purchasing/receipts"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="purchasing:read">
                    <GoodsReceiptsPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/purchasing/receipts/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="purchasing:create">
                    <GoodsReceiptFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/purchasing/receipts/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="purchasing:read">
                    <GoodsReceiptDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/purchasing/bills"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="purchasing:read">
                    <VendorBillsPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/purchasing/bills/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="purchasing:create">
                    <VendorBillFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/purchasing/bills/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="purchasing:update">
                    <VendorBillFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/purchasing/bills/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="purchasing:read">
                    <VendorBillDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/purchasing/payments"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="purchasing:read">
                    <VendorPaymentsPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/purchasing/payments/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="purchasing:create">
                    <VendorPaymentFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/purchasing/payments/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="purchasing:update">
                    <VendorPaymentFormPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/purchasing/payments/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="purchasing:read">
                    <VendorPaymentDetailPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route
              path="/inventory/movements"
              element={
                <Suspense fallback={<PageLoading />}>
                  <RequirePermission permission="inventory:read">
                    <StockMovementsPage />
                  </RequirePermission>
                </Suspense>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

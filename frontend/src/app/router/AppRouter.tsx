import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layouts/AppLayout.tsx";
import { LoginPage } from "@/features/auth/index.tsx";
import { MicrosoftCallbackPage } from "@/features/auth/callback.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { GuestOnly, RequireAuth } from "./RequireAuth.tsx";
import { navItems } from "./nav.tsx";

const CustomerFormPage = lazy(() => import("@/features/customers/form-page.tsx"));
const CustomerDetailPage = lazy(() => import("@/features/customers/detail-page.tsx"));
const ProductFormPage = lazy(() => import("@/features/products/form-page.tsx"));
const ProductDetailPage = lazy(() => import("@/features/products/detail-page.tsx"));
const ResellerFormPage = lazy(() => import("@/features/resellers/form-page.tsx"));
const ResellerDetailPage = lazy(() => import("@/features/resellers/detail-page.tsx"));
const OpportunityFormPage = lazy(() => import("@/features/opportunities/form-page.tsx"));
const OpportunityDetailPage = lazy(() => import("@/features/opportunities/detail-page.tsx"));
const TenderFormPage = lazy(() => import("@/features/tenders/form-page.tsx"));
const TenderDetailPage = lazy(() => import("@/features/tenders/detail-page.tsx"));

function PageLoading() {
  return <p className="text-sm text-slate-500">Loading page…</p>;
}

function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const allowed = useHasPermission(permission);
  if (!allowed) {
    return <Navigate to="/" replace />;
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
            {navItems.map((item) => (
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
                  <CustomerFormPage />
                </Suspense>
              }
            />
            <Route
              path="/customers/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <CustomerFormPage />
                </Suspense>
              }
            />
            <Route
              path="/customers/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <CustomerDetailPage />
                </Suspense>
              }
            />
            <Route
              path="/products/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <ProductFormPage />
                </Suspense>
              }
            />
            <Route
              path="/products/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <ProductFormPage />
                </Suspense>
              }
            />
            <Route
              path="/products/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <ProductDetailPage />
                </Suspense>
              }
            />
            <Route
              path="/opportunities/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <OpportunityFormPage />
                </Suspense>
              }
            />
            <Route
              path="/opportunities/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <OpportunityFormPage />
                </Suspense>
              }
            />
            <Route
              path="/opportunities/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <OpportunityDetailPage />
                </Suspense>
              }
            />
            <Route
              path="/tenders/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <TenderFormPage />
                </Suspense>
              }
            />
            <Route
              path="/tenders/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <TenderFormPage />
                </Suspense>
              }
            />
            <Route
              path="/tenders/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <TenderDetailPage />
                </Suspense>
              }
            />
            <Route
              path="/resellers/new"
              element={
                <Suspense fallback={<PageLoading />}>
                  <ResellerFormPage />
                </Suspense>
              }
            />
            <Route
              path="/resellers/:id/edit"
              element={
                <Suspense fallback={<PageLoading />}>
                  <ResellerFormPage />
                </Suspense>
              }
            />
            <Route
              path="/resellers/:id"
              element={
                <Suspense fallback={<PageLoading />}>
                  <ResellerDetailPage />
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

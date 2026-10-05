import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layouts/AppLayout.tsx";
import { LoginPage } from "@/features/auth/index.tsx";
import { navItems } from "./nav.tsx";

const CustomerFormPage = lazy(() => import("@/features/customers/form-page.tsx"));
const CustomerDetailPage = lazy(() => import("@/features/customers/detail-page.tsx"));

function PageLoading() {
  return <p className="text-sm text-slate-500">Loading page…</p>;
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
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          {navItems.map((item) => (
            <Route
              key={item.path}
              path={item.path}
              element={
                <Suspense fallback={<PageLoading />}>
                  <item.page />
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
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

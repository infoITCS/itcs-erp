import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { tokenStore } from "@/lib/token-store.ts";

/** Blocks the ERP shell until a session token exists. */
export function RequireAuth() {
  const location = useLocation();

  if (!tokenStore.get()) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return <Outlet />;
}

/** Login (and other public auth screens) — bounce away if already signed in. */
export function GuestOnly({ children }: { children: ReactNode }) {
  if (tokenStore.get()) {
    return <Navigate to="/" replace />;
  }

  return children;
}

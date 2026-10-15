import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { tokenStore } from "@/lib/token-store.ts";

function useHasSession(): boolean {
  return useSyncExternalStore(
    tokenStore.subscribe,
    () => Boolean(tokenStore.getSnapshot()),
    () => false,
  );
}

/** Blocks the ERP shell until a session token exists. */
export function RequireAuth() {
  const location = useLocation();
  const signedIn = useHasSession();

  if (!signedIn) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return <Outlet />;
}

/** Login (and other public auth screens) — bounce away if already signed in. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const signedIn = useHasSession();

  if (signedIn) {
    return <Navigate to="/" replace />;
  }

  return children;
}

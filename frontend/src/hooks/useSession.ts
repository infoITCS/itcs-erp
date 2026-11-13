import { useSyncExternalStore } from "react";
import { tokenStore, type ImpersonationInfo, type SessionUser } from "@/lib/token-store.ts";

export function useSessionUser(): SessionUser | null {
  return useSyncExternalStore(
    tokenStore.subscribe,
    tokenStore.getUser,
    () => null,
  );
}

/** Returns the real (admin) user even during impersonation */
export function useRealUser(): SessionUser | null {
  return useSyncExternalStore(
    tokenStore.subscribe,
    tokenStore.getRealUser,
    () => null,
  );
}

export function useImpersonation(): ImpersonationInfo | null {
  return useSyncExternalStore(
    tokenStore.subscribe,
    tokenStore.getImpersonation,
    () => null,
  );
}

export function hasPermission(
  user: SessionUser | null | undefined,
  permission: string | string[] | undefined,
): boolean {
  if (!user) return false;
  if (!permission || (Array.isArray(permission) && permission.length === 0)) return true;
  if (user.roles.includes("admin")) return true;
  if (Array.isArray(permission)) {
    return permission.some((p) => user.permissions.includes(p));
  }
  return user.permissions.includes(permission);
}

export function useHasPermission(permission: string | string[] | undefined): boolean {
  const user = useSessionUser();
  return hasPermission(user, permission);
}

/** Returns true only for the real admin — not affected by impersonation */
export function useIsAdmin(): boolean {
  const realUser = useRealUser();
  return realUser?.roles.includes("admin") ?? false;
}

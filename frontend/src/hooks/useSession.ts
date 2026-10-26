import { useSyncExternalStore } from "react";
import { tokenStore, type SessionUser } from "@/lib/token-store.ts";

export function useSessionUser(): SessionUser | null {
  return useSyncExternalStore(
    tokenStore.subscribe,
    tokenStore.getUser,
    () => null,
  );
}

export function useHasPermission(code: string): boolean {
  const user = useSessionUser();
  return user?.permissions.includes(code) ?? false;
}

import { useEffect, useState, type ReactNode } from "react";
import { tokenStore } from "@/lib/token-store.ts";
import { refreshSession } from "@/services/auth.ts";

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const refreshToken = tokenStore.getRefreshToken();
      if (!refreshToken) {
        setReady(true);
        return;
      }

      try {
        const result = await refreshSession(refreshToken);
        if (result.data && !cancelled) {
          tokenStore.setSession(result.data);
        }
      } catch {
        if (!cancelled) {
          tokenStore.clear();
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/20 text-lg font-bold text-teal-300 ring-1 ring-teal-400/30">
            IT
          </div>
          <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-teal-400" />
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Loading workspace</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

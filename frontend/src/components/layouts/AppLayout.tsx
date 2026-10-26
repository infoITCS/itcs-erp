import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { navItems } from "@/app/router/nav.tsx";
import { useSessionUser } from "@/hooks/useSession.ts";
import { tokenStore } from "@/lib/token-store.ts";
import { logout } from "@/services/auth.ts";
import { NavIcon } from "./NavIcon.tsx";

function initials(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "U";
}

function roleLabel(roles: string[] | undefined): string {
  if (!roles || roles.length === 0) {
    return "Member";
  }
  const role = roles[0].replace(/_/g, " ");
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function AppLayout() {
  const navigate = useNavigate();
  const user = useSessionUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const visibleItems = navItems.filter(
    (item) => !item.permission || user?.permissions.includes(item.permission),
  );
  const groups: string[] = [];
  for (const item of visibleItems) {
    if (!groups.includes(item.group)) {
      groups.push(item.group);
    }
  }

  async function handleSignOut() {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    const refreshToken = tokenStore.getRefreshToken();
    try {
      if (refreshToken) {
        await logout(refreshToken);
      }
    } catch {
      return;
    } finally {
      tokenStore.clear();
      setMobileMenuOpen(false);
      navigate("/login", { replace: true });
    }
  }

  function Navigation({ compact = false }: { compact?: boolean }) {
    return (
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group}>
            <div className={compact ? "mb-2 flex items-center gap-2 px-1" : "mb-2 flex items-center gap-2 px-3"}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {group}
              </p>
              <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
            </div>
            <ul className={compact ? "grid grid-cols-2 gap-1.5" : "space-y-1"}>
              {visibleItems
                .filter((item) => item.group === group)
                .map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === "/"}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        compact
                          ? `group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                              isActive
                                ? "bg-teal-500/15 text-white ring-1 ring-inset ring-teal-400/20"
                                : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
                            }`
                          : `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${
                              isActive
                                ? "bg-white/[0.07] text-white shadow-sm ring-1 ring-inset ring-white/[0.06]"
                                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                            }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {!compact && isActive ? (
                            <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.8)]" />
                          ) : null}
                          <span
                            className={`flex shrink-0 items-center justify-center transition ${
                              compact
                                ? isActive
                                  ? "text-teal-300"
                                  : "text-slate-500 group-hover:text-slate-300"
                                : `h-7 w-7 rounded-md ${
                                    isActive
                                      ? "bg-teal-400/10 text-teal-300"
                                      : "text-slate-500 group-hover:bg-white/[0.04] group-hover:text-slate-300"
                                  }`
                            }`}
                          >
                            <NavIcon to={item.path} className={compact ? "h-4 w-4" : "h-[17px] w-[17px]"} />
                          </span>
                          <span className="truncate">{item.label}</span>
                          {!compact && isActive ? (
                            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-100 text-slate-900">
      <aside className="sticky top-0 hidden h-screen w-[276px] shrink-0 flex-col border-r border-white/[0.06] bg-slate-950 text-slate-200 lg:flex">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top_left,rgba(20,184,166,0.16),transparent_65%)]" />

        <div className="relative flex items-center gap-3 px-5 pb-5 pt-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400/20 to-cyan-500/10 shadow-[0_0_30px_-10px_rgba(45,212,191,0.8)] ring-1 ring-teal-300/20">
            <span className="text-[11px] font-bold tracking-[0.16em] text-teal-300">IT</span>
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-tight text-white">ITCS ERP</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Commercial operations</p>
          </div>
          <span
            className="ml-auto flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
            title="Connected"
          />
        </div>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <nav
          aria-label="Main navigation"
          className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-4 [scrollbar-color:rgba(148,163,184,0.25)_transparent] [scrollbar-width:thin]"
        >
          <Navigation />
        </nav>

        <div className="relative border-t border-white/[0.06] p-3">
          <NavLink
            to="/settings"
            className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 transition hover:border-teal-400/20 hover:bg-white/[0.05]"
          >
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-500/10 text-xs font-semibold text-teal-200 ring-1 ring-white/[0.08]">
              {initials(user?.firstName, user?.lastName)}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-white">
                {user ? `${user.firstName} ${user.lastName}` : "Account"}
              </span>
              <span className="block truncate text-[11px] text-slate-500">{roleLabel(user?.roles)}</span>
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ml-auto h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-slate-400"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </NavLink>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950">
                <span className="text-[10px] font-bold tracking-wider text-teal-300">IT</span>
              </div>
              <span className="text-sm font-semibold text-slate-900">ITCS ERP</span>
            </div>
            <p className="hidden truncate text-sm font-medium text-slate-500 lg:block">
              {user ? `Welcome, ${user.firstName}` : "Workspace"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="max-w-[28vw] truncate text-xs font-semibold text-slate-800 lg:max-w-xs">
                {user ? `${user.firstName} ${user.lastName}` : ""}
              </p>
              <p className="max-w-[28vw] truncate text-[11px] text-slate-500 lg:max-w-xs">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="hidden h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 sm:inline-flex"
            >
              {signingOut ? "Signing out" : "Sign out"}
            </button>
            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-50 lg:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                {mobileMenuOpen ? (
                  <path d="M6 6l12 12M18 6 6 18" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>

          {mobileMenuOpen ? (
            <nav
              id="mobile-navigation"
              aria-label="Main navigation"
              className="absolute left-0 right-0 top-full max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-slate-800 bg-slate-950/95 px-4 pb-5 pt-4 text-slate-200 shadow-2xl backdrop-blur lg:hidden"
            >
              <div className="mx-auto max-w-3xl">
                <Navigation compact />
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-500/10 text-xs font-semibold text-teal-200 ring-1 ring-white/[0.08]">
                      {initials(user?.firstName, user?.lastName)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {user ? `${user.firstName} ${user.lastName}` : "Account"}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.05] disabled:opacity-60"
                  >
                    {signingOut ? "Signing out" : "Sign out"}
                  </button>
                </div>
              </div>
            </nav>
          ) : null}
        </header>

        <main className="min-w-0 flex-1 p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { navItems, type NavItem } from "@/app/router/nav.tsx";
import { UserAvatar } from "@/components/ui/UserAvatar.tsx";
import { useSessionUser } from "@/hooks/useSession.ts";
import { tokenStore } from "@/lib/token-store.ts";
import { logout } from "@/services/auth.ts";
import { CommandPalette } from "./CommandPalette.tsx";
import { NavIcon } from "./NavIcon.tsx";

function roleLabel(roles: string[] | undefined): string {
  if (!roles || roles.length === 0) {
    return "Member";
  }
  const role = roles[0].replace(/_/g, " ");
  return role.charAt(0).toUpperCase() + role.slice(1);
}

const COLLAPSED_GROUPS_KEY = "itcs-erp-nav-collapsed";

function readCollapsedGroups(): Set<string> {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_GROUPS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : []);
  } catch {
    return new Set();
  }
}

function groupElementId(group: string): string {
  return `nav-group-${group.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

const SIDEBAR_COLLAPSED_KEY = "itcs-erp-sidebar-collapsed";

function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSessionUser();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(readCollapsedGroups);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [railTooltip, setRailTooltip] = useState<{ label: string; top: number } | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const railCollapsed = collapsed && isDesktop;
  const visibleItems = navItems.filter(
    (item) => !item.permission || user?.permissions.includes(item.permission),
  );
  const groups: string[] = [];
  for (const item of visibleItems) {
    if (!groups.includes(item.group)) {
      groups.push(item.group);
    }
  }
  const activeItem = visibleItems
    .filter((item) =>
      item.path === "/"
        ? location.pathname === "/"
        : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
    )
    .sort((left, right) => right.path.length - left.path.length)[0];
  const activeGroup = activeItem?.group;

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...collapsedGroups]));
    } catch {
      return;
    }
  }, [collapsedGroups]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      return;
    }
  }, [collapsed]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setCollapsed((value) => !value);
      } else if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => !value);
    setRailTooltip(null);
  }

  function handlePaletteSelect(item: NavItem) {
    setPaletteOpen(false);
    setMobileMenuOpen(false);
    navigate(item.path);
  }

  useEffect(() => {
    if (!activeGroup) {
      return;
    }
    setCollapsedGroups((current) => {
      if (!current.has(activeGroup)) {
        return current;
      }
      const next = new Set(current);
      next.delete(activeGroup);
      return next;
    });
  }, [activeGroup]);

  function toggleGroup(group: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }

  useEffect(() => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    setPaletteOpen(false);
    setRailTooltip(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!userMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [userMenuOpen]);

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
      setUserMenuOpen(false);
      navigate("/login", { replace: true });
    }
  }

  function Navigation() {
    return (
      <div className="space-y-1">
        {groups.map((group) => {
          const groupItems = visibleItems.filter((item) => item.group === group);
          const isCollapsed = collapsedGroups.has(group);
          const panelId = groupElementId(group);
          const groupActive = activeGroup === group;
          const groupIconPath = groupItems[0]?.path ?? "/";

          if (railCollapsed) {
            return (
              <button
                key={group}
                type="button"
                aria-label={group}
                onClick={() => {
                  setCollapsed(false);
                  setCollapsedGroups((current) => {
                    const next = new Set(current);
                    next.delete(group);
                    return next;
                  });
                }}
                onMouseEnter={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setRailTooltip({ label: group, top: rect.top + rect.height / 2 });
                }}
                onMouseLeave={() => setRailTooltip(null)}
                className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 ${
                  groupActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                }`}
              >
                <NavIcon to={groupIconPath} className="h-[18px] w-[18px]" />
              </button>
            );
          }

          return (
            <section key={group}>
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                aria-expanded={!isCollapsed}
                aria-controls={panelId}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-semibold tracking-tight transition-colors duration-200 ${
                  groupActive
                    ? "text-blue-700"
                    : "text-slate-800 hover:bg-slate-100"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center transition-colors duration-200 ${
                    groupActive
                      ? "text-blue-600"
                      : "text-slate-400 group-hover:text-slate-600"
                  }`}
                >
                  <NavIcon to={groupIconPath} className="h-[17px] w-[17px]" />
                </span>
                <span className="truncate">{group}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`ml-auto h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform duration-200 group-hover:text-slate-400 ${
                    isCollapsed ? "" : "rotate-180"
                  }`}
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div
                id={panelId}
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                  isCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
                }`}
              >
                <ul className="ml-[22px] min-h-0 space-y-0.5 overflow-hidden border-l border-slate-200 py-1 pl-3">
                  {groupItems.map((item) => (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        end={item.path === "/"}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors duration-200 ${
                            isActive
                              ? "bg-blue-50 font-semibold text-blue-700"
                              : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-200 ${
                                isActive
                                  ? "bg-blue-500"
                                  : "bg-slate-300 group-hover:bg-slate-400"
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-canvas text-slate-900">
      {mobileMenuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        id="app-sidebar"
        style={{ width: railCollapsed ? 80 : 256 }}
        className={`fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white text-slate-700 transition-[width,transform] duration-300 ease-in-out lg:sticky lg:inset-y-auto lg:top-0 lg:z-auto ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500/70 to-transparent" />

        <div
          className={`relative flex items-center gap-2 border-b border-slate-200 px-3 pb-3 pt-4 ${
            railCollapsed ? "flex-col" : ""
          }`}
        >
          <NavLink
            to="/"
            aria-label="ITCS ERP dashboard"
            className={`flex min-w-0 items-center gap-3 ${railCollapsed ? "" : "flex-1"}`}
          >
            {railCollapsed ? (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold text-white shadow-lg shadow-blue-600/20">
                IT
              </span>
            ) : (
              <>
                <img
                  src="/itcs-logo.webp"
                  alt="ITCS"
                  width={150}
                  height={83}
                  className="h-9 w-auto max-w-[120px] shrink-0 object-contain"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold tracking-tight text-slate-900">
                    ITCS ERP
                  </span>
                  <span className="block truncate text-[10px] uppercase tracking-[0.14em] text-slate-400">
                    Commercial ops
                  </span>
                </span>
              </>
            )}
          </NavLink>
          <button
            type="button"
            onClick={toggleCollapsed}
            title={railCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
            aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 lg:inline-flex"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              {railCollapsed ? (
                <>
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M9 4v16" />
                  <path d="m14 9 3 3-3 3" />
                </>
              ) : (
                <>
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M9 4v16" />
                  <path d="m16 9-3 3 3 3" />
                </>
              )}
            </svg>
          </button>
        </div>

        <div className="relative px-3 pb-1 pt-1">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            title="Search modules (Ctrl+K)"
            className={`flex w-full items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-600 ${
              railCollapsed ? "justify-center py-2.5" : "justify-between px-3 py-2"
            }`}
          >
            <span className="flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 shrink-0"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              {!railCollapsed ? (
                <span className="truncate text-xs font-medium">Search modules...</span>
              ) : null}
            </span>
            {!railCollapsed ? (
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                Ctrl K
              </kbd>
            ) : null}
          </button>
        </div>

        <div className="relative mx-3 my-2 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        <nav
          aria-label="Main navigation"
          className="relative min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2 [scrollbar-color:rgba(148,163,184,0.3)_transparent] [scrollbar-width:thin]"
        >
          <Navigation />
        </nav>

        <div className="relative border-t border-slate-200 p-3">
          {railCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <NavLink
                to="/settings"
                aria-label="Account settings"
                className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 hover:bg-slate-100"
              >
                <UserAvatar
                  firstName={user?.firstName}
                  lastName={user?.lastName}
                  src={user?.avatarUrl}
                  className="relative h-9 w-9 rounded-lg ring-1 ring-slate-200"
                  fallbackClassName="bg-gradient-to-br from-blue-500 to-blue-700 text-white"
                  textClassName="text-xs"
                >
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
                </UserAvatar>
              </NavLink>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                aria-label="Sign out"
                title="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <NavLink
                to="/settings"
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg transition-colors duration-200 hover:bg-slate-100"
              >
                <UserAvatar
                  firstName={user?.firstName}
                  lastName={user?.lastName}
                  src={user?.avatarUrl}
                  className="relative h-9 w-9 rounded-lg ring-1 ring-slate-200"
                  fallbackClassName="bg-gradient-to-br from-blue-500 to-blue-700 text-white"
                  textClassName="text-xs"
                >
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-50 bg-emerald-400" />
                </UserAvatar>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-700">
                    {user ? `${user.firstName} ${user.lastName}` : "Account"}
                  </span>
                  <span className="block truncate text-[11px] text-slate-400">
                    {roleLabel(user?.roles)}
                  </span>
                </span>
              </NavLink>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                aria-label="Sign out"
                title="Sign out"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {railTooltip ? (
        <div
          className="pointer-events-none fixed left-[92px] z-[60] -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl"
          style={{ top: railTooltip.top }}
        >
          {railTooltip.label}
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
          <div className="relative flex h-16 items-center gap-3 px-3 sm:px-5 lg:px-6">
            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-controls="app-sidebar"
              aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 lg:hidden"
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

            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 text-slate-600 shadow-sm lg:flex">
                <NavIcon to={activeItem?.path ?? "/"} className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  <span className="truncate">{activeItem?.group ?? "Overview"}</span>
                  <span className="hidden h-1 w-1 shrink-0 rounded-full bg-slate-300 sm:block" />
                  <span className="hidden shrink-0 text-slate-300 sm:block">Workspace</span>
                </div>
                <h1 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
                  {activeItem?.label ?? "Dashboard"}
                </h1>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              {user?.permissions.includes("notifications:read") ? (
                <NavLink
                  to="/notifications"
                  aria-label="Notifications"
                  title="Notifications"
                  className={({ isActive }) =>
                    `inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition ${
                      isActive
                        ? "border-brand-200 bg-brand-50 text-brand-700"
                        : "border-slate-200/80 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900"
                    }`
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-[18px] w-[18px]"
                    aria-hidden="true"
                  >
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                  </svg>
                </NavLink>
              ) : null}

              <span className="mx-0.5 hidden h-6 w-px bg-slate-200 sm:block" />

              <div ref={userMenuRef} className="relative">
                <button
                  type="button"
                  aria-label="Account menu"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  className={`flex h-10 items-center gap-2 rounded-xl border py-1 pl-1 pr-1.5 shadow-sm transition sm:pr-2 ${
                    userMenuOpen
                      ? "border-slate-300 bg-slate-50"
                      : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <UserAvatar
                    firstName={user?.firstName}
                    lastName={user?.lastName}
                    src={user?.avatarUrl}
                    className="relative h-8 w-8 rounded-lg shadow-sm"
                    textClassName="text-[11px]"
                  >
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                  </UserAvatar>
                  <span className="hidden min-w-0 text-left sm:block">
                    <span className="block max-w-[9rem] truncate text-xs font-semibold text-slate-900 lg:max-w-[12rem]">
                      {user ? `${user.firstName} ${user.lastName}` : "Account"}
                    </span>
                    <span className="block max-w-[9rem] truncate text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 lg:max-w-[12rem]">
                      {roleLabel(user?.roles)}
                    </span>
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`hidden h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform sm:block ${
                      userMenuOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {userMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5"
                  >
                    <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-4 py-3.5">
                      <UserAvatar
                        firstName={user?.firstName}
                        lastName={user?.lastName}
                        src={user?.avatarUrl}
                        className="h-10 w-10 rounded-xl ring-1 ring-slate-200"
                        textClassName="text-xs"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {user ? `${user.firstName} ${user.lastName}` : "Account"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{user?.email}</p>
                      </div>
                    </div>
                    <div className="p-1.5">
                      <NavLink
                        to="/settings"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.7}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4 text-slate-400"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4 21a8 8 0 0 1 16 0" />
                        </svg>
                        Profile & settings
                      </NavLink>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleSignOut}
                        disabled={signingOut}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.7}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <path d="m16 17 5-5-5-5" />
                          <path d="M21 12H9" />
                        </svg>
                        {signingOut ? "Signing out..." : "Sign out"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-300/80 to-transparent" />
        </header>

        <main className="min-w-0 flex-1 p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        items={visibleItems}
        onClose={() => setPaletteOpen(false)}
        onSelect={handlePaletteSelect}
      />
    </div>
  );
}

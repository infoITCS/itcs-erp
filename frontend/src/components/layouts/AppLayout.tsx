import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { navItems } from "@/app/router/nav.tsx";
import { tokenStore } from "@/lib/token-store.ts";

export function AppLayout() {
  const signedInEmail = tokenStore.getEmail();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const groups: string[] = [];
  for (const item of navItems) {
    if (!groups.includes(item.group)) {
      groups.push(item.group);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-100 text-slate-900">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-slate-200 lg:flex">
        <div className="px-4 py-4">
          <p className="text-xs font-medium tracking-wide text-slate-400">ITCS</p>
          <p className="text-base font-semibold text-white">ERP</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {groups.map((group) => (
            <div key={group} className="mt-4">
              <p className="px-2 pb-1 text-xs font-medium text-slate-500">{group}</p>
              <ul className="flex flex-col gap-0.5">
                {navItems
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        end={item.path === "/"}
                        className={({ isActive }) =>
                          isActive
                            ? "block rounded-md bg-slate-800 px-2 py-1.5 text-sm text-white"
                            : "block rounded-md px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-900"
                        }
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:hidden"
            >
              {mobileMenuOpen ? "Close" : "Menu"}
            </button>
            <p className="hidden truncate text-sm font-medium text-slate-600 sm:block">ITCS ERP</p>
          </div>
          <p className="min-w-0 max-w-[60%] shrink truncate pl-3 text-right text-xs font-medium text-slate-700 sm:max-w-none sm:text-sm">{signedInEmail}</p>
          {mobileMenuOpen ? (
            <nav id="mobile-navigation" aria-label="Main navigation" className="absolute left-0 right-0 top-full max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-slate-700 bg-slate-950 px-3 pb-4 text-slate-200 shadow-lg lg:hidden">
              {groups.map((group) => (
                <div key={group} className="mt-4">
                  <p className="px-2 pb-1 text-xs font-medium text-slate-500">{group}</p>
                  <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                    {navItems.filter((item) => item.group === group).map((item) => (
                      <li key={item.path}>
                        <NavLink
                          to={item.path}
                          end={item.path === "/"}
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) => isActive
                            ? "block rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white"
                            : "block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-900"}
                        >
                          {item.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
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

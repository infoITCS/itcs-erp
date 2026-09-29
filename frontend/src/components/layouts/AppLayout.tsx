import { NavLink, Outlet } from "react-router-dom";
import { navItems } from "@/app/router/nav.tsx";
import { tokenStore } from "@/lib/token-store.ts";

export function AppLayout() {
  const signedInEmail = tokenStore.getEmail();
  const groups: string[] = [];
  for (const item of navItems) {
    if (!groups.includes(item.group)) {
      groups.push(item.group);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-slate-200">
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
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
          <p className="text-sm text-slate-500">ITCS ERP</p>
          {signedInEmail ? (
            <p className="text-sm font-medium text-slate-700">{signedInEmail}</p>
          ) : (
            <NavLink to="/login" className="text-sm font-medium text-slate-700">
              Sign in
            </NavLink>
          )}
        </header>
        <main className="min-w-0 flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

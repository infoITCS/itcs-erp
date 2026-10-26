import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useHasPermission, useSessionUser } from "@/hooks/useSession.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getUserStats, type UserStats } from "@/features/users/api.ts";
import { fetchHealth } from "@/services/health.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";

const liveAreas = [
  {
    label: "Customers",
    path: "/customers",
    group: "CRM",
    blurb: "Accounts, contacts, balances",
    permission: "customers:read",
  },
  {
    label: "Opportunities",
    path: "/opportunities",
    group: "CRM",
    blurb: "Pipeline and prospect conversion",
    permission: "opportunities:read",
  },
  {
    label: "Products",
    path: "/products",
    group: "Supply",
    blurb: "Catalog, prices, categories",
    permission: "products:read",
  },
  {
    label: "Resellers",
    path: "/resellers",
    group: "CRM",
    blurb: "Channel partners and assignments",
    permission: "resellers:read",
  },
];

const quickActions = [
  { label: "Add customer", path: "/customers/new", permission: "customers:create" },
  { label: "Add product", path: "/products/new", permission: "products:create" },
  { label: "Add reseller", path: "/resellers/new", permission: "resellers:create" },
  { label: "Create opportunity", path: "/opportunities/new", permission: "opportunities:create" },
];

const upcomingWidgets = [
  { title: "Total sales", group: "Sales" },
  { title: "Invoiced amount", group: "Sales" },
  { title: "Paid amount", group: "Sales" },
  { title: "Outstanding amount", group: "Sales" },
  { title: "Overdue amount", group: "Sales" },
  { title: "Tender pipeline", group: "CRM" },
  { title: "Top customers", group: "CRM" },
  { title: "Upcoming renewals", group: "Delivery" },
];

function AdminSnapshot({ users }: { users: UserStats }) {
  const items = [
    { label: "Users", value: users.total },
    { label: "Active", value: users.active },
    { label: "Inactive", value: users.inactive },
    { label: "Locked", value: users.locked },
    { label: "Roles", value: users.roles },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-medium text-slate-500">{item.label}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-950">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const user = useSessionUser();
  const canReadUsers = useHasPermission("users:read");
  const canManageUsers = useHasPermission("users:update") || useHasPermission("users:create");
  const canReadAudit = useHasPermission("audit-logs:read");
  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: fetchHealth,
  });
  const userStats = useQuery({
    queryKey: ["users", "stats"],
    queryFn: getUserStats,
    enabled: canReadUsers,
  });
  const areas = liveAreas.filter((area) => user?.permissions.includes(area.permission));
  const actions = quickActions.filter((action) => user?.permissions.includes(action.permission));
  const role = user?.roles.includes("admin") ? "Administrator" : user?.roles[0] ?? "Member";
  const today = new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date());

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-5 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
            <span className="h-2 w-2 rounded-full bg-teal-600" />
            Overview
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            {user ? `Welcome back, ${user.firstName}` : "Dashboard"}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>{today}</span>
            <span className="text-slate-300">·</span>
            <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-800 ring-1 ring-inset ring-teal-100">
              {role}
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white/90 px-4 py-3 text-sm shadow-sm">
          {health.isPending ? <p className="text-slate-500">Checking the API…</p> : null}
          {health.isError ? <p className="text-red-700">{getApiErrorMessage(health.error)}</p> : null}
          {health.data ? (
            <p className="flex items-center gap-2 text-slate-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              API {health.data.message}
            </p>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Your workspace</h2>
              <p className="mt-0.5 text-xs text-slate-500">Only the modules and actions your role allows.</p>
            </div>
            {actions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {actions.slice(0, 2).map((action) => (
                  <Link
                    key={action.path}
                    to={action.path}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {areas.length === 0 ? (
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">
              No module permissions are assigned to your account yet. Contact an administrator.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {areas.map((area) => (
                <li key={area.path}>
                  <Link
                    to={area.path}
                    className="group flex h-full flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-white hover:shadow-md"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">{area.group}</p>
                    <p className="mt-1.5 text-base font-semibold text-slate-950 group-hover:text-teal-900">
                      {area.label}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{area.blurb}</p>
                    <span className="mt-3 text-xs font-medium text-teal-800">Open →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-4">
          {canManageUsers || canReadAudit ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">Administration</h2>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  Admin
                </span>
              </div>
              {canReadUsers && userStats.data ? (
                <div className="mt-3">
                  <AdminSnapshot users={userStats.data} />
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {canManageUsers ? (
                  <Link
                    to="/users"
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Manage users
                  </Link>
                ) : null}
                {canReadAudit ? (
                  <Link
                    to="/settings"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View audit log
                  </Link>
                ) : null}
                <Link
                  to="/settings"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Account settings
                </Link>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-sm font-semibold text-slate-900">Account</h2>
              <p className="mt-1 text-xs text-slate-500">Review your profile and sign-in security.</p>
              <Link
                to="/settings"
                className="mt-3 inline-flex rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open settings
              </Link>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-slate-900">Access summary</h2>
            <dl className="mt-3 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Signed in as</dt>
                <dd className="truncate font-medium text-slate-800">{user?.email}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Roles</dt>
                <dd className="font-medium text-slate-800">{user?.roles.join(", ") || "None"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Permissions</dt>
                <dd className="font-medium text-slate-800">{user?.permissions.length ?? 0}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Upcoming analytics</h2>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {upcomingWidgets.length} widgets
          </span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {upcomingWidgets.map((widget) => (
            <li
              key={widget.title}
              className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-4 transition hover:border-slate-400 hover:bg-white"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{widget.group}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{widget.title}</p>
              <p className="mt-2 text-xs text-slate-500">Awaiting a drill-down endpoint</p>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

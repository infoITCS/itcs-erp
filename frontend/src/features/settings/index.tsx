import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button.tsx";
import { ProfilePanel } from "@/features/profile/index.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { getProviders } from "@/services/auth.ts";
import { listAuditLogs } from "@/services/audit-logs.ts";
import { listRoles } from "@/services/roles.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";

type SettingsTab = "profile" | "roles" | "audit" | "sign-in";

const tabs: Array<{ id: SettingsTab; label: string; description: string; permission?: string }> = [
  {
    id: "profile",
    label: "Profile",
    description: "Your account details, security, organization, and access",
  },
  {
    id: "roles",
    label: "Roles & permissions",
    description: "Roles available in this organization",
    permission: "roles:read",
  },
  {
    id: "audit",
    label: "Audit log",
    description: "Recent security and business activity",
    permission: "audit-logs:read",
  },
  { id: "sign-in", label: "Sign-in", description: "Microsoft SSO and password sign-in status" },
];

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function RolesTab() {
  const roles = useQuery({ queryKey: ["roles"], queryFn: listRoles, staleTime: 5 * 60 * 1000 });

  return (
    <div className="flex flex-col gap-5">
      <Card title="Roles" description="Role assignments are managed from the Users page.">
        {roles.isPending ? <p className="text-sm text-slate-500">Loading roles…</p> : null}
        {roles.isError ? (
          <p className="text-sm text-red-700">{getApiErrorMessage(roles.error)}</p>
        ) : null}
        {roles.data?.length === 0 ? (
          <p className="text-sm text-slate-500">No roles are configured.</p>
        ) : null}
        <div className="flex flex-col gap-3">
          {roles.data?.map((role) => (
            <article key={role.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{role.name}</h3>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                      {role.code}
                    </span>
                    {role.isSystem ? (
                      <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-800">
                        System
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {role.description ?? "No description"}
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {role.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-inset ring-slate-200"
                  >
                    {permission}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}

function summarize(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = JSON.stringify(value);
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

function AuditTab() {
  const audit = useInfiniteQuery({
    queryKey: ["audit-logs"],
    queryFn: ({ pageParam }) => listAuditLogs({ cursor: pageParam ?? undefined, limit: 25 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
  });
  const entries = audit.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Card
      title="Audit log"
      description="Newest events first. Values are truncated for readability."
    >
      {audit.isPending ? <p className="text-sm text-slate-500">Loading audit events…</p> : null}
      {audit.isError ? (
        <p className="text-sm text-red-700">{getApiErrorMessage(audit.error)}</p>
      ) : null}
      {!audit.isPending && entries.length === 0 ? (
        <p className="text-sm text-slate-500">No audit events have been recorded.</p>
      ) : null}
      <ol className="flex flex-col divide-y divide-slate-100">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-1.5 py-3 first:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                {entry.module}
              </span>
              <p className="text-sm font-medium text-slate-900">{entry.action}</p>
              <span className="ml-auto text-[11px] text-slate-500">
                {formatDateTime(entry.createdAt)}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {entry.entityType}
              {entry.entityId ? ` · ${entry.entityId}` : ""}
              {entry.ipAddress ? ` · ${entry.ipAddress}` : ""}
            </p>
            {summarize(entry.newValues) ? (
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer select-none hover:text-slate-800">
                  Changed values
                </summary>
                <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-[10px] text-slate-600">
                  {summarize(entry.newValues)}
                </pre>
              </details>
            ) : null}
          </li>
        ))}
      </ol>
      {audit.hasNextPage ? (
        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={() => audit.fetchNextPage()}
            disabled={audit.isFetchingNextPage}
          >
            {audit.isFetchingNextPage ? "Loading…" : "Load older events"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function SignInTab() {
  const providers = useQuery({ queryKey: ["auth", "providers"], queryFn: getProviders, retry: 0 });
  const microsoft = providers.data?.data?.microsoft ?? false;
  const domain = providers.data?.data?.microsoftDomain;

  return (
    <div className="flex flex-col gap-5">
      <Card
        title="Sign-in methods"
        description="Configuration is controlled by the API environment."
      >
        {providers.isPending ? (
          <p className="text-sm text-slate-500">Checking sign-in providers…</p>
        ) : null}
        {providers.isError ? (
          <p className="text-sm text-red-700">{getApiErrorMessage(providers.error)}</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Email and password</h3>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                Enabled
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Accounts created by an administrator can sign in with a password. Passwords are hashed
              with bcrypt and never returned by the API.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Microsoft 365</h3>
              <span
                className={
                  microsoft
                    ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200"
                    : "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200"
                }
              >
                {microsoft ? "Enabled" : "Not configured"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Single-tenant Microsoft sign-in for company accounts
              {domain ? (
                <>
                  {" "}
                  on <span className="font-medium text-slate-700">@{domain}</span>
                </>
              ) : null}
              . Company tenant and email domain are enforced by the API.
            </p>
          </div>
        </div>
      </Card>

      <Card title="Administrator note" description="What to do when SSO needs attention.">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-slate-600">
          <li>
            Microsoft credentials and redirect URIs are stored only in the backend environment.
          </li>
          <li>
            Users without an ERP account must be invited from the Users page before SSO can link
            them.
          </li>
          <li>Deactivating a user revokes active refresh tokens and blocks further sign-in.</li>
        </ul>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const canReadRoles = useHasPermission("roles:read");
  const canReadAudit = useHasPermission("audit-logs:read");
  const visibleTabs = tabs.filter((tab) => {
    if (tab.permission === "roles:read") {
      return canReadRoles;
    }
    if (tab.permission === "audit-logs:read") {
      return canReadAudit;
    }
    return true;
  });
  const current = visibleTabs.some((tab) => tab.id === activeTab) ? activeTab : "profile";
  const currentTab = tabs.find((tab) => tab.id === current) ?? tabs[0];

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          System / Settings
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Manage your profile, security, organization workspace, and account access.
        </p>
      </header>

      <div className="flex min-w-0 flex-col gap-5">
        <nav
          aria-label="Settings sections"
          className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={current === tab.id ? "page" : undefined}
              onClick={() => setActiveTab(tab.id)}
              className={
                current === tab.id
                  ? "shrink-0 rounded-lg bg-brand-800 px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
                  : "shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-950">{currentTab.label}</h2>
            <p className="text-sm text-slate-500">{currentTab.description}</p>
          </div>
          {current === "profile" ? <ProfilePanel /> : null}
          {current === "roles" ? <RolesTab /> : null}
          {current === "audit" ? <AuditTab /> : null}
          {current === "sign-in" ? <SignInTab /> : null}
        </div>
      </div>
    </section>
  );
}

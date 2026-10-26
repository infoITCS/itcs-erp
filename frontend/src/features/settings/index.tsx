import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useHasPermission, useSessionUser } from "@/hooks/useSession.ts";
import { tokenStore } from "@/lib/token-store.ts";
import { changePassword, getProviders, logoutAll } from "@/services/auth.ts";
import { listAuditLogs } from "@/services/audit-logs.ts";
import { listOrganizations } from "@/services/organizations.ts";
import { listRoles } from "@/services/roles.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";

type SettingsTab = "profile" | "security" | "organization" | "roles" | "audit" | "sign-in";

const tabs: Array<{ id: SettingsTab; label: string; description: string; permission?: string }> = [
  { id: "profile", label: "Profile", description: "Your account details and effective access" },
  { id: "security", label: "Security", description: "Password and active sessions" },
  {
    id: "organization",
    label: "Organization",
    description: "Company profile used across the ERP",
    permission: "organizations:read",
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

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
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

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 last:border-0 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function ProfileTab() {
  const user = useSessionUser();
  const grouped = new Map<string, string[]>();
  for (const permission of user?.permissions ?? []) {
    const [module] = permission.split(":");
    grouped.set(module, [...(grouped.get(module) ?? []), permission.split(":")[1]]);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card title="Account" description="Profile details are managed by your ERP administrator.">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-800 text-lg font-semibold text-white">
            {`${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "U"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-950">
              {user ? `${user.firstName} ${user.lastName}` : "Account"}
            </p>
            <p className="truncate text-sm text-slate-500">{user?.email}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {user?.roles.map((role) => (
                <span key={role} className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>
        <dl>
          <InfoRow label="User ID" value={<span className="break-all font-mono text-xs">{user?.id}</span>} />
          <InfoRow label="Organization ID" value={<span className="break-all font-mono text-xs">{user?.organizationId}</span>} />
          <InfoRow label="Roles" value={user?.roles.join(", ") || "No roles assigned"} />
          <InfoRow label="Permissions" value={`${user?.permissions.length ?? 0} granted`} />
        </dl>
      </Card>

      <Card title="Effective permissions" description="Read-only view of what your roles allow in this organization.">
        {grouped.size === 0 ? (
          <p className="text-sm text-slate-500">No permissions are assigned.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {[...grouped.entries()].map(([module, actions]) => (
              <div key={module} className="flex flex-col gap-1.5 rounded-lg bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{module}</p>
                <div className="flex flex-wrap gap-1">
                  {actions.map((action) => (
                    <span key={action} className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SecurityTab() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const change = useMutation({
    mutationFn: () => changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      tokenStore.clear();
      window.location.replace("/login?passwordChanged=1");
    },
  });
  const signOutEverywhere = useMutation({
    mutationFn: logoutAll,
    onSuccess: () => {
      tokenStore.clear();
      navigate("/login", { replace: true });
    },
  });

  function submit() {
    setError(null);
    setSuccess(null);
    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }
    if (newPassword.length < 12) {
      setError("The new password must be at least 12 characters.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("The new password must be different from the current password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    change.mutate();
  }

  return (
    <div className="flex flex-col gap-5">
      <Card title="Change password" description="Use a unique password of at least 12 characters.">
        <form
          className="flex max-w-xl flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="current-password" className="text-sm font-medium text-slate-700">
              Current password
            </label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="h-10"
              autoComplete="current-password"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="settings-new-password" className="text-sm font-medium text-slate-700">
                New password
              </label>
              <Input
                id="settings-new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="h-10"
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="settings-confirm-password" className="text-sm font-medium text-slate-700">
                Confirm new password
              </label>
              <Input
                id="settings-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-10"
                autoComplete="new-password"
              />
            </div>
          </div>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {change.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(change.error)}</p> : null}
          {success ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</p> : null}

          <div>
            <Button type="submit" className="bg-teal-800 hover:bg-teal-900" disabled={change.isPending}>
              {change.isPending ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Sessions" description="Revoke every refresh token issued to your account.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm text-slate-600">
            Signing out everywhere ends all sessions, including this browser. You will be returned to the
            sign-in page.
          </p>
          <Button
            variant="secondary"
            className="border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => setSignOutOpen(true)}
          >
            Sign out everywhere
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={signOutOpen}
        title="Sign out everywhere?"
        description="Every active session for your account will be revoked."
        confirmLabel="Sign out everywhere"
        busy={signOutEverywhere.isPending}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => signOutEverywhere.mutate()}
      />
    </div>
  );
}

function OrganizationTab() {
  const organizations = useQuery({
    queryKey: ["organizations"],
    queryFn: listOrganizations,
  });
  const organization = organizations.data?.[0];

  return (
    <Card title="Organization" description="Organization details come from the backend deployment.">
      {organizations.isPending ? <p className="text-sm text-slate-500">Loading organization…</p> : null}
      {organizations.isError ? (
        <p className="text-sm text-red-700">{getApiErrorMessage(organizations.error)}</p>
      ) : null}
      {organization ? (
        <dl>
          <InfoRow label="Name" value={organization.name} />
          <InfoRow label="Code" value={<span className="font-mono">{organization.code}</span>} />
          <InfoRow label="Base currency" value={organization.baseCurrencyCode} />
          <InfoRow
            label="Status"
            value={
              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                {organization.status}
              </span>
            }
          />
          <InfoRow label="Organization ID" value={<span className="break-all font-mono text-xs">{organization.id}</span>} />
        </dl>
      ) : null}
      {!organizations.isPending && !organizations.isError && !organization ? (
        <p className="text-sm text-slate-500">No active organization is linked to your account.</p>
      ) : null}
    </Card>
  );
}

function RolesTab() {
  const roles = useQuery({ queryKey: ["roles"], queryFn: listRoles, staleTime: 5 * 60 * 1000 });

  return (
    <div className="flex flex-col gap-5">
      <Card title="Roles" description="Role assignments are managed from the Users page.">
        {roles.isPending ? <p className="text-sm text-slate-500">Loading roles…</p> : null}
        {roles.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(roles.error)}</p> : null}
        {roles.data?.length === 0 ? <p className="text-sm text-slate-500">No roles are configured.</p> : null}
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
                      <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal-800">
                        System
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{role.description ?? "No description"}</p>
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
    <Card title="Audit log" description="Newest events first. Values are truncated for readability.">
      {audit.isPending ? <p className="text-sm text-slate-500">Loading audit events…</p> : null}
      {audit.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(audit.error)}</p> : null}
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
              <span className="ml-auto text-[11px] text-slate-500">{formatDateTime(entry.createdAt)}</span>
            </div>
            <p className="text-xs text-slate-500">
              {entry.entityType}
              {entry.entityId ? ` · ${entry.entityId}` : ""}
              {entry.ipAddress ? ` · ${entry.ipAddress}` : ""}
            </p>
            {summarize(entry.newValues) ? (
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer select-none hover:text-slate-800">Changed values</summary>
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
      <Card title="Sign-in methods" description="Configuration is controlled by the API environment.">
        {providers.isPending ? <p className="text-sm text-slate-500">Checking sign-in providers…</p> : null}
        {providers.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(providers.error)}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Email and password</h3>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                Enabled
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Accounts created by an administrator can sign in with a password. Passwords are hashed with
              bcrypt and never returned by the API.
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
          <li>Microsoft credentials and redirect URIs are stored only in the backend environment.</li>
          <li>Users without an ERP account must be invited from the Users page before SSO can link them.</li>
          <li>Deactivating a user revokes active refresh tokens and blocks further sign-in.</li>
        </ul>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const canReadOrganizations = useHasPermission("organizations:read");
  const canReadRoles = useHasPermission("roles:read");
  const canReadAudit = useHasPermission("audit-logs:read");
  const visibleTabs = tabs.filter((tab) => {
    if (tab.permission === "organizations:read") {
      return canReadOrganizations;
    }
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
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
          <span className="h-2 w-2 rounded-full bg-teal-600" />
          System / Settings
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Manage your profile and security, review organization access, and check sign-in configuration.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="sm:hidden">
          <label htmlFor="settings-section" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Settings section
          </label>
          <div className="relative">
            <select
              id="settings-section"
              value={current}
              onChange={(event) => setActiveTab(event.target.value as SettingsTab)}
              className="h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3.5 pr-10 text-sm font-medium text-slate-900 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
            >
              {visibleTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
                d="m5 7.5 5 5 5-5"
              />
            </svg>
          </div>
        </div>

        <nav
          aria-label="Settings sections"
          className="hidden gap-1 pb-1 sm:flex lg:flex-col lg:pb-0"
        >
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={
                current === tab.id
                  ? "shrink-0 rounded-lg bg-slate-900 px-3 py-2.5 text-left text-sm font-semibold text-white lg:w-full"
                  : "shrink-0 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900 lg:w-full"
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
          {current === "profile" ? <ProfileTab /> : null}
          {current === "security" ? <SecurityTab /> : null}
          {current === "organization" ? <OrganizationTab /> : null}
          {current === "roles" ? <RolesTab /> : null}
          {current === "audit" ? <AuditTab /> : null}
          {current === "sign-in" ? <SignInTab /> : null}
        </div>
      </div>
    </section>
  );
}

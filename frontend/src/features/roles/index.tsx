import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useHasPermission, useIsAdmin, useRealUser } from "@/hooks/useSession.ts";
import { tokenStore } from "@/lib/token-store.ts";
import { impersonateUser } from "@/services/auth.ts";
import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  updateRole,
  type Permission,
  type PermissionRisk,
  type Role,
} from "@/services/roles.ts";
import { listUsers, updateUser, type UserSummary } from "@/features/users/api.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { cn } from "@/utils/cn.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PermissionModuleView {
  module: string;
  moduleName: string;
  group: string;
  description: string;
  sortOrder: number;
  actions: Permission[];
}

type ActivePanel = "permissions" | "users";

// ─── Icons ───────────────────────────────────────────────────────────────────

function ShieldIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function UsersIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function LockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function PlusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CopyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function EditIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ChevronRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ZapIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function AlertTriangleIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
    </svg>
  );
}

function XIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// ─── Risk Badges ─────────────────────────────────────────────────────────────

function RiskBadge({ risk }: { risk: PermissionRisk }) {
  if (risk === "critical") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-sm bg-red-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-700" title="Critical permission — full control">
        <ZapIcon />
        Critical
      </span>
    );
  }
  if (risk === "sensitive") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-sm bg-amber-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700" title="Sensitive permission">
        <AlertTriangleIcon />
        Sensitive
      </span>
    );
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roleMatches(role: Role, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return [role.name, role.code, role.description ?? ""].some((v) =>
    v.toLowerCase().includes(q),
  );
}

function samePermissions(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const set = new Set(left);
  return right.every((code) => set.has(code));
}

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function userRoleCodes(user: UserSummary): string[] {
  return user.userRoles.map((r) => r.role.code);
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  tone: "slate" | "brand" | "emerald" | "amber" | "indigo";
}) {
  const tones = {
    slate:  { ring: "ring-slate-200",  icon: "bg-slate-100 text-slate-600",   text: "text-slate-500"   },
    brand:  { ring: "ring-brand-200",  icon: "bg-brand-50 text-brand-700",    text: "text-brand-700"   },
    emerald:{ ring: "ring-emerald-200",icon: "bg-emerald-50 text-emerald-700",text: "text-emerald-700" },
    amber:  { ring: "ring-amber-200",  icon: "bg-amber-50 text-amber-700",    text: "text-amber-700"   },
    indigo: { ring: "ring-indigo-200", icon: "bg-indigo-50 text-indigo-700",  text: "text-indigo-700"  },
  };
  const s = tones[tone];
  return (
    <div className={cn("rounded-xl border bg-white p-4 shadow-sm ring-1", s.ring)}>
      <div className="flex items-center gap-3">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", s.icon)}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="text-xl font-bold tabular-nums text-slate-950">{value}</p>
          {sub ? <p className={cn("text-[11px] font-medium", s.text)}>{sub}</p> : null}
        </div>
      </div>
    </div>
  );
}

// ─── Role List Item ───────────────────────────────────────────────────────────

function RoleListItem({
  role,
  active,
  totalPermissions,
  onClick,
}: {
  role: Role;
  active: boolean;
  totalPermissions: number;
  onClick: () => void;
}) {
  const coveragePercent =
    totalPermissions > 0 ? Math.round((role.permissions.length / totalPermissions) * 100) : 0;
  const isAdmin = role.code === "admin";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition-all duration-150",
        active
          ? "border-slate-800 bg-slate-900/[0.04] shadow-xs ring-1 ring-slate-800/15"
          : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/70 hover:shadow-xs",
      )}
    >
      {/* Active Indicator on left */}
      {active && (
        <span
          className="absolute inset-y-2.5 left-0 w-1 rounded-r-full bg-slate-900"
          aria-hidden="true"
        />
      )}

      {/* Top row: Role icon, Name, Code, and System/Custom Tag */}
      <div className="flex items-start justify-between gap-2 pl-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition",
              isAdmin
                ? "bg-amber-50 text-amber-700 ring-amber-200"
                : role.isSystem
                  ? "bg-slate-100 text-slate-700 ring-slate-200"
                  : "bg-brand-50 text-brand-700 ring-brand-200",
            )}
          >
            {isAdmin ? (
              <LockIcon className="h-3.5 w-3.5" />
            ) : role.isSystem ? (
              <ShieldIcon className="h-3.5 w-3.5" />
            ) : (
              <UsersIcon className="h-3.5 w-3.5" />
            )}
          </span>
          <div className="min-w-0">
            <span
              className={cn(
                "block truncate text-sm font-semibold transition",
                active ? "font-bold text-slate-950" : "text-slate-900 group-hover:text-slate-950",
              )}
            >
              {role.name}
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {role.code}
            </span>
          </div>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ring-inset",
            isAdmin
              ? "bg-amber-50 text-amber-800 ring-amber-200"
              : role.isSystem
                ? "bg-slate-100 text-slate-600 ring-slate-200"
                : "bg-brand-50 text-brand-800 ring-brand-200",
          )}
        >
          {isAdmin ? "Super Admin" : role.isSystem ? "System" : "Custom"}
        </span>
      </div>

      {/* Description */}
      {role.description ? (
        <p className="line-clamp-1 pl-1 text-[11px] text-slate-500">
          {role.description}
        </p>
      ) : null}

      {/* Bottom meta row: Permissions bar / pill, and user count */}
      <div className="flex items-center justify-between border-t border-slate-100/80 pt-2 pl-1 text-[10px] font-medium text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="tabular-nums font-semibold text-slate-700">
            {role.permissions.length}
          </span>
          <span className="text-slate-400">perms</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
            {coveragePercent}%
          </span>
        </span>

        <span className="inline-flex items-center gap-1">
          <UsersIcon className="h-3 w-3 text-slate-400" />
          <span className="tabular-nums font-semibold text-slate-700">{role.userCount}</span>
          <span className="text-slate-400">users</span>
          {active && <ChevronRightIcon className="ml-1 h-3 w-3 text-slate-900" />}
        </span>
      </div>
    </button>
  );
}

// ─── Permission Module Card ───────────────────────────────────────────────────

function ModuleCard({
  module,
  draft,
  canEdit,
  onTogglePermission,
  onToggleModule,
}: {
  module: PermissionModuleView;
  draft: string[];
  canEdit: boolean;
  onTogglePermission: (code: string) => void;
  onToggleModule: (module: PermissionModuleView) => void;
}) {
  const draftSet = new Set(draft);
  const selectedCount = module.actions.filter((a) => draftSet.has(a.code)).length;
  const allSelected = selectedCount === module.actions.length;
  const partialSelected = selectedCount > 0 && !allSelected;
  const criticalCount = module.actions.filter((a) => a.risk === "critical").length;
  const sensitiveCount = module.actions.filter((a) => a.risk === "sensitive").length;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Module header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-semibold text-slate-900">{module.moduleName}</h3>
            <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400 ring-1 ring-inset ring-slate-200">
              {module.group}
            </span>
            {criticalCount > 0 && (
              <span className="rounded-sm bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
                {criticalCount} critical
              </span>
            )}
            {sensitiveCount > 0 && (
              <span className="rounded-sm bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                {sensitiveCount} sensitive
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{module.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Mini progress pill */}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
              allSelected
                ? "bg-emerald-100 text-emerald-800"
                : partialSelected
                  ? "bg-brand-100 text-brand-800"
                  : "bg-slate-100 text-slate-500",
            )}
          >
            {selectedCount}/{module.actions.length}
          </span>
          {canEdit ? (
            <button
              type="button"
              onClick={() => onToggleModule(module)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[10px] font-semibold transition",
                allSelected
                  ? "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  : "border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100",
              )}
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Permission chips */}
      <div className="flex flex-wrap gap-1.5 p-3.5">
        {module.actions.map((action) => {
          const checked = draftSet.has(action.code);
          return (
            <label
              key={action.id}
              title={action.description}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all duration-100",
                checked
                  ? "border-brand-700 bg-brand-800 text-white shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white",
                !canEdit && "cursor-default",
                !canEdit && !checked && "opacity-40",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={!canEdit}
                onChange={() => onTogglePermission(action.code)}
              />
              <span
                className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border",
                  checked ? "border-white/50 bg-white/15" : "border-slate-300 bg-white",
                )}
              >
                {checked ? <CheckIcon /> : null}
              </span>
              {action.actionLabel}
              <RiskBadge risk={action.risk} />
            </label>
          );
        })}
      </div>
    </section>
  );
}

// ─── Users in Role Panel ──────────────────────────────────────────────────────

function RoleUsersPanel({
  role,
  canAssign,
  isAdmin,
  currentUserId,
  onImpersonate,
}: {
  role: Role;
  canAssign: boolean;
  isAdmin?: boolean;
  currentUserId?: string;
  onImpersonate?: (user: UserSummary) => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["users", { limit: 200 }],
    queryFn: () => listUsers({ limit: 200 }),
    staleTime: 60_000,
  });

  const users = usersQuery.data?.items ?? [];
  const roleUsers = users.filter((u) => userRoleCodes(u).includes(role.code));
  const nonRoleUsers = users.filter((u) => !userRoleCodes(u).includes(role.code));

  const filteredRoleUsers = roleUsers.filter((u) => {
    const q = search.trim().toLowerCase();
    return !q || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q);
  });

  const removeMutation = useMutation({
    mutationFn: (user: UserSummary) => {
      const codes = userRoleCodes(user).filter((c) => c !== role.code);
      return updateUser(user.id, { roleCodes: codes });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });

  const statusStyles: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    INACTIVE: "bg-slate-100 text-slate-600 ring-slate-200",
    LOCKED: "bg-amber-50 text-amber-700 ring-amber-200",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center shadow-sm">
          <p className="text-xl font-bold tabular-nums text-slate-950">{roleUsers.length}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total Users</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center shadow-sm">
          <p className="text-xl font-bold tabular-nums text-emerald-900">
            {roleUsers.filter((u) => u.status === "ACTIVE").length}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Active</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center shadow-sm">
          <p className="text-xl font-bold tabular-nums text-amber-900">
            {roleUsers.filter((u) => u.status === "LOCKED").length}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Locked</p>
        </div>
      </div>

      {/* Search + assign button */}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users in this role…"
            className="h-9 pl-9"
          />
        </div>
        {canAssign && nonRoleUsers.length > 0 && (
          <Button
            onClick={() => setAssignOpen(true)}
            className="h-9 shrink-0 bg-brand-800 px-3 text-xs hover:bg-brand-900"
          >
            <PlusIcon className="mr-1 h-3.5 w-3.5" />
            Assign user
          </Button>
        )}
      </div>

      {/* User list */}
      {usersQuery.isPending ? (
        <p className="rounded-xl bg-slate-50 py-10 text-center text-sm text-slate-500">Loading users…</p>
      ) : filteredRoleUsers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-12 text-center">
          <UsersIcon className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">No users assigned</p>
          <p className="mt-1 text-xs text-slate-400">
            {canAssign ? "Click Assign user to add members to this role." : "No users currently hold this role."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filteredRoleUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">Last login: {formatDate(user.lastLoginAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
                    statusStyles[user.status] ?? "bg-slate-100 text-slate-600",
                  )}
                >
                  {user.status}
                </span>
                {isAdmin && user.id !== currentUserId && user.status === "ACTIVE" && onImpersonate && (
                  <button
                    type="button"
                    onClick={() => onImpersonate(user)}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-900 shadow-xs transition hover:bg-amber-100"
                    title={`Impersonate ${user.firstName}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3 w-3">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Impersonate
                  </button>
                )}
                {canAssign && !role.isSystem && (
                  <button
                    type="button"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(user)}
                    className="rounded-md border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-40"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign user modal */}
      {assignOpen && (
        <AssignUserModal
          role={role}
          availableUsers={nonRoleUsers}
          onClose={() => setAssignOpen(false)}
          onAssigned={async () => {
            await queryClient.invalidateQueries({ queryKey: ["users"] });
            await queryClient.invalidateQueries({ queryKey: ["roles"] });
            setAssignOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Assign User Modal ────────────────────────────────────────────────────────

function AssignUserModal({
  role,
  availableUsers,
  onClose,
  onAssigned,
}: {
  role: Role;
  availableUsers: UserSummary[];
  onClose: () => void;
  onAssigned: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const filtered = availableUsers.filter((u) => {
    const q = search.trim().toLowerCase();
    return !q || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q);
  });

  const mutation = useMutation({
    mutationFn: (user: UserSummary) => {
      const codes = [...userRoleCodes(user), role.code];
      return updateUser(user.id, { roleCodes: codes });
    },
    onSuccess: async () => {
      await onAssigned();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const selectedUser = availableUsers.find((u) => u.id === selectedId);

  return (
    <Modal open title={`Assign user to ${role.name}`} onClose={mutation.isPending ? () => undefined : onClose}>
      <div className="flex flex-col gap-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="h-10 pl-9"
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No users available.</p>
          ) : (
            filtered.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedId(user.id === selectedId ? "" : user.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition last:border-0",
                  user.id === selectedId ? "bg-brand-50" : "hover:bg-slate-50",
                )}
              >
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    user.id === selectedId
                      ? "border-brand-600 bg-brand-600"
                      : "border-slate-300 bg-white",
                  )}
                >
                  {user.id === selectedId && <CheckIcon className="h-3 w-3 text-white" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            className="bg-brand-800 hover:bg-brand-900"
            disabled={!selectedUser || mutation.isPending}
            onClick={() => {
              if (selectedUser) {
                mutation.mutate(selectedUser);
              }
            }}
          >
            {mutation.isPending ? "Assigning…" : `Assign to ${role.name}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Create Role Modal ────────────────────────────────────────────────────────

function CreateRoleModal({
  source,
  roles,
  onClose,
  onCreated,
}: {
  source: Role | null;
  roles: Role[];
  onClose: () => void;
  onCreated: (role: Role) => Promise<void>;
}) {
  const [name, setName] = useState(source ? `${source.name} copy` : "");
  const [description, setDescription] = useState(source?.description ?? "");
  const [startFrom, setStartFrom] = useState(source?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const baseRole = source ?? roles.find((r) => r.id === startFrom) ?? null;

  const mutation = useMutation({
    mutationFn: () =>
      createRole({
        name: name.trim(),
        description: description.trim() || null,
        permissions: baseRole?.permissions ?? [],
      }),
    onSuccess: async (role) => {
      await onCreated(role);
      onClose();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function submit() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Role name must be at least 2 characters.");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal open title={source ? `Duplicate "${source.name}"` : "Create new role"} onClose={mutation.isPending ? () => undefined : onClose}>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role-name" className="text-sm font-medium text-slate-700">Role name <span className="text-red-500">*</span></label>
          <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Regional Sales Manager" className="h-10" autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role-desc" className="text-sm font-medium text-slate-700">Description</label>
          <textarea
            id="role-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Who is this role for and what should they access?"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500"
          />
        </div>
        {source ? (
          <div className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-900">
            Starts with the same <span className="font-semibold">{source.permissions.length}</span> permissions as <span className="font-semibold">{source.name}</span>. Adjust them after creation.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="role-base" className="text-sm font-medium text-slate-700">Start from</label>
            <select
              id="role-base"
              value={startFrom}
              onChange={(e) => setStartFrom(e.target.value)}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500"
            >
              <option value="">Blank role (no permissions)</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.permissions.length} permissions
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">Copies the selected role's permissions as a one-time starting point.</p>
          </div>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" className="bg-brand-800 hover:bg-brand-900" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create role"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Role Modal ──────────────────────────────────────────────────────────

function EditRoleModal({
  role,
  onClose,
  onUpdated,
}: {
  role: Role;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => updateRole(role.id, { name: name.trim(), description: description.trim() || null }),
    onSuccess: async () => { await onUpdated(); },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function submit() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Role name must be at least 2 characters.");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal open title={`Edit "${role.name}"`} onClose={mutation.isPending ? () => undefined : onClose}>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-role-name" className="text-sm font-medium text-slate-700">Role name <span className="text-red-500">*</span></label>
          <Input id="edit-role-name" value={name} onChange={(e) => setName(e.target.value)} className="h-10" autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-role-desc" className="text-sm font-medium text-slate-700">Description</label>
          <textarea
            id="edit-role-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500"
          />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {mutation.isError && <p className="text-sm text-red-700">{getApiErrorMessage(mutation.error)}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" className="bg-brand-800 hover:bg-brand-900" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const realUser = useRealUser();
  const canCreate = useHasPermission("roles:create");
  const canUpdate = useHasPermission("roles:update");
  const canDelete = useHasPermission("roles:delete");
  const canReadUsers = useHasPermission("users:read");
  const canUpdateUsers = useHasPermission("users:update");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roleSearch, setRoleSearch] = useState("");
  const [roleFilterType, setRoleFilterType] = useState<"all" | "system" | "custom">("all");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [draft, setDraft] = useState<string[]>([]);
  const [createSource, setCreateSource] = useState<Role | null | undefined>(undefined);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>("permissions");

  const [impersonatingUser, setImpersonatingUser] = useState<UserSummary | null>(null);
  const [roleUsersPickerRole, setRoleUsersPickerRole] = useState<Role | null>(null);
  const [roleNotice, setRoleNotice] = useState<string | null>(null);
  const [impersonateError, setImpersonateError] = useState<string | null>(null);

  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: listRoles });
  const permissionsQuery = useQuery({
    queryKey: ["permissions"],
    queryFn: listPermissions,
    staleTime: 10 * 60 * 1000,
  });
  const usersQuery = useQuery({
    queryKey: ["users", { limit: 200 }],
    queryFn: () => listUsers({ limit: 200 }),
    enabled: canReadUsers,
    staleTime: 60_000,
  });

  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const allUsers = usersQuery.data?.items ?? [];

  const filteredRoles = useMemo(() => {
    return roles.filter((r) => roleMatches(r, roleSearch));
  }, [roles, roleSearch]);

  const displayedRoles = useMemo(() => {
    return filteredRoles.filter((role) => {
      if (roleFilterType === "system") return role.isSystem;
      if (roleFilterType === "custom") return !role.isSystem;
      return true;
    });
  }, [filteredRoles, roleFilterType]);

  const selectedRole =
    roles.find((r) => r.id === selectedId) ?? displayedRoles[0] ?? roles[0] ?? null;
  const canEditSelected = Boolean(selectedRole && canUpdate);
  const savedPermissions = selectedRole?.permissions ?? [];
  const isDirty = canEditSelected && !samePermissions(draft, savedPermissions);

  const modules = useMemo<PermissionModuleView[]>(() => {
    const byModule = new Map<string, PermissionModuleView>();
    for (const permission of permissions) {
      let mod = byModule.get(permission.module);
      if (!mod) {
        mod = {
          module: permission.module,
          moduleName: permission.moduleName,
          group: permission.group,
          description: permission.moduleDescription,
          sortOrder: permission.moduleSortOrder,
          actions: [],
        };
        byModule.set(permission.module, mod);
      }
      mod.actions.push(permission);
    }
    return [...byModule.values()]
      .map((mod) => ({
        ...mod,
        actions: [...mod.actions].sort((a, b) => a.actionSortOrder - b.actionSortOrder),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [permissions]);

  const groups = useMemo(() => [...new Set(modules.map((m) => m.group))], [modules]);

  const filteredModules = useMemo(() => {
    const q = permissionSearch.trim().toLowerCase();
    return modules.filter((mod) => {
      if (groupFilter !== "all" && mod.group !== groupFilter) return false;
      if (!q) return true;
      return (
        mod.moduleName.toLowerCase().includes(q) ||
        mod.description.toLowerCase().includes(q) ||
        mod.actions.some(
          (a) =>
            a.actionLabel.toLowerCase().includes(q) ||
            a.code.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q),
        )
      );
    });
  }, [modules, groupFilter, permissionSearch]);

  useEffect(() => {
    setDraft(selectedRole ? [...selectedRole.permissions] : []);
    setActivePanel("permissions");
  }, [selectedRole?.id]);

  useEffect(() => {
    if (selectedRole?.permissions) {
      setDraft([...selectedRole.permissions]);
    }
  }, [selectedRole?.permissions]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selectedRole) throw new Error("No role selected");
      return updateRole(selectedRole.id, { permissions: draft });
    },
    onSuccess: async () => { await refreshRoles(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => deleteRole(roleId),
    onSuccess: async () => {
      setDeleting(null);
      setDeleteError(null);
      setSelectedId(null);
      await refreshRoles();
    },
    onError: (err) => setDeleteError(getApiErrorMessage(err)),
  });

  const impersonateMutation = useMutation({
    mutationFn: (userId: string) => impersonateUser(userId),
    onSuccess: (result, userId) => {
      const target = allUsers.find((u) => u.id === userId);
      if (!result.data || !target) return;
      tokenStore.startImpersonation({
        accessToken: result.data.accessToken,
        user: {
          ...result.data.user,
          organizationId: realUser?.organizationId ?? "",
        },
        adminName: `${realUser?.firstName ?? ""} ${realUser?.lastName ?? ""}`.trim(),
      });
      setImpersonatingUser(null);
      setRoleUsersPickerRole(null);
    },
    onError: (err) => setImpersonateError(getApiErrorMessage(err)),
  });

  function handleImpersonateRole(role: Role) {
    setRoleNotice(null);
    setImpersonateError(null);
    const roleUsers = allUsers.filter(
      (u) => userRoleCodes(u).includes(role.code) && u.status === "ACTIVE" && u.id !== realUser?.id,
    );
    if (roleUsers.length === 0) {
      setRoleNotice(
        `No active user currently has the "${role.name}" role. Assign a user to this role first to test/impersonate it.`,
      );
    } else if (roleUsers.length === 1) {
      setImpersonatingUser(roleUsers[0]);
    } else {
      setRoleUsersPickerRole(role);
    }
  }

  async function refreshRoles() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["roles"] }),
      queryClient.invalidateQueries({ queryKey: ["users"] }),
    ]);
  }

  function togglePermission(code: string) {
    if (!canEditSelected) return;
    setDraft((cur) => cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]);
  }

  function toggleModule(module: PermissionModuleView) {
    if (!canEditSelected) return;
    const codes = module.actions.map((a) => a.code);
    const selected = new Set(draft);
    const allSel = codes.every((c) => selected.has(c));
    if (allSel) {
      codes.forEach((c) => selected.delete(c));
    } else {
      codes.forEach((c) => selected.add(c));
    }
    setDraft([...selected]);
  }

  function selectAll() {
    if (!canEditSelected) return;
    setDraft(permissions.map((p) => p.code));
  }

  function clearAll() {
    if (!canEditSelected) return;
    setDraft([]);
  }

  async function handleCreated(role: Role) {
    await refreshRoles();
    setSelectedId(role.id);
    setCreateSource(undefined);
  }

  // Statistics
  const totalAssignments = roles.reduce((sum, r) => sum + r.userCount, 0);
  const systemCount = roles.filter((r) => r.isSystem).length;
  const customRoles = roles.filter((r) => !r.isSystem).length;
  const criticalPermsTotal = permissions.filter((p) => p.risk === "critical").length;
  const selectedRoleUserCount = selectedRole
    ? allUsers.filter((u) => userRoleCodes(u).includes(selectedRole.code)).length
    : 0;

  const listError = rolesQuery.isError ? getApiErrorMessage(rolesQuery.error) : null;
  const permissionError = permissionsQuery.isError ? getApiErrorMessage(permissionsQuery.error) : null;

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">

      {/* ── Page Header ──────────────────────────────────────────────── */}
      <header className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
              <span className="h-2 w-2 rounded-full bg-brand-600" />
              System / Access Control
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Roles &amp; Permissions
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Full access control center — define roles, assign granular module-level permissions, and manage user assignments from one place. Administrator accounts always retain all permissions.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <Link
              to="/users"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <UsersIcon className="h-3.5 w-3.5" />
              Manage Users
            </Link>
            {canCreate ? (
              <Button
                onClick={() => setCreateSource(null)}
                className="h-9 bg-slate-900 px-4 text-xs hover:bg-slate-800"
              >
                <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                New Role
              </Button>
            ) : null}
          </div>
        </div>

        {/* Risk legend */}
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Permission risk levels:</span>
          <span className="inline-flex items-center gap-1 rounded-sm bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Standard — normal read/write operations</span>
          <span className="inline-flex items-center gap-0.5 rounded-sm bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            <AlertTriangleIcon className="h-2.5 w-2.5" /> Sensitive — may expose confidential data
          </span>
          <span className="inline-flex items-center gap-0.5 rounded-sm bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
            <ZapIcon className="h-2.5 w-2.5" /> Critical — destructive or admin-level
          </span>
        </div>
      </header>

      {/* ── KPI Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total Roles"
          value={roles.length}
          sub={`${customRoles} custom`}
          icon={<ShieldIcon />}
          tone="brand"
        />
        <KpiCard
          label="Total Users"
          value={allUsers.length}
          sub={`${totalAssignments} assignments`}
          icon={<UsersIcon />}
          tone="emerald"
        />
        <KpiCard
          label="Permissions"
          value={permissions.length}
          sub={`${criticalPermsTotal} critical`}
          icon={<LockIcon />}
          tone="indigo"
        />
        <KpiCard
          label="Custom Roles"
          value={customRoles}
          sub="admin-defined"
          icon={<EditIcon />}
          tone="amber"
        />
      </div>

      {/* ── Main Layout ───────────────────────────────────────── */}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">

        {/* ── Left: Professional Role Directory Sidebar ───────────────── */}
        <aside className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm xl:sticky xl:top-6 xl:h-[calc(100dvh-3rem)]">
          {/* Header */}
          <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs">
                  <ShieldIcon className="h-3.5 w-3.5" />
                </span>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Roles Directory
                  </h2>
                  <p className="text-[10px] text-slate-500">
                    {roles.length} total access profiles
                  </p>
                </div>
              </div>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => setCreateSource(null)}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-xs transition hover:bg-slate-800"
                >
                  <PlusIcon className="h-3 w-3" />
                  New Role
                </button>
              )}
            </div>

            {/* Search bar */}
            <div className="relative mt-3">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                placeholder="Search name, code, description…"
                aria-label="Search roles"
                className="h-9 bg-white pl-9 pr-8 text-xs placeholder:text-slate-400"
              />
              {roleSearch && (
                <button
                  type="button"
                  onClick={() => setRoleSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Quick Segment Filter */}
            <div className="mt-3 flex rounded-lg bg-slate-200/60 p-0.5 text-[11px] font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setRoleFilterType("all")}
                className={cn(
                  "flex-1 rounded-md py-1 text-center font-semibold transition",
                  roleFilterType === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                All ({roles.length})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilterType("system")}
                className={cn(
                  "flex-1 rounded-md py-1 text-center font-semibold transition",
                  roleFilterType === "system"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                System ({systemCount})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilterType("custom")}
                className={cn(
                  "flex-1 rounded-md py-1 text-center font-semibold transition",
                  roleFilterType === "custom"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                Custom ({customRoles})
              </button>
            </div>
          </div>

          {/* List of Roles */}
          <div className="flex-1 min-h-0 space-y-2 overflow-y-auto p-3.5 [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">
            {rolesQuery.isPending ? (
              <div className="space-y-2 p-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : null}

            {!rolesQuery.isPending && displayedRoles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-10 text-center">
                <SearchIcon className="mx-auto h-6 w-6 text-slate-300" />
                <p className="mt-2 text-xs font-semibold text-slate-700">No matching roles found</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {roleSearch ? "Try adjusting your search terms" : "No roles in this category"}
                </p>
                {(roleSearch || roleFilterType !== "all") && (
                  <button
                    type="button"
                    onClick={() => { setRoleSearch(""); setRoleFilterType("all"); }}
                    className="mt-3 text-xs font-semibold text-slate-900 underline hover:text-slate-700"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : null}

            {displayedRoles.map((role) => (
              <RoleListItem
                key={role.id}
                role={role}
                active={role.id === selectedRole?.id}
                totalPermissions={permissions.length}
                onClick={() => setSelectedId(role.id)}
              />
            ))}
          </div>

          {/* Footer Summary */}
          <div className="shrink-0 flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-[11px] text-slate-500">
            <span className="font-medium">
              Showing {displayedRoles.length} of {roles.length} roles
            </span>
            <Link
              to="/users"
              className="font-semibold text-slate-700 hover:text-slate-900 hover:underline"
            >
              All Users →
            </Link>
          </div>

          {listError && (
            <p className="border-t border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{listError}</p>
          )}
        </aside>

        {/* ── Right: Role Detail ────────────────────────────────────── */}
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!selectedRole ? (
            <div className="flex flex-col items-center justify-center px-6 py-24">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-300">
                <ShieldIcon className="h-8 w-8" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-700">Select a role</p>
              <p className="mt-1 max-w-xs text-center text-sm text-slate-500">
                Choose a role from the list to review permissions, assigned users, and make changes.
              </p>
              {canCreate && (
                <Button
                  onClick={() => setCreateSource(null)}
                  className="mt-5 bg-slate-900 hover:bg-slate-800"
                >
                  <PlusIcon className="mr-1.5 h-4 w-4" />
                  Create first role
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Role detail header */}
              <div className="border-b border-slate-200 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-200">
                      <ShieldIcon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-xl font-bold tracking-tight text-slate-950">
                          {selectedRole.name}
                        </h2>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            selectedRole.isSystem
                              ? "bg-slate-100 text-slate-600"
                              : "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200",
                          )}
                        >
                          {selectedRole.isSystem ? "System role" : "Custom role"}
                        </span>
                      </div>
                      <p className="mt-1 max-w-xl text-sm text-slate-600">
                        {selectedRole.description ?? "No description provided."}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="font-mono text-slate-400">{selectedRole.code}</span>
                        <span className="inline-flex items-center gap-1">
                          <UsersIcon className="h-3.5 w-3.5" />
                          {selectedRoleUserCount} user{selectedRoleUserCount === 1 ? "" : "s"} assigned
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <LockIcon className="h-3.5 w-3.5" />
                          {selectedRole.permissions.length} of {permissions.length} permissions
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {isAdmin && selectedRole.code !== "admin" && (
                      <button
                        type="button"
                        onClick={() => handleImpersonateRole(selectedRole)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900 shadow-xs transition hover:bg-amber-100"
                        title="Impersonate a user with this role to test and preview ERP access"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5 text-amber-700">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Impersonate role
                      </button>
                    )}
                    {canCreate && (
                      <button
                        type="button"
                        onClick={() => setCreateSource(selectedRole)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <CopyIcon className="h-3.5 w-3.5" />
                        Duplicate
                      </button>
                    )}
                    {!selectedRole.isSystem && canUpdate && (
                      <button
                        type="button"
                        onClick={() => setEditing(selectedRole)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <EditIcon className="h-3.5 w-3.5" />
                        Edit details
                      </button>
                    )}
                    {!selectedRole.isSystem && canDelete && (
                      <button
                        type="button"
                        disabled={selectedRole.userCount > 0}
                        title={selectedRole.userCount > 0 ? "Remove from all users first" : "Delete role"}
                        onClick={() => { setDeleteError(null); setDeleting(selectedRole); }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Info banners */}
                {selectedRole.code === "admin" ? (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>Administrator accounts always have every permission at sign-in. Changes here do not restrict admins.</span>
                  </div>
                ) : selectedRole.isSystem ? (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
                    <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                    <span>System role permissions are fully editable. Changes persist and are not reset on restart.</span>
                  </div>
                ) : null}
              </div>

              {/* Sub-navigation tabs: Permissions | Users */}
              <div className="border-b border-slate-200 bg-slate-50/60">
                <div className="flex items-center justify-between gap-4 px-5 py-2">
                  <nav className="flex gap-1">
                    {(["permissions", "users"] as ActivePanel[]).map((panel) => (
                      <button
                        key={panel}
                        type="button"
                        onClick={() => setActivePanel(panel)}
                        className={cn(
                          "rounded-lg px-3.5 py-1.5 text-xs font-semibold capitalize transition",
                          activePanel === panel
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                        )}
                      >
                        {panel === "permissions"
                          ? `Permissions (${draft.length})`
                          : `Users (${selectedRoleUserCount})`}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>

              {/* ── Permissions Panel ─────────────────────────────────── */}
              {activePanel === "permissions" && (
                <>
                  {/* Permission toolbar */}
                  <div className="sticky top-16 z-10 border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-1 flex-wrap items-center gap-2">
                        <div className="relative min-w-0 flex-1 sm:max-w-xs">
                          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            value={permissionSearch}
                            onChange={(e) => setPermissionSearch(e.target.value)}
                            placeholder="Find a permission…"
                            className="h-9 pl-9"
                          />
                        </div>
                        <select
                          value={groupFilter}
                          onChange={(e) => setGroupFilter(e.target.value)}
                          className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-slate-500"
                        >
                          <option value="all">All groups</option>
                          {groups.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                        {canEditSelected && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={selectAll}
                              className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              onClick={clearAll}
                              className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Clear all
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-700">
                          {draft.length} / {permissions.length} selected
                        </span>
                        {isDirty && (
                          <>
                            <Button
                              variant="ghost"
                              onClick={() => setDraft([...savedPermissions])}
                              disabled={saveMutation.isPending}
                              className="h-8 px-2.5 text-xs"
                            >
                              Reset
                            </Button>
                            <Button
                              onClick={() => saveMutation.mutate()}
                              disabled={saveMutation.isPending}
                              className="h-8 bg-brand-800 px-3.5 text-xs hover:bg-brand-900"
                            >
                              {saveMutation.isPending ? "Saving…" : "Save permissions"}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {saveMutation.isError && (
                      <p className="mt-2 text-xs text-red-700">{getApiErrorMessage(saveMutation.error)}</p>
                    )}
                    {permissionError && (
                      <p className="mt-2 text-xs text-red-700">{permissionError}</p>
                    )}
                  </div>

                  {/* Permission module grid */}
                  <div className="p-5">
                    {permissionsQuery.isPending ? (
                      <p className="rounded-xl bg-slate-50 py-16 text-center text-sm text-slate-500">
                        Loading permission catalog…
                      </p>
                    ) : null}
                    {!permissionsQuery.isPending && filteredModules.length === 0 ? (
                      <p className="rounded-xl bg-slate-50 py-16 text-center text-sm text-slate-500">
                        No permissions match this search.
                      </p>
                    ) : null}
                    <div className="grid gap-3 2xl:grid-cols-2">
                      {filteredModules.map((module) => (
                        <ModuleCard
                          key={module.module}
                          module={module}
                          draft={draft}
                          canEdit={canEditSelected}
                          onTogglePermission={togglePermission}
                          onToggleModule={toggleModule}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── Users Panel ───────────────────────────────────────── */}
              {activePanel === "users" && (
                <div className="p-5">
                  {canReadUsers ? (
                    <RoleUsersPanel
                      role={selectedRole}
                      canAssign={canUpdateUsers}
                      isAdmin={isAdmin}
                      currentUserId={realUser?.id}
                      onImpersonate={(user) => {
                        setImpersonateError(null);
                        setImpersonatingUser(user);
                      }}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
                      <LockIcon className="mx-auto h-7 w-7 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-600">No access</p>
                      <p className="mt-1 text-xs text-slate-400">You don't have permission to view users.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {createSource !== undefined ? (
        <CreateRoleModal
          source={createSource}
          roles={roles}
          onClose={() => setCreateSource(undefined)}
          onCreated={handleCreated}
        />
      ) : null}

      {editing ? (
        <EditRoleModal
          role={editing}
          onClose={() => setEditing(null)}
          onUpdated={async () => {
            await refreshRoles();
            setEditing(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete role?"
        description={
          <div className="flex flex-col gap-2">
            <p>
              Permanently delete <span className="font-semibold text-slate-900">{deleting?.name}</span>? This cannot be undone. Roles assigned to users must be unassigned first.
            </p>
            {deleteError ? (
              <p role="alert" className="text-red-700">{deleteError}</p>
            ) : null}
          </div>
        }
        confirmLabel="Delete role"
        busy={deleteMutation.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id);
        }}
      />

      {/* Impersonation confirm dialog */}
      <ConfirmDialog
        open={impersonatingUser !== null}
        title={`Impersonate ${impersonatingUser?.firstName} ${impersonatingUser?.lastName}?`}
        description={
          <div className="flex flex-col gap-2">
            <p>
              You are about to preview and test the ERP system as{" "}
              <span className="font-semibold text-slate-900">{impersonatingUser?.email}</span> (
              <span className="font-medium text-brand-700">
                {impersonatingUser ? userRoleCodes(impersonatingUser).join(", ") : ""}
              </span>
              ).
            </p>
            <p className="text-xs text-slate-500">
              Only modules permitted to this user will be visible. An amber banner at the top will allow you to return to your administrator account at any time.
            </p>
            {impersonateError && (
              <p role="alert" className="text-xs text-red-700">
                {impersonateError}
              </p>
            )}
          </div>
        }
        confirmLabel="Start Impersonation"
        busy={impersonateMutation.isPending}
        onCancel={() => setImpersonatingUser(null)}
        onConfirm={() => {
          if (impersonatingUser) impersonateMutation.mutate(impersonatingUser.id);
        }}
      />

      {/* Select user to impersonate from role */}
      {roleUsersPickerRole && (
        <Modal
          open
          title={`Select user with "${roleUsersPickerRole.name}" role`}
          onClose={() => setRoleUsersPickerRole(null)}
        >
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-500">
              Multiple users hold this role. Choose which account you would like to impersonate:
            </p>
            <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
              {allUsers
                .filter(
                  (u) =>
                    userRoleCodes(u).includes(roleUsersPickerRole.code) &&
                    u.status === "ACTIVE" &&
                    u.id !== realUser?.id,
                )
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setImpersonatingUser(u);
                      setRoleUsersPickerRole(null);
                    }}
                    className="flex w-full items-center justify-between p-3 text-left transition hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {u.firstName} {u.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                    <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                      Select →
                    </span>
                  </button>
                ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setRoleUsersPickerRole(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Role notice modal */}
      {roleNotice && (
        <Modal open title="Role Impersonation" onClose={() => setRoleNotice(null)}>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p>{roleNotice}</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setRoleNotice(null)}>Got it</Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

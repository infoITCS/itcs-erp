import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { useHasPermission, useIsAdmin, useRealUser, useSessionUser } from "@/hooks/useSession.ts";
import { tokenStore } from "@/lib/token-store.ts";
import { impersonateUser } from "@/services/auth.ts";
import { listRoles, type Role } from "@/services/roles.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { cn } from "@/utils/cn.ts";
import {
  createUser,
  getUserStats,
  listUsers,
  removeUser,
  resetUserPassword,
  updateUser,
  type AccountStatus,
  type CreateUserInput,
  type UpdateUserInput,
  type UserSummary,
} from "./api.ts";

const PAGE_SIZE = 50;

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function UsersIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ShieldIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function UnlockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function PlusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function EditIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function KeyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  );
}

function TrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function CopyIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RefreshCwIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

function AlertTriangleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function XIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatRelativeTime(value: string | null): string {
  if (!value) return "Never signed in";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 5) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(value);
}

function roleNames(user: UserSummary): string[] {
  return user.userRoles.map((link) => link.role.name);
}

function isUserAdmin(user: UserSummary): boolean {
  return user.userRoles.some((link) => link.role.code === "admin");
}

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const symbols = "!@#$%&*";
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  let value = "Itcs-";
  for (let index = 0; index < 12; index += 1) {
    value += alphabet[bytes[index] % alphabet.length];
  }
  return `${value}${symbols[bytes[13] % symbols.length]}9`;
}

const avatarPalettes = [
  { bg: "bg-indigo-100", text: "text-indigo-800", ring: "ring-indigo-300" },
  { bg: "bg-emerald-100", text: "text-emerald-800", ring: "ring-emerald-300" },
  { bg: "bg-blue-100", text: "text-blue-800", ring: "ring-blue-300" },
  { bg: "bg-amber-100", text: "text-amber-800", ring: "ring-amber-300" },
  { bg: "bg-violet-100", text: "text-violet-800", ring: "ring-violet-300" },
  { bg: "bg-rose-100", text: "text-rose-800", ring: "ring-rose-300" },
];

function getAvatarStyle(email: string) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash << 5) - hash + email.charCodeAt(i);
  }
  return avatarPalettes[Math.abs(hash) % avatarPalettes.length];
}

// ─── Status Pill Component ────────────────────────────────────────────────────

function UserStatusPill({ status, failedCount = 0 }: { status: AccountStatus; failedCount?: number }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Active
      </span>
    );
  }

  if (status === "LOCKED") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 shadow-xs"
        title={failedCount > 0 ? `${failedCount} consecutive failed logins` : "Account locked"}
      >
        <AlertTriangleIcon className="h-3 w-3 text-amber-600" />
        Locked {failedCount > 0 ? `(${failedCount}x)` : ""}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Inactive
    </span>
  );
}

// ─── Executive KPI Card ───────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: number | string | undefined;
  sub: string;
  icon: React.ReactNode;
  tone: "brand" | "emerald" | "amber" | "indigo";
}) {
  const toneClasses = {
    brand: "bg-brand-50 text-brand-700 border-brand-200/80 ring-brand-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-emerald-100",
    amber: "bg-amber-50 text-amber-800 border-amber-200/80 ring-amber-100",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200/80 ring-indigo-100",
  }[tone];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl border ring-1 ring-inset transition group-hover:scale-105", toneClasses)}>
          {icon}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-slate-600">
          Directory
        </span>
      </div>
      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950 tabular-nums">
          {value ?? "—"}
        </p>
      </div>
      <p className="mt-2 text-xs font-medium text-slate-500 border-t border-slate-100 pt-2">{sub}</p>
    </div>
  );
}

// ─── Password Field Component ─────────────────────────────────────────────────

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "new-password",
  placeholder = "At least 12 characters",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyPass() {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          {label} <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2">
          {value && (
            <button
              type="button"
              onClick={copyPass}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              {copied ? <CheckIcon className="h-3 w-3 text-emerald-600" /> : <CopyIcon className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange(generatePassword())}
            className="text-xs font-bold text-brand-700 hover:text-brand-900"
          >
            Generate Secure
          </button>
        </div>
      </div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="h-10 pr-14 font-mono text-sm"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-slate-500 hover:text-slate-800"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

// ─── Role Picker Component ───────────────────────────────────────────────────

function RolePicker({
  roles,
  selected,
  onChange,
}: {
  roles: Role[];
  selected: string[];
  onChange: (codes: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          Assigned Roles <span className="text-red-500">*</span>
        </p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
          {selected.length} selected
        </span>
      </div>
      <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 [scrollbar-width:thin]">
        {roles.map((role) => {
          const checked = selected.includes(role.code);
          const isAdmin = role.code === "admin";
          return (
            <label
              key={role.id}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-all",
                checked
                  ? "border-slate-800 bg-slate-900/[0.04] ring-1 ring-slate-800/20"
                  : "border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-100/60",
              )}
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                checked={checked}
                onChange={(event) => {
                  onChange(
                    event.target.checked
                      ? [...selected, role.code]
                      : selected.filter((code) => code !== role.code),
                  );
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-900">{role.name}</span>
                  {isAdmin && (
                    <span className="rounded-sm bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-800 uppercase tracking-wide">
                      Admin
                    </span>
                  )}
                </span>
                <span className="mt-0.5 line-clamp-1 block text-[11px] text-slate-500">
                  {role.description ?? role.code}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                  <span>{role.permissions.length} perms</span>
                  <span>·</span>
                  <span>{role.isSystem ? "System" : "Custom"}</span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {roles.length === 0 ? <p className="text-xs text-slate-500">No roles are available.</p> : null}
    </div>
  );
}

// ─── User Inspection Drawer Modal ─────────────────────────────────────────────

function UserDetailDrawer({
  user,
  roles,
  isAdmin,
  realUser,
  onClose,
  onEdit,
  onResetPassword,
  onImpersonate,
  onUnlock,
  onRemove,
}: {
  user: UserSummary;
  roles: Role[];
  isAdmin: boolean;
  realUser: { id: string } | null;
  onClose: () => void;
  onEdit: () => void;
  onResetPassword: () => void;
  onImpersonate: () => void;
  onUnlock: () => void;
  onRemove: () => void;
}) {
  const [copiedId, setCopiedId] = useState(false);
  const avatar = getAvatarStyle(user.email);
  const initials = (user.firstName[0] ?? "") + (user.lastName[0] ?? "");
  const isSelf = user.id === realUser?.id;

  function copyId() {
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  // Calculate total distinct permissions across assigned roles
  const userRoleObjects = roles.filter((r) => user.userRoles.some((link) => link.role.code === r.code));
  const distinctPerms = new Set(userRoleObjects.flatMap((r) => r.permissions));

  return (
    <Modal open title="User Account Overview" onClose={onClose}>
      <div className="flex flex-col gap-5">
        {/* Profile Card Header */}
        <div className="flex items-start gap-4 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4">
          <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border font-bold text-lg ring-2 ring-white shadow-xs", avatar.bg, avatar.text, avatar.ring)}>
            {initials.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-slate-950">
                {user.firstName} {user.lastName}
              </h3>
              {isSelf && (
                <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-800 ring-1 ring-inset ring-brand-200">
                  You (Admin)
                </span>
              )}
              <UserStatusPill status={user.status} failedCount={user.failedLoginCount} />
            </div>
            <p className="mt-0.5 text-xs text-slate-600 font-mono select-all">{user.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={copyId}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-400 hover:text-slate-700"
              >
                <span>ID: {user.id.slice(0, 8)}…</span>
                {copiedId ? <CheckIcon className="h-3 w-3 text-emerald-600" /> : <CopyIcon className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Security & Access Diagnostics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Account State</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{user.status}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Failed Logins</p>
            <p className={cn("mt-1 text-sm font-bold tabular-nums", user.failedLoginCount > 0 ? "text-amber-600" : "text-slate-900")}>
              {user.failedLoginCount} attempts
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Sign-In</p>
            <p className="mt-1 text-xs font-semibold text-slate-900 truncate" title={user.lastLoginAt ?? "Never"}>
              {formatRelativeTime(user.lastLoginAt)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Joined Date</p>
            <p className="mt-1 text-xs font-semibold text-slate-900">
              {formatDate(user.createdAt)}
            </p>
          </div>
        </div>

        {/* Assigned Roles & Effective Permissions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Assigned Roles ({user.userRoles.length})
              </h4>
              <p className="text-[11px] text-slate-500">
                Grants access to {isUserAdmin(user) ? "All (Super Admin)" : `${distinctPerms.size} distinct permissions`}
              </p>
            </div>
            <Link
              to="/roles"
              className="text-xs font-semibold text-brand-700 hover:text-brand-900 hover:underline"
            >
              Manage in Roles →
            </Link>
          </div>

          <div className="mt-3 space-y-2">
            {userRoleObjects.map((role) => (
              <div key={role.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset", role.code === "admin" ? "bg-amber-100 text-amber-800 ring-amber-300" : "bg-brand-50 text-brand-700 ring-brand-200")}>
                    <ShieldIcon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-900">{role.name}</span>
                    <span className="ml-2 font-mono text-[10px] text-slate-400">({role.code})</span>
                  </div>
                </div>
                <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                  {role.permissions.length} perms
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Admin Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap gap-2">
            {isAdmin && !isSelf && user.status === "ACTIVE" && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onImpersonate();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-100 transition"
              >
                <UsersIcon className="h-3.5 w-3.5 text-amber-700" />
                Impersonate Session
              </button>
            )}

            {user.status === "LOCKED" && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onUnlock();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 shadow-xs hover:bg-emerald-100 transition"
              >
                <UnlockIcon className="h-3.5 w-3.5 text-emerald-700" />
                Unlock Account
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <EditIcon className="h-3.5 w-3.5" />
              Edit Account
            </button>

            {user.status !== "INACTIVE" && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onResetPassword();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <KeyIcon className="h-3.5 w-3.5" />
                Reset Password
              </button>
            )}
          </div>

          {!isSelf && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRemove();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Remove
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({
  open,
  roles,
  onClose,
  onCreated,
}: {
  open: boolean;
  roles: Role[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: async () => {
      await onCreated();
      onClose();
    },
  });

  useEffect(() => {
    if (roles.length > 0 && selectedRoles.length === 0) {
      const viewer = roles.find((role) => role.code === "viewer") ?? roles[0];
      setSelectedRoles([viewer.code]);
    }
  }, [roles, selectedRoles.length]);

  function submit() {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (selectedRoles.length === 0) {
      setError("Select at least one role.");
      return;
    }
    mutation.mutate({
      email: email.trim().toLowerCase(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      roleCodes: selectedRoles,
    });
  }

  return (
    <Modal open={open} title="Create New Enterprise User" onClose={mutation.isPending ? () => undefined : onClose}>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-first-name" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              First name <span className="text-red-500">*</span>
            </label>
            <Input
              id="new-first-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="h-10"
              placeholder="e.g. John"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-last-name" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Last name <span className="text-red-500">*</span>
            </label>
            <Input
              id="new-last-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="h-10"
              placeholder="e.g. Doe"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-email" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Work email <span className="text-red-500">*</span>
          </label>
          <Input
            id="new-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-10"
            placeholder="user@company.com"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
          <PasswordField
            id="new-password"
            label="Initial password"
            value={password}
            onChange={(val) => {
              setPassword(val);
              setConfirmPassword(val);
            }}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-password-confirm" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Confirm password <span className="text-red-500">*</span>
            </label>
            <Input
              id="new-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-10 font-mono text-sm"
              autoComplete="new-password"
              placeholder="Re-enter password"
            />
          </div>
        </div>

        <RolePicker roles={roles} selected={selectedRoles} onChange={setSelectedRoles} />

        {error ? <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{error}</p> : null}
        {mutation.isError ? <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{getApiErrorMessage(mutation.error)}</p> : null}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Creating…" : "Create User"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────

function EditUserModal({
  user,
  roles,
  currentUserId,
  onClose,
  onUpdated,
}: {
  user: UserSummary;
  roles: Role[];
  currentUserId: string;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [status, setStatus] = useState<AccountStatus>(user.status);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user.userRoles.map((link) => link.role.code));
  const [error, setError] = useState<string | null>(null);
  const isSelf = user.id === currentUserId;

  const mutation = useMutation({
    mutationFn: (input: UpdateUserInput) => updateUser(user.id, input),
    onSuccess: async () => {
      await onUpdated();
      onClose();
    },
  });

  function submit() {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (selectedRoles.length === 0) {
      setError("Select at least one role.");
      return;
    }
    if (isSelf && status !== "ACTIVE") {
      setError("You cannot deactivate your own account.");
      return;
    }
    mutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      status,
      roleCodes: selectedRoles,
    });
  }

  return (
    <Modal open title={`Edit Account: ${user.firstName} ${user.lastName}`} onClose={mutation.isPending ? () => undefined : onClose}>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
          <span className="font-mono text-xs text-slate-700">{user.email}</span>
          <UserStatusPill status={user.status} failedCount={user.failedLoginCount} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-first-name" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              First name <span className="text-red-500">*</span>
            </label>
            <Input
              id="edit-first-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-last-name" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Last name <span className="text-red-500">*</span>
            </label>
            <Input
              id="edit-last-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="h-10"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-status" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Account Status
          </label>
          <select
            id="edit-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as AccountStatus)}
            disabled={isSelf}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
          >
            <option value="ACTIVE">Active (Can sign in & operate)</option>
            <option value="INACTIVE">Inactive (Disabled)</option>
            <option value="LOCKED">Locked (Security restriction)</option>
          </select>
          {isSelf && <p className="text-xs text-slate-500">You cannot change your own account status.</p>}
        </div>

        <RolePicker roles={roles} selected={selectedRoles} onChange={setSelectedRoles} />
        {isSelf && !selectedRoles.includes("admin") && (
          <p className="text-xs font-semibold text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
            Removing your own administrator role is restricted.
          </p>
        )}

        {error ? <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{error}</p> : null}
        {mutation.isError ? <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{getApiErrorMessage(mutation.error)}</p> : null}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white"
            disabled={mutation.isPending || (isSelf && !selectedRoles.includes("admin"))}
          >
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({
  user,
  onClose,
  onReset,
}: {
  user: UserSummary;
  onClose: () => void;
  onReset: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (newPassword: string) => resetUserPassword(user.id, newPassword),
    onSuccess: async () => {
      await onReset();
      onClose();
    },
  });

  function submit() {
    setError(null);
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    mutation.mutate(password);
  }

  return (
    <Modal open title="Security Credential Reset" onClose={mutation.isPending ? () => undefined : onClose}>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Set a new security password for <strong className="text-slate-900">{user.email}</strong>. Any active sessions for this account will be automatically revoked.
        </div>
        <PasswordField id="reset-password" label="New password" value={password} onChange={(val) => { setPassword(val); setConfirmPassword(val); }} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-password-confirm" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Confirm new password <span className="text-red-500">*</span>
          </label>
          <Input
            id="reset-password-confirm"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-10 font-mono text-sm"
            autoComplete="new-password"
            placeholder="Confirm password"
          />
        </div>

        {error ? <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{error}</p> : null}
        {mutation.isError ? <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{getApiErrorMessage(mutation.error)}</p> : null}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Resetting…" : "Update Password"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Users Page Component ────────────────────────────────────────────────

export default function UsersPage() {
  const queryClient = useQueryClient();
  const sessionUser = useSessionUser();
  const realUser = useRealUser();
  const isAdmin = useIsAdmin();
  const canCreate = useHasPermission("users:create");
  const canUpdate = useHasPermission("users:update");
  const canDelete = useHasPermission("users:delete");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | AccountStatus>("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [inspectingUser, setInspectingUser] = useState<UserSummary | null>(null);
  const [resetting, setResetting] = useState<UserSummary | null>(null);
  const [removing, setRemoving] = useState<UserSummary | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState<UserSummary | null>(null);
  const [impersonateError, setImpersonateError] = useState<string | null>(null);

  const debouncedQ = useDebouncedValue(q, 250);
  const cursor = cursors.at(-1);

  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    cursor,
    limit: PAGE_SIZE,
  };

  const usersQuery = useQuery({
    queryKey: ["users", "list", params],
    queryFn: () => listUsers(params),
  });

  const statsQuery = useQuery({
    queryKey: ["users", "stats"],
    queryFn: getUserStats,
  });

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: listRoles,
    staleTime: 5 * 60 * 1000,
  });

  const removeMutation = useMutation({
    mutationFn: removeUser,
    onSuccess: async () => {
      await invalidate();
      setRemoving(null);
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (userId: string) => updateUser(userId, { status: "ACTIVE" }),
    onSuccess: async () => {
      await invalidate();
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: (userId: string) => impersonateUser(userId),
    onSuccess: (result, userId) => {
      const targetUser = rows.find((row) => row.id === userId);
      if (!result.data || !targetUser) return;
      tokenStore.startImpersonation({
        accessToken: result.data.accessToken,
        user: {
          ...result.data.user,
          organizationId: realUser?.organizationId ?? "",
        },
        adminName: `${realUser?.firstName ?? ""} ${realUser?.lastName ?? ""}`.trim(),
      });
      setImpersonating(null);
    },
    onError: (error) => setImpersonateError(getApiErrorMessage(error)),
  });

  const rawRows = usersQuery.data?.items ?? [];
  const roles = rolesQuery.data ?? [];
  const stats = statsQuery.data;

  // Filter client-side by role if selected
  const rows = useMemo(() => {
    if (roleFilter === "all") return rawRows;
    return rawRows.filter((user) => user.userRoles.some((link) => link.role.code === roleFilter));
  }, [rawRows, roleFilter]);

  const hasNextPage = usersQuery.data?.pageInfo.hasNextPage ?? false;
  const hasPreviousPage = cursors.length > 1;
  const listError = usersQuery.isError ? getApiErrorMessage(usersQuery.error) : null;

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["users", "list"] }),
      queryClient.invalidateQueries({ queryKey: ["users", "stats"] }),
    ]);
  }

  function resetPage() {
    setCursors([undefined]);
  }

  function confirmRemove() {
    if (!removing) return;
    setRemoveError(null);
    removeMutation.mutate(removing.id, {
      onError: (error) => setRemoveError(getApiErrorMessage(error)),
    });
  }

  function confirmImpersonate() {
    if (!impersonating) return;
    setImpersonateError(null);
    impersonateMutation.mutate(impersonating.id);
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      {/* ── 1. Modern Header ────────────────────────────────────────── */}
      <header className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand-800">
                <span className="h-2 w-2 rounded-full bg-brand-600" />
                Access Control & Directory
              </span>
              <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                Enterprise
              </span>
              <span className="rounded-md bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-800 ring-1 ring-inset ring-brand-200">
                Admin Zone
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Users &amp; Access Directory
            </h1>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-slate-600 leading-relaxed">
              Create accounts, enforce security policies, manage role assignments, and preview system views via impersonation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void invalidate()}
              disabled={usersQuery.isFetching || statsQuery.isFetching}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition disabled:opacity-50"
              title="Refresh users directory"
            >
              <RefreshCwIcon className={cn("h-3.5 w-3.5", (usersQuery.isFetching || statsQuery.isFetching) && "animate-spin text-brand-600")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {canCreate && (
              <Button
                onClick={() => setCreateOpen(true)}
                disabled={rolesQuery.isPending}
                className="h-10 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                <PlusIcon className="mr-1.5 h-4 w-4" />
                Add User
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── 2. Metric KPI Cards Row ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total Accounts"
          value={stats?.total}
          sub={`${stats?.active ?? 0} active members`}
          icon={<UsersIcon className="h-5 w-5" />}
          tone="brand"
        />
        <KpiCard
          label="Active Directory"
          value={stats?.active}
          sub={stats?.total ? `${Math.round(((stats.active ?? 0) / stats.total) * 100)}% verified access` : "100% verified"}
          icon={<ShieldIcon className="h-5 w-5" />}
          tone="emerald"
        />
        <KpiCard
          label="Security & Locked"
          value={stats?.locked}
          sub={stats?.locked ? "Action required (failed logins)" : "Zero account locks"}
          icon={<LockIcon className="h-5 w-5" />}
          tone="amber"
        />
        <KpiCard
          label="Configured Roles"
          value={stats?.roles}
          sub="Explore access matrix"
          icon={<KeyIcon className="h-5 w-5" />}
          tone="indigo"
        />
      </div>

      {/* ── 3. Main Data Container ──────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        {/* Controls Toolbar: Status Tabs + Search + Role Filter */}
        <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-slate-50/50 p-4 sm:p-5">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 rounded-xl bg-slate-200/60 p-1">
              <button
                type="button"
                onClick={() => {
                  setStatus("");
                  resetPage();
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  status === ""
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                All Users {stats?.total !== undefined ? `(${stats.total})` : ""}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus("ACTIVE");
                  resetPage();
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  status === "ACTIVE"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                Active {stats?.active !== undefined ? `(${stats.active})` : ""}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus("LOCKED");
                  resetPage();
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  status === "LOCKED"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                Locked {stats?.locked !== undefined && stats.locked > 0 ? `(${stats.locked})` : ""}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus("INACTIVE");
                  resetPage();
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  status === "INACTIVE"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                Inactive {stats?.inactive !== undefined ? `(${stats.inactive})` : ""}
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-900 font-bold">{rows.length}</strong> accounts
            </p>
          </div>

          {/* Search bar & Role picker dropdown */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-md">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={q}
                onChange={(event) => {
                  setQ(event.target.value);
                  resetPage();
                }}
                placeholder="Search by name, email, or role..."
                aria-label="Search users"
                className="h-10 pl-9.5 pr-8 rounded-xl bg-white text-sm"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    resetPage();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filter-role-select" className="text-xs font-semibold text-slate-500 shrink-0">
                Role Filter:
              </label>
              <select
                id="filter-role-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-slate-500"
              >
                <option value="all">All Roles ({roles.length})</option>
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {listError ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between">
            <span>{listError}</span>
            <button type="button" onClick={() => void invalidate()} className="font-semibold underline">Retry</button>
          </div>
        ) : null}

        {/* ── Desktop Enterprise Table ──────────────────────────────── */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-200/80 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">User Identity</th>
                <th className="px-4 py-3.5">Assigned Roles</th>
                <th className="px-4 py-3.5">Account Status</th>
                <th className="px-4 py-3.5">Security &amp; Activity</th>
                <th className="px-5 py-3.5 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersQuery.isPending ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-slate-500">
                    <div className="inline-flex items-center gap-2 text-sm">
                      <RefreshCwIcon className="h-4 w-4 animate-spin text-brand-600" />
                      Loading enterprise directory…
                    </div>
                  </td>
                </tr>
              ) : null}

              {!usersQuery.isPending && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <UsersIcon className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-900">No users match criteria</p>
                    <p className="mt-1 text-xs text-slate-500">Try clearing the search query or status filter.</p>
                    {(q || status || roleFilter !== "all") && (
                      <button
                        type="button"
                        onClick={() => {
                          setQ("");
                          setStatus("");
                          setRoleFilter("all");
                          resetPage();
                        }}
                        className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-xs hover:bg-slate-50"
                      >
                        Reset filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : null}

              {rows.map((user) => {
                const isSelf = user.id === sessionUser?.id;
                const avatar = getAvatarStyle(user.email);
                const initials = (user.firstName[0] ?? "") + (user.lastName[0] ?? "");
                const isAdminAccount = isUserAdmin(user);

                return (
                  <tr
                    key={user.id}
                    className="group transition-colors duration-150 hover:bg-slate-50/80"
                  >
                    {/* User Identity Column */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3.5">
                        <button
                          type="button"
                          onClick={() => setInspectingUser(user)}
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-bold ring-1 transition group-hover:scale-105",
                            avatar.bg,
                            avatar.text,
                            avatar.ring,
                          )}
                          title="Click to view full user profile"
                        >
                          {initials.toUpperCase()}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setInspectingUser(user)}
                              className="font-bold text-slate-900 hover:text-brand-800 hover:underline text-left truncate"
                            >
                              {user.firstName} {user.lastName}
                            </button>
                            {isSelf && (
                              <span className="rounded-sm bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-800 ring-1 ring-inset ring-brand-200">
                                You
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs font-mono text-slate-500 select-all">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Roles Column */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {roleNames(user).map((name) => {
                          const isSuper = name.toLowerCase().includes("admin");
                          return (
                            <span
                              key={name}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset shadow-2xs",
                                isSuper
                                  ? "bg-amber-50 text-amber-900 ring-amber-300 font-bold"
                                  : "bg-slate-100 text-slate-700 ring-slate-200",
                              )}
                            >
                              {isSuper && <ShieldIcon className="h-3 w-3 text-amber-600" />}
                              {name}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Status Column */}
                    <td className="px-4 py-3.5">
                      <UserStatusPill status={user.status} failedCount={user.failedLoginCount} />
                    </td>

                    {/* Security & Activity Column */}
                    <td className="px-4 py-3.5">
                      <p className="text-xs font-medium text-slate-800">
                        {formatRelativeTime(user.lastLoginAt)}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Joined {formatDate(user.createdAt)}
                      </p>
                    </td>

                    {/* Administrative Actions Column */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {/* Impersonate Button (for Admin) */}
                        {isAdmin && !isSelf && user.status === "ACTIVE" && (
                          <button
                            type="button"
                            onClick={() => {
                              setImpersonateError(null);
                              setImpersonating(user);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 shadow-2xs transition hover:bg-amber-100"
                            title={`Impersonate ${user.firstName}`}
                          >
                            <UsersIcon className="h-3 w-3 text-amber-700" />
                            Impersonate
                          </button>
                        )}

                        {/* Quick Unlock Button (if locked) */}
                        {user.status === "LOCKED" && canUpdate && (
                          <button
                            type="button"
                            onClick={() => unlockMutation.mutate(user.id)}
                            disabled={unlockMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
                            title="Reset failed login counter and unlock account"
                          >
                            <UnlockIcon className="h-3 w-3 text-emerald-600" />
                            Unlock
                          </button>
                        )}

                        {/* View Inspection Details */}
                        <button
                          type="button"
                          onClick={() => setInspectingUser(user)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                          title="View user details and security diagnostics"
                        >
                          Details
                        </button>

                        {/* Edit Account */}
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => setEditing(user)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                          >
                            Edit
                          </button>
                        )}

                        {/* Reset Password */}
                        {canUpdate && user.status !== "INACTIVE" && (
                          <button
                            type="button"
                            onClick={() => setResetting(user)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                            title="Set a new secure password"
                          >
                            Reset
                          </button>
                        )}

                        {/* Remove Access */}
                        {canDelete && !isSelf && !isAdminAccount && (
                          <button
                            type="button"
                            onClick={() => {
                              setRemoveError(null);
                              setRemoving(user);
                            }}
                            className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 shadow-2xs transition"
                            title="Deactivate and revoke user access"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Mobile / Tablet Cards View ────────────────────────────── */}
        <div className="flex flex-col divide-y divide-slate-100 lg:hidden">
          {usersQuery.isPending ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Loading directory…</p>
          ) : null}

          {!usersQuery.isPending && rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No users match this search.</p>
          ) : null}

          {rows.map((user) => {
            const isSelf = user.id === sessionUser?.id;
            const avatar = getAvatarStyle(user.email);
            const initials = (user.firstName[0] ?? "") + (user.lastName[0] ?? "");
            const isAdminAccount = isUserAdmin(user);

            return (
              <article key={user.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-xs", avatar.bg, avatar.text)}>
                      {initials.toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-bold text-slate-900">
                          {user.firstName} {user.lastName}
                        </p>
                        {isSelf && (
                          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold text-brand-800">You</span>
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-500 font-mono">{user.email}</p>
                    </div>
                  </div>
                  <UserStatusPill status={user.status} failedCount={user.failedLoginCount} />
                </div>

                <div className="flex flex-wrap gap-1">
                  {roleNames(user).map((name) => (
                    <span key={name} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                      {name}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-2">
                  <span>Sign-in: {formatRelativeTime(user.lastLoginAt)}</span>
                  <span>Joined: {formatDate(user.createdAt)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {isAdmin && !isSelf && user.status === "ACTIVE" && (
                    <button
                      type="button"
                      onClick={() => {
                        setImpersonateError(null);
                        setImpersonating(user);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900"
                    >
                      <UsersIcon className="h-3 w-3" />
                      Impersonate
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setInspectingUser(user)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    View Details
                  </button>

                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => setEditing(user)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      Edit
                    </button>
                  )}

                  {canUpdate && user.status !== "INACTIVE" && (
                    <button
                      type="button"
                      onClick={() => setResetting(user)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      Reset Password
                    </button>
                  )}

                  {canDelete && !isSelf && !isAdminAccount && (
                    <button
                      type="button"
                      onClick={() => {
                        setRemoveError(null);
                        setRemoving(user);
                      }}
                      className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* ── Pagination Footer ─────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/50 px-5 py-3.5 text-xs text-slate-500 font-medium">
          <span>
            Page <strong className="text-slate-900 font-bold">{cursors.length}</strong> · {rows.length} accounts rendered
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!hasPreviousPage}
              onClick={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous Page
            </button>
            <button
              type="button"
              disabled={!hasNextPage}
              onClick={() => {
                const next = usersQuery.data?.pageInfo.nextCursor;
                if (next) {
                  setCursors((current) => [...current, next]);
                }
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next Page
            </button>
          </div>
        </div>
      </section>

      {/* ── Modals & Drawers ────────────────────────────────────────── */}

      {/* User Inspection Drawer */}
      {inspectingUser ? (
        <UserDetailDrawer
          user={inspectingUser}
          roles={roles}
          isAdmin={isAdmin}
          realUser={realUser}
          onClose={() => setInspectingUser(null)}
          onEdit={() => setEditing(inspectingUser)}
          onResetPassword={() => setResetting(inspectingUser)}
          onImpersonate={() => setImpersonating(inspectingUser)}
          onUnlock={() => unlockMutation.mutate(inspectingUser.id)}
          onRemove={() => setRemoving(inspectingUser)}
        />
      ) : null}

      {/* Add User Modal */}
      {createOpen ? (
        <CreateUserModal
          open
          roles={roles}
          onClose={() => setCreateOpen(false)}
          onCreated={invalidate}
        />
      ) : null}

      {/* Edit User Modal */}
      {editing ? (
        <EditUserModal
          user={editing}
          roles={roles}
          currentUserId={sessionUser?.id ?? ""}
          onClose={() => setEditing(null)}
          onUpdated={invalidate}
        />
      ) : null}

      {/* Reset Password Modal */}
      {resetting ? (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onReset={invalidate}
        />
      ) : null}

      {/* Remove Access Confirm Dialog */}
      <ConfirmDialog
        open={removing !== null}
        title="Remove user account access?"
        description={
          <div className="flex flex-col gap-2">
            <p>
              Are you sure you want to revoke access for{" "}
              <span className="font-semibold text-slate-900">{removing?.email}</span>?
            </p>
            <p className="text-xs text-slate-500">
              The account will be deactivated immediately and any active sessions will be terminated.
              Existing documents, audit history, and transactions linked to this user are securely preserved.
            </p>
            {removeError ? (
              <p role="alert" className="text-xs text-red-700 bg-red-50 p-2 rounded-md border border-red-200">
                {removeError}
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Remove Access"
        busy={removeMutation.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />

      {/* Impersonation Confirm Dialog */}
      <ConfirmDialog
        open={impersonating !== null}
        title={`Impersonate ${impersonating?.firstName} ${impersonating?.lastName}?`}
        description={
          <div className="flex flex-col gap-2">
            <p>
              You are about to view and operate the ERP system through the perspective of{" "}
              <strong className="text-slate-900">{impersonating?.email}</strong> (
              <span className="font-semibold text-brand-700">
                {impersonating ? roleNames(impersonating).join(", ") : ""}
              </span>
              ).
            </p>
            <p className="text-xs text-slate-500">
              Only the modules and permissions granted to this user will be rendered. A persistent amber banner
              will remain visible at the top of your screen, allowing you to return to your administrator account at any time.
            </p>
            {impersonateError ? (
              <p role="alert" className="text-xs text-red-700 bg-red-50 p-2 rounded-md border border-red-200">
                {impersonateError}
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Start Impersonation"
        busy={impersonateMutation.isPending}
        onCancel={() => setImpersonating(null)}
        onConfirm={confirmImpersonate}
      />
    </section>
  );
}

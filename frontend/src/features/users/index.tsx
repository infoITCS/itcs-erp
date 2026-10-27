import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { useHasPermission, useSessionUser } from "@/hooks/useSession.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { listRoles, type Role } from "@/services/roles.ts";
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

const statusStyles: Record<AccountStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  INACTIVE: "bg-slate-100 text-slate-600 ring-slate-200",
  LOCKED: "bg-amber-50 text-amber-800 ring-amber-200",
};

function formatDate(value: string | null): string {
  if (!value) {
    return "Never";
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function roleNames(user: UserSummary): string[] {
  return user.userRoles.map((link) => link.role.name);
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
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        <button
          type="button"
          onClick={() => onChange(generatePassword())}
          className="text-xs font-semibold text-teal-800 hover:text-teal-950"
        >
          Generate
        </button>
      </div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="h-10 pr-14"
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
        <p className="text-sm font-medium text-slate-700">Roles</p>
        <span className="text-[11px] text-slate-500">{selected.length} selected</span>
      </div>
      <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {roles.map((role) => {
          const checked = selected.includes(role.code);
          return (
            <label
              key={role.id}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:border-slate-300"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
                checked={checked}
                onChange={(event) => {
                  onChange(
                    event.target.checked
                      ? [...selected, role.code]
                      : selected.filter((code) => code !== role.code),
                  );
                }}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">{role.name}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                  {role.description ?? role.code}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                  <span>{role.isSystem ? "System" : "Custom"}</span>
                  <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
                  <span>{role.permissions.length} permissions</span>
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
    <Modal open={open} title="Add user" onClose={mutation.isPending ? () => undefined : onClose}>
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
            <label htmlFor="new-first-name" className="text-sm font-medium text-slate-700">
              First name
            </label>
            <Input
              id="new-first-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="h-10"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-last-name" className="text-sm font-medium text-slate-700">
              Last name
            </label>
            <Input
              id="new-last-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="h-10"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-email" className="text-sm font-medium text-slate-700">
            Work email
          </label>
          <Input
            id="new-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@itcs.com.pk"
            className="h-10"
            autoComplete="off"
          />
        </div>

        <PasswordField
          id="new-password"
          label="Temporary password"
          value={password}
          onChange={setPassword}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-password-confirm" className="text-sm font-medium text-slate-700">
            Confirm password
          </label>
          <Input
            id="new-password-confirm"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-10"
            autoComplete="new-password"
          />
        </div>

        <RolePicker roles={roles} selected={selectedRoles} onChange={setSelectedRoles} />

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {mutation.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(mutation.error)}</p> : null}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-teal-800 hover:bg-teal-900"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Creating…" : "Create user"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

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
    <Modal open title={`Edit ${user.firstName} ${user.lastName}`} onClose={mutation.isPending ? () => undefined : onClose}>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{user.email}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-first-name" className="text-sm font-medium text-slate-700">
              First name
            </label>
            <Input
              id="edit-first-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-last-name" className="text-sm font-medium text-slate-700">
              Last name
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
          <label htmlFor="edit-status" className="text-sm font-medium text-slate-700">
            Account status
          </label>
          <select
            id="edit-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as AccountStatus)}
            disabled={isSelf}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-100"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="LOCKED">Locked</option>
          </select>
          {isSelf ? <p className="text-xs text-slate-500">You cannot change your own account status.</p> : null}
        </div>

        <RolePicker roles={roles} selected={selectedRoles} onChange={setSelectedRoles} />
        {isSelf && !selectedRoles.includes("admin") ? (
          <p className="text-xs text-amber-700">Removing your own administrator role is not allowed.</p>
        ) : null}

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {mutation.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(mutation.error)}</p> : null}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-teal-800 hover:bg-teal-900"
            disabled={mutation.isPending || (isSelf && !selectedRoles.includes("admin"))}
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

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
    <Modal open title="Reset password" onClose={mutation.isPending ? () => undefined : onClose}>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Set a new password for <span className="font-semibold text-slate-900">{user.email}</span>. Existing
          sessions will be signed out.
        </p>
        <PasswordField id="reset-password" label="New password" value={password} onChange={setPassword} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-password-confirm" className="text-sm font-medium text-slate-700">
            Confirm new password
          </label>
          <Input
            id="reset-password-confirm"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-10"
            autoComplete="new-password"
          />
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {mutation.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(mutation.error)}</p> : null}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-teal-800 hover:bg-teal-900"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Resetting…" : "Reset password"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number | undefined; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${accent}`} />
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{value ?? "—"}</p>
    </div>
  );
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const sessionUser = useSessionUser();
  const canCreate = useHasPermission("users:create");
  const canUpdate = useHasPermission("users:update");
  const canDelete = useHasPermission("users:delete");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | AccountStatus>("");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [resetting, setResetting] = useState<UserSummary | null>(null);
  const [removing, setRemoving] = useState<UserSummary | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);

  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    cursor,
    limit: PAGE_SIZE,
  };
  const users = useQuery({
    queryKey: ["users", "list", params],
    queryFn: () => listUsers(params),
  });
  const stats = useQuery({
    queryKey: ["users", "stats"],
    queryFn: getUserStats,
  });
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: listRoles,
    staleTime: 5 * 60 * 1000,
  });
  const remove = useMutation({
    mutationFn: removeUser,
    onSuccess: async () => {
      await invalidate();
      setRemoving(null);
    },
  });

  const rows = users.data?.items ?? [];
  const roleList = roles.data ?? [];
  const hasNextPage = users.data?.pageInfo.hasNextPage ?? false;
  const hasPreviousPage = cursors.length > 1;
  const listError = users.isError ? getApiErrorMessage(users.error) : null;

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["users", "list"] }),
      queryClient.invalidateQueries({ queryKey: ["users", "stats"] }),
    ]);
  }

  function resetPage() {
    setCursors([undefined]);
  }

  function openCreate() {
    setCreateOpen(true);
  }

  function confirmRemove() {
    if (!removing) {
      return;
    }
    setRemoveError(null);
    remove.mutate(removing.id, {
      onError: (error) => setRemoveError(getApiErrorMessage(error)),
    });
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
            <span className="h-2 w-2 rounded-full bg-teal-600" />
            System / Access
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Users &amp; access</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Create accounts, assign roles, reset passwords, and remove access. Administrators can never remove
            their own access or the last active administrator.
          </p>
        </div>
        {canCreate ? (
          <Button
            onClick={openCreate}
            disabled={roles.isPending}
            className="h-10 bg-teal-800 px-4 hover:bg-teal-900"
          >
            Add user
          </Button>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <SummaryCard label="Total users" value={stats.data?.total} accent="bg-slate-400" />
        <SummaryCard label="Active" value={stats.data?.active} accent="bg-emerald-500" />
        <SummaryCard label="Inactive" value={stats.data?.inactive} accent="bg-slate-400" />
        <SummaryCard label="Locked" value={stats.data?.locked} accent="bg-amber-500" />
        <SummaryCard label="Roles" value={stats.data?.roles} accent="bg-teal-500" />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                resetPage();
              }}
              placeholder="Search name or email"
              aria-label="Search users"
              className="h-10 w-full sm:w-72"
            />
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as "" | AccountStatus);
                resetPage();
              }}
              aria-label="Filter by status"
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-500"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="LOCKED">Locked</option>
            </select>
          </div>
          <p className="text-xs text-slate-500">
            {rows.length} user{rows.length === 1 ? "" : "s"} on page {cursors.length}
          </p>
        </div>

        {listError ? (
          <p className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{listError}</p>
        ) : null}

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Roles</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last sign-in</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.isPending ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    Loading users…
                  </td>
                </tr>
              ) : null}
              {!users.isPending && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    No users match this search.
                  </td>
                </tr>
              ) : null}
              {rows.map((user) => (
                <tr key={user.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                        {(user.firstName[0] ?? "") + (user.lastName[0] ?? "")}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">
                          {user.firstName} {user.lastName}
                          {user.id === sessionUser?.id ? (
                            <span className="ml-2 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal-800">
                              You
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {roleNames(user).map((name) => (
                        <span
                          key={name}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusStyles[user.status]}`}
                    >
                      {user.status.charAt(0) + user.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{formatDate(user.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {canUpdate ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditing(user)}
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          {user.status !== "INACTIVE" ? (
                            <button
                              type="button"
                              onClick={() => setResetting(user)}
                              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Reset password
                            </button>
                          ) : null}
                        </>
                      ) : null}
                      {canDelete && user.id !== sessionUser?.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRemoveError(null);
                            setRemoving(user);
                          }}
                          className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Remove access
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col divide-y divide-slate-100 md:hidden">
          {users.isPending ? <p className="px-4 py-8 text-center text-sm text-slate-500">Loading users…</p> : null}
          {!users.isPending && rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No users match this search.</p>
          ) : null}
          {rows.map((user) => (
            <article key={user.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusStyles[user.status]}`}
                >
                  {user.status.charAt(0) + user.status.slice(1).toLowerCase()}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {roleNames(user).map((name) => (
                  <span key={name} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                    {name}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">Last sign-in: {formatDate(user.lastLoginAt)}</p>
              <div className="flex flex-wrap gap-2">
                {canUpdate ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing(user)}
                      className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Edit
                    </button>
                    {user.status !== "INACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => setResetting(user)}
                        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700"
                      >
                        Reset password
                      </button>
                    ) : null}
                  </>
                ) : null}
                {canDelete && user.id !== sessionUser?.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveError(null);
                      setRemoving(user);
                    }}
                    className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700"
                  >
                    Remove access
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          <span>{rows.length} shown</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!hasPreviousPage}
              onClick={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!hasNextPage}
              onClick={() => {
                const next = users.data?.pageInfo.nextCursor;
                if (next) {
                  setCursors((current) => [...current, next]);
                }
              }}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {createOpen ? (
        <CreateUserModal
          open
          roles={roleList}
          onClose={() => setCreateOpen(false)}
          onCreated={invalidate}
        />
      ) : null}

      {editing ? (
        <EditUserModal
          user={editing}
          roles={roleList}
          currentUserId={sessionUser?.id ?? ""}
          onClose={() => setEditing(null)}
          onUpdated={invalidate}
        />
      ) : null}

      {resetting ? (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onReset={invalidate}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title="Remove user access?"
        description={
          <div className="flex flex-col gap-2">
            <p>
              Remove access for{" "}
              <span className="font-semibold text-slate-900">{removing?.email}</span>? Their account will be
              deactivated and active sessions revoked. The record and audit history are kept.
            </p>
            {removeError ? (
              <p role="alert" className="text-red-700">
                {removeError}
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Remove access"
        busy={remove.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </section>
  );
}

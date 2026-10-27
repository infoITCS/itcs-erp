import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  updateRole,
  type Permission,
  type Role,
} from "@/services/roles.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { cn } from "@/utils/cn.ts";

interface PermissionModuleView {
  module: string;
  moduleName: string;
  group: string;
  description: string;
  sortOrder: number;
  actions: Permission[];
}

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function ShieldIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function UsersIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function LockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", tone)} />
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function roleMatches(role: Role, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) {
    return true;
  }
  return [role.name, role.code, role.description ?? ""].some((value) =>
    value.toLowerCase().includes(query),
  );
}

function samePermissions(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const set = new Set(left);
  return right.every((code) => set.has(code));
}

export default function RolesPage() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("roles:create");
  const canUpdate = useHasPermission("roles:update");
  const canDelete = useHasPermission("roles:delete");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roleSearch, setRoleSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [draft, setDraft] = useState<string[]>([]);
  const [createSource, setCreateSource] = useState<Role | null | undefined>(undefined);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: listRoles });
  const permissionsQuery = useQuery({
    queryKey: ["permissions"],
    queryFn: listPermissions,
    staleTime: 10 * 60 * 1000,
  });

  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const selectedRole = roles.find((role) => role.id === selectedId) ?? roles[0] ?? null;
  const filteredRoles = roles.filter((role) => roleMatches(role, roleSearch));
  const canEditSelected = Boolean(selectedRole && canUpdate);
  const savedPermissions = selectedRole?.permissions ?? [];
  const isDirty = canEditSelected && !samePermissions(draft, savedPermissions);

  const modules = useMemo<PermissionModuleView[]>(() => {
    const byModule = new Map<string, PermissionModuleView>();
    for (const permission of permissions) {
      let module = byModule.get(permission.module);
      if (!module) {
        module = {
          module: permission.module,
          moduleName: permission.moduleName,
          group: permission.group,
          description: permission.moduleDescription,
          sortOrder: permission.moduleSortOrder,
          actions: [],
        };
        byModule.set(permission.module, module);
      }
      module.actions.push(permission);
    }
    return [...byModule.values()]
      .map((module) => ({
        ...module,
        actions: [...module.actions].sort((left, right) => left.actionSortOrder - right.actionSortOrder),
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }, [permissions]);

  const groups = useMemo(
    () => [...new Set(modules.map((module) => module.group))],
    [modules],
  );

  const filteredModules = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase();
    return modules.filter((module) => {
      if (groupFilter !== "all" && module.group !== groupFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        module.moduleName.toLowerCase().includes(query) ||
        module.description.toLowerCase().includes(query) ||
        module.actions.some(
          (action) =>
            action.actionLabel.toLowerCase().includes(query) ||
            action.code.toLowerCase().includes(query) ||
            action.description.toLowerCase().includes(query),
        )
      );
    });
  }, [modules, groupFilter, permissionSearch]);

  useEffect(() => {
    setDraft(selectedRole ? [...selectedRole.permissions] : []);
  }, [selectedRole?.id, selectedRole?.permissions]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selectedRole) {
        throw new Error("No role selected");
      }
      return updateRole(selectedRole.id, { permissions: draft });
    },
    onSuccess: async () => {
      await refreshRoles();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => deleteRole(roleId),
    onSuccess: async () => {
      setDeleting(null);
      setDeleteError(null);
      setSelectedId(null);
      await refreshRoles();
    },
    onError: (error) => setDeleteError(getApiErrorMessage(error)),
  });

  async function refreshRoles() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["roles"] }),
      queryClient.invalidateQueries({ queryKey: ["users"] }),
    ]);
  }

  function togglePermission(code: string) {
    if (!canEditSelected) {
      return;
    }
    setDraft((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  }

  function toggleModule(module: PermissionModuleView) {
    if (!canEditSelected) {
      return;
    }
    const codes = module.actions.map((action) => action.code);
    const selected = new Set(draft);
    const allSelected = codes.every((code) => selected.has(code));
    if (allSelected) {
      codes.forEach((code) => selected.delete(code));
    } else {
      codes.forEach((code) => selected.add(code));
    }
    setDraft([...selected]);
  }

  async function handleCreated(role: Role) {
    await refreshRoles();
    setSelectedId(role.id);
    setCreateSource(undefined);
  }

  const totalAssignments = roles.reduce((sum, role) => sum + role.userCount, 0);
  const customRoles = roles.filter((role) => !role.isSystem).length;
  const listError = rolesQuery.isError ? getApiErrorMessage(rolesQuery.error) : null;
  const permissionError = permissionsQuery.isError
    ? getApiErrorMessage(permissionsQuery.error)
    : null;

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
            <span className="h-2 w-2 rounded-full bg-teal-600" />
            System / Access control
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Roles &amp; permissions
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Build access profiles module by module. Add or remove any permission for any role;
            administrator accounts always keep full access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/users"
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
          >
            Manage users
          </Link>
          {canCreate ? (
            <Button
              onClick={() => setCreateSource(null)}
              className="h-10 bg-teal-800 px-4 hover:bg-teal-900"
            >
              New role
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Roles" value={roles.length} tone="bg-slate-400" />
        <StatCard label="Custom roles" value={customRoles} tone="bg-teal-500" />
        <StatCard label="Assignments" value={totalAssignments} tone="bg-sky-500" />
        <StatCard label="Permissions" value={permissions.length} tone="bg-indigo-500" />
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={roleSearch}
              onChange={(event) => setRoleSearch(event.target.value)}
              placeholder="Search roles"
              aria-label="Search roles"
              className="h-10 pl-9"
            />
          </div>
          <p className="mt-3 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {filteredRoles.length} role{filteredRoles.length === 1 ? "" : "s"}
          </p>
          <div className="mt-2 flex max-h-[21rem] flex-col gap-2 overflow-y-auto pr-1 xl:max-h-[calc(100dvh-24rem)]">
            {rolesQuery.isPending ? (
              <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                Loading roles...
              </p>
            ) : null}
            {!rolesQuery.isPending && filteredRoles.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                No roles match this search.
              </p>
            ) : null}
            {filteredRoles.map((role) => {
              const active = role.id === selectedRole?.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedId(role.id)}
                  className={cn(
                    "group w-full rounded-xl border px-3 py-3 text-left transition",
                    active
                      ? "border-teal-300 bg-teal-50/70 shadow-sm ring-1 ring-teal-100"
                      : "border-transparent bg-slate-50/80 hover:border-slate-200 hover:bg-white",
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {role.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                        {role.description ?? role.code}
                      </span>
                    </span>
                    {role.isSystem ? (
                      <span className="shrink-0 rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                        System
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-teal-800">
                        Custom
                      </span>
                    )}
                  </span>
                  <span className="mt-2 flex items-center gap-3 text-[10px] font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <ShieldIcon className="h-3 w-3" />
                      {role.permissions.length} permissions
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UsersIcon className="h-3 w-3" />
                      {role.userCount} users
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {listError ? (
            <p className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
              {listError}
            </p>
          ) : null}

          {!selectedRole ? (
            <div className="px-6 py-20 text-center">
              <ShieldIcon className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">Select a role</p>
              <p className="mt-1 text-xs text-slate-500">
                Choose a role to review or change its module permissions.
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-100">
                      <ShieldIcon />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-semibold text-slate-950">
                          {selectedRole.name}
                        </h2>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            selectedRole.isSystem
                              ? "bg-slate-100 text-slate-600"
                              : "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200",
                          )}
                        >
                          {selectedRole.isSystem ? "System role" : "Custom role"}
                        </span>
                      </div>
                      <p className="mt-1 max-w-xl text-sm text-slate-600">
                        {selectedRole.description ?? "No description provided."}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span className="font-mono">{selectedRole.code}</span>
                        <span className="inline-flex items-center gap-1">
                          <UsersIcon className="h-3 w-3" />
                          {selectedRole.userCount} assigned user
                          {selectedRole.userCount === 1 ? "" : "s"}
                        </span>
                        <span>
                          {selectedRole.permissions.length} of {permissions.length} permissions
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    {canCreate ? (
                      <Button
                        variant="secondary"
                        onClick={() => setCreateSource(selectedRole)}
                        className="h-9"
                      >
                        Duplicate
                      </Button>
                    ) : null}
                    {!selectedRole.isSystem && canUpdate ? (
                      <Button variant="secondary" onClick={() => setEditing(selectedRole)} className="h-9">
                        Edit details
                      </Button>
                    ) : null}
                    {!selectedRole.isSystem && canDelete ? (
                      <button
                        type="button"
                        disabled={selectedRole.userCount > 0}
                        title={
                          selectedRole.userCount > 0
                            ? "Remove this role from all users first"
                            : "Delete role"
                        }
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting(selectedRole);
                        }}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>

                {selectedRole.code === "admin" ? (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-200">
                    <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    Administrator accounts always keep every permission at sign-in, so changes to
                    this role cannot restrict an administrator.
                  </p>
                ) : selectedRole.isSystem ? (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-teal-50 px-3 py-2 text-[11px] leading-relaxed text-teal-900 ring-1 ring-inset ring-teal-200">
                    <ShieldIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" />
                    System role permissions are fully editable. Changes are saved and will not be
                    reset after a restart.
                  </p>
                ) : null}
              </div>

              <div className="sticky top-16 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 flex-1 sm:max-w-xs">
                      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={permissionSearch}
                        onChange={(event) => setPermissionSearch(event.target.value)}
                        placeholder="Find a permission"
                        aria-label="Find a permission"
                        className="h-9 pl-9"
                      />
                    </div>
                    <select
                      value={groupFilter}
                      onChange={(event) => setGroupFilter(event.target.value)}
                      aria-label="Filter by module group"
                      className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-slate-500"
                    >
                      <option value="all">All groups</option>
                      {groups.map((group) => (
                        <option key={group} value={group}>
                          {group}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between gap-2 lg:justify-end">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {draft.length} selected
                    </span>
                    {isDirty ? (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() => setDraft([...savedPermissions])}
                          disabled={saveMutation.isPending}
                          className="h-8 px-2 text-xs"
                        >
                          Reset
                        </Button>
                        <Button
                          onClick={() => saveMutation.mutate()}
                          disabled={saveMutation.isPending}
                          className="h-8 bg-teal-800 px-3 text-xs hover:bg-teal-900"
                        >
                          {saveMutation.isPending ? "Saving..." : "Save permissions"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                {saveMutation.isError ? (
                  <p className="mt-2 text-xs text-red-700">{getApiErrorMessage(saveMutation.error)}</p>
                ) : null}
                {permissionError ? (
                  <p className="mt-2 text-xs text-red-700">{permissionError}</p>
                ) : null}
              </div>

              <div className="p-4 sm:p-5">
                {permissionsQuery.isPending ? (
                  <p className="rounded-xl bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                    Loading permission catalog...
                  </p>
                ) : null}
                {!permissionsQuery.isPending && filteredModules.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                    No permissions match this search.
                  </p>
                ) : null}
                <div className="grid gap-3 2xl:grid-cols-2">
                  {filteredModules.map((module) => {
                    const selected = new Set(draft);
                    const selectedCount = module.actions.filter((action) =>
                      selected.has(action.code),
                    ).length;
                    const allSelected = selectedCount === module.actions.length;
                    return (
                      <section
                        key={module.module}
                        className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white p-3.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-900">
                                {module.moduleName}
                              </h3>
                              <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400 ring-1 ring-inset ring-slate-200">
                                {module.group}
                              </span>
                            </div>
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                              {module.description}
                            </p>
                          </div>
                          {canEditSelected ? (
                            <button
                              type="button"
                              onClick={() => toggleModule(module)}
                              className="shrink-0 text-[10px] font-semibold text-teal-800 hover:text-teal-950"
                            >
                              {allSelected ? "Clear" : "Select all"}
                            </button>
                          ) : (
                            <span className="shrink-0 text-[10px] font-medium tabular-nums text-slate-400">
                              {selectedCount}/{module.actions.length}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {module.actions.map((action) => {
                            const checked = draft.includes(action.code);
                            return (
                              <label
                                key={action.id}
                                title={action.description}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition",
                                  checked
                                    ? "border-teal-700 bg-teal-800 text-white shadow-sm"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                                  canEditSelected
                                    ? "cursor-pointer"
                                    : "cursor-default",
                                  !canEditSelected && !checked
                                    ? "opacity-45"
                                    : "",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={checked}
                                  disabled={!canEditSelected}
                                  onChange={() => togglePermission(action.code)}
                                />
                                <span
                                  className={cn(
                                    "flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border",
                                    checked
                                      ? "border-white/50 bg-white/15"
                                      : "border-slate-300 bg-white",
                                  )}
                                >
                                  {checked ? <CheckIcon /> : null}
                                </span>
                                {action.actionLabel}
                                {action.risk === "critical" ? (
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full",
                                      checked ? "bg-amber-300" : "bg-amber-500",
                                    )}
                                    title="Sensitive permission"
                                  />
                                ) : null}
                              </label>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

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
              Delete <span className="font-semibold text-slate-900">{deleting?.name}</span>? This
              cannot be undone. Roles assigned to users cannot be deleted until they are unassigned.
            </p>
            {deleteError ? (
              <p role="alert" className="text-red-700">
                {deleteError}
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Delete role"
        busy={deleteMutation.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteMutation.mutate(deleting.id);
          }
        }}
      />
    </section>
  );
}

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
  const baseRole = source ?? roles.find((role) => role.id === startFrom) ?? null;
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
    <Modal
      open
      title={source ? `Duplicate ${source.name}` : "Create role"}
      onClose={mutation.isPending ? () => undefined : onClose}
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role-name" className="text-sm font-medium text-slate-700">
            Role name
          </label>
          <Input
            id="role-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Regional Sales Director"
            className="h-10"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role-description" className="text-sm font-medium text-slate-700">
            Description
          </label>
          <textarea
            id="role-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Who is this role for and what should they be able to do?"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500"
          />
        </div>
        {source ? (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Starts with the same {source.permissions.length} permissions as{" "}
            <span className="font-semibold text-slate-800">{source.name}</span>. You can adjust them
            after creating the role.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="role-base" className="text-sm font-medium text-slate-700">
              Start with
            </label>
            <select
              id="role-base"
              value={startFrom}
              onChange={(event) => setStartFrom(event.target.value)}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500"
            >
              <option value="">Blank role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} ({role.permissions.length} permissions)
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              Starting from an existing role copies its permission set once. Later changes are
              independent.
            </p>
          </div>
        )}

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {mutation.isError ? (
          <p className="text-sm text-red-700">{getApiErrorMessage(mutation.error)}</p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-teal-800 hover:bg-teal-900"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Creating..." : "Create role"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

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
    mutationFn: () =>
      updateRole(role.id, {
        name: name.trim(),
        description: description.trim() || null,
      }),
    onSuccess: async () => {
      await onUpdated();
    },
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
    <Modal
      open
      title={`Edit ${role.name}`}
      onClose={mutation.isPending ? () => undefined : onClose}
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-role-name" className="text-sm font-medium text-slate-700">
            Role name
          </label>
          <Input
            id="edit-role-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-role-description" className="text-sm font-medium text-slate-700">
            Description
          </label>
          <textarea
            id="edit-role-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={500}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {mutation.isError ? (
          <p className="text-sm text-red-700">{getApiErrorMessage(mutation.error)}</p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-teal-800 hover:bg-teal-900"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving..." : "Save details"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

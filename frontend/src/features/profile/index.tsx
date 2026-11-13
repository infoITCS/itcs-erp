import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { UserAvatar, userInitials } from "@/components/ui/UserAvatar.tsx";
import { tokenStore } from "@/lib/token-store.ts";
import { changePassword, logoutAll } from "@/services/auth.ts";
import { listCurrencies } from "@/services/currencies.ts";
import {
  deleteOrganization,
  updateOrganization,
  type UpdateOrganizationInput,
} from "@/services/organizations.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  getProfile,
  removeProfileAvatar,
  updateProfile,
  updateProfileAvatar,
  type Profile,
  type UpdateProfileInput,
} from "./api.ts";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
  jobTitle: string;
  department: string;
  location: string;
  bio: string;
}

const emptyForm: ProfileForm = {
  firstName: "",
  lastName: "",
  phone: "",
  jobTitle: "",
  department: "",
  location: "",
  bio: "",
};

function formFromProfile(profile: Profile): ProfileForm {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? "",
    jobTitle: profile.jobTitle ?? "",
    department: profile.department ?? "",
    location: profile.location ?? "",
    bio: profile.bio ?? "",
  };
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Not available";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Not available";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function humanize(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function errorText(error: unknown): string {
  if (error instanceof Error && !("response" in error)) {
    return error.message;
  }
  return getApiErrorMessage(error);
}

interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Fall back to an image element for browsers that cannot decode the file type.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Unsupported image format"));
      element.src = objectUrl;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function imageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Choose an image smaller than 15 MB.");
  }

  let image: LoadedImage;
  try {
    image = await loadImage(file);
  } catch {
    throw new Error("This image could not be read. Try a PNG, JPEG, or WebP file.");
  }

  const sourceSize = Math.min(image.width, image.height);
  if (!sourceSize) {
    image.dispose();
    throw new Error("This image could not be read. Try a different file.");
  }

  const sourceX = (image.width - sourceSize) / 2;
  const sourceY = (image.height - sourceSize) / 2;
  const targetSize = 512;
  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const context = canvas.getContext("2d");
  if (!context) {
    image.dispose();
    throw new Error("This browser could not process the image.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, targetSize, targetSize);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image.source,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    targetSize,
    targetSize,
  );
  image.dispose();

  let dataUrl = canvas.toDataURL("image/jpeg", 0.86);
  for (const quality of [0.75, 0.6, 0.45]) {
    if (dataUrl.length <= 680_000) {
      break;
    }
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > 680_000) {
    throw new Error("This image is too large after compression. Try a smaller file.");
  }
  return dataUrl;
}

function syncSession(profile: Profile): void {
  const current = tokenStore.getUser();
  if (!current) {
    return;
  }
  tokenStore.setUser({
    ...current,
    firstName: profile.firstName,
    lastName: profile.lastName,
    avatarUrl: profile.avatarUrl,
    roles: profile.roles.map((role) => role.code),
    permissions: profile.permissions,
  });
}

function Card({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03] ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-950">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-semibold text-slate-700">
      {children}
    </label>
  );
}

function ActivityRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 first:pt-0 last:border-0 last:pb-0">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="text-right text-xs font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function SecurityStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SecuritySection({
  passwordChangedAt,
  accountStatus,
}: {
  passwordChangedAt: string | null;
  accountStatus: string;
}) {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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

  const requirements = [
    { label: "At least 12 characters", met: newPassword.length >= 12 },
    {
      label: "Different from current password",
      met: newPassword.length > 0 && newPassword !== currentPassword,
    },
    {
      label: "Confirmation matches",
      met: newPassword.length > 0 && newPassword === confirmPassword,
    },
  ];

  function submit() {
    setError(null);
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
    <section className="flex flex-col gap-5 border-t border-slate-200 pt-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            className="h-5 w-5"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Security</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage your password and the sessions connected to this account.
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(290px,1fr)]">
        <Card
          title="Password"
          description="Use a strong password that you do not use on other services."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <SecurityStat label="Password updated" value={formatDate(passwordChangedAt)} />
            <SecurityStat label="Account status" value={humanize(accountStatus)} />
            <SecurityStat label="Sign-in method" value="Email & password" />
          </div>

          <form
            className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="security-current-password">Current password</FieldLabel>
              <Input
                id="security-current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="h-10"
                autoComplete="current-password"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="security-new-password">New password</FieldLabel>
                <Input
                  id="security-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="h-10"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="security-confirm-password">Confirm new password</FieldLabel>
                <Input
                  id="security-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-10"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <ul className="grid gap-2 sm:grid-cols-3">
              {requirements.map((requirement) => (
                <li
                  key={requirement.label}
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-medium ${
                    requirement.met
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${
                      requirement.met ? "bg-emerald-600 text-white" : "bg-slate-300 text-white"
                    }`}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5">
                      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
                    </svg>
                  </span>
                  {requirement.label}
                </li>
              ))}
            </ul>

            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {error}
              </p>
            ) : null}
            {change.isError ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {getApiErrorMessage(change.error)}
              </p>
            ) : null}

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800"
                disabled={change.isPending}
              >
                {change.isPending ? "Updating..." : "Update password"}
              </Button>
            </div>
          </form>
        </Card>

        <Card
          title="Sessions"
          description="Review and revoke access to your account."
          className="h-fit"
        >
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
              </span>
              <p className="text-sm font-semibold text-slate-900">Current browser</p>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-slate-600">
              This session is active and will remain signed in until you sign out or revoke all
              sessions.
            </p>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Sign out everywhere</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Revoke every refresh token issued to your account, including this browser. You will
              need to sign in again.
            </p>
            <Button
              variant="secondary"
              className="mt-4 w-full border-rose-200 text-rose-700 hover:bg-rose-50"
              onClick={() => setSignOutOpen(true)}
            >
              Sign out everywhere
            </Button>
            {signOutEverywhere.isError ? (
              <p className="mt-3 text-xs font-medium text-rose-700">
                {getApiErrorMessage(signOutEverywhere.error)}
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={signOutOpen}
        title="Sign out everywhere?"
        description="Every active session for your account will be revoked."
        confirmLabel="Sign out everywhere"
        busy={signOutEverywhere.isPending}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => signOutEverywhere.mutate()}
      />
    </section>
  );
}

function OrganizationSection({
  organization,
  canEdit,
  canDelete,
}: {
  organization: NonNullable<Profile["organization"]>;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(organization.name);
  const [baseCurrency, setBaseCurrency] = useState(organization.baseCurrencyCode);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const currencies = useQuery({
    queryKey: ["currencies"],
    queryFn: listCurrencies,
    enabled: editing,
    staleTime: 5 * 60 * 1000,
  });

  const save = useMutation({
    mutationFn: (input: UpdateOrganizationInput) => updateOrganization(organization.id, input),
    onSuccess: (next) => {
      queryClient.setQueryData<Profile>(["profile"], (current) =>
        current?.organization
          ? { ...current, organization: { ...current.organization, ...next } }
          : current,
      );
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setEditing(false);
      setEditError(null);
    },
    onError: (error) => setEditError(errorText(error)),
  });

  const remove = useMutation({
    mutationFn: () => deleteOrganization(organization.id),
    onSuccess: () => {
      tokenStore.clear();
      window.location.replace("/login?organizationDeleted=1");
    },
    onError: (error) => setDeleteError(errorText(error)),
  });

  function startEditing() {
    setName(organization.name);
    setBaseCurrency(organization.baseCurrencyCode);
    setEditError(null);
    setEditing(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditError(null);
    if (!name.trim()) {
      setEditError("Organization name is required.");
      return;
    }
    if (!/^[A-Za-z]{3}$/.test(baseCurrency.trim())) {
      setEditError("Choose a valid three-letter base currency.");
      return;
    }
    save.mutate({
      name: name.trim(),
      baseCurrencyCode: baseCurrency.trim().toUpperCase(),
    });
  }

  function closeDeleteDialog() {
    setDeleteOpen(false);
    setDeleteConfirmation("");
    setDeleteError(null);
  }

  const currencyOptions = currencies.data ?? [];
  const selectedCurrencyVisible = currencyOptions.some(
    (currency) => currency.code === baseCurrency,
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-white shadow-sm">
            {userInitials(organization.name, organization.code)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold tracking-tight text-slate-950">
                {organization.name}
              </h2>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
                {humanize(organization.status)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Organization workspace <span className="text-slate-300">/</span>{" "}
              <span className="font-mono uppercase">{organization.code}</span>
            </p>
          </div>
        </div>
        {canEdit && !editing ? (
          <Button variant="secondary" onClick={startEditing}>
            Edit organization
          </Button>
        ) : null}
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)]">
        <div>
          {editing ? (
            <form className="flex flex-col gap-4" noValidate onSubmit={submit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <FieldLabel htmlFor="organization-name">Organization name</FieldLabel>
                  <Input
                    id="organization-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-10"
                    maxLength={160}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="organization-code">Organization code</FieldLabel>
                  <Input
                    id="organization-code"
                    value={organization.code}
                    readOnly
                    disabled
                    className="h-10 bg-slate-50 font-mono text-slate-500"
                  />
                  <p className="text-[11px] text-slate-400">
                    The code identifies this workspace and cannot be changed.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="organization-currency">Base currency</FieldLabel>
                  <select
                    id="organization-currency"
                    value={baseCurrency}
                    onChange={(event) => setBaseCurrency(event.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500"
                  >
                    {!selectedCurrencyVisible ? (
                      <option value={baseCurrency}>{baseCurrency}</option>
                    ) : null}
                    {currencyOptions.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name}
                      </option>
                    ))}
                  </select>
                  {currencies.isError ? (
                    <p className="text-[11px] text-rose-700">
                      {getApiErrorMessage(currencies.error)}
                    </p>
                  ) : null}
                </div>
              </div>

              {editError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {editError}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditing(false);
                    setEditError(null);
                  }}
                  disabled={save.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800"
                  disabled={save.isPending}
                >
                  {save.isPending ? "Saving..." : "Save organization"}
                </Button>
              </div>
            </form>
          ) : (
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail label="Organization name" value={organization.name} />
              <Detail
                label="Organization code"
                value={<span className="font-mono uppercase">{organization.code}</span>}
              />
              <Detail label="Base currency" value={organization.baseCurrencyCode} />
              <Detail
                label="Workspace status"
                value={<span className="uppercase">{organization.status}</span>}
              />
              <Detail label="Your membership" value={humanize(organization.membershipStatus)} />
              <Detail
                label="Organization ID"
                wide
                value={
                  <span className="break-all font-mono text-xs text-slate-500">
                    {organization.id}
                  </span>
                }
              />
            </dl>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">How this workspace works</h3>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-4 text-xs leading-5 text-slate-600">
              <li>
                Users, roles, customers, products, documents, and financial records all belong to
                this organization.
              </li>
              <li>
                The base currency is used for reporting and defaults on new financial documents.
              </li>
              <li>Access is checked against the roles assigned inside this workspace.</li>
              <li>
                Deleting the organization archives it, revokes member access, and keeps historical
                records for audit purposes.
              </li>
            </ul>
          </div>

          {canDelete ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <h3 className="text-sm font-semibold text-rose-900">Delete organization</h3>
              <p className="mt-1.5 text-xs leading-5 text-rose-800">
                This is a destructive administrator action. The workspace will be archived and all
                members will lose access immediately.
              </p>
              <Button
                variant="secondary"
                className="mt-3 w-full border-rose-200 text-rose-700 hover:bg-rose-50"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteConfirmation("");
                  setDeleteOpen(true);
                }}
              >
                Delete organization
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this organization?"
        description={
          <div className="flex flex-col gap-3">
            <p>
              <span className="font-semibold text-slate-900">{organization.name}</span> will be
              archived. Members will lose access and you will be signed out. Business records are
              retained for audit purposes.
            </p>
            <p className="text-xs text-slate-500">
              Type <span className="font-mono font-semibold text-slate-800">{organization.code}</span>{" "}
              to confirm.
            </p>
            <Input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={organization.code}
              className="h-10 font-mono"
              autoComplete="off"
            />
            {deleteError ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {deleteError}
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Delete organization"
        danger
        confirmDisabled={
          deleteConfirmation.trim().toUpperCase() !== organization.code.toUpperCase()
        }
        busy={remove.isPending}
        onCancel={closeDeleteDialog}
        onConfirm={() => remove.mutate()}
      />
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <section className="flex w-full flex-col gap-5">
      <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    </section>
  );
}

export function ProfilePanel() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    staleTime: 30_000,
  });
  const profile = profileQuery.data;

  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [removePhotoOpen, setRemovePhotoOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }
    setForm(formFromProfile(profile));
    syncSession(profile);
  }, [profile]);

  const save = useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onSuccess: (next) => {
      queryClient.setQueryData(["profile"], next);
      syncSession(next);
      setEditing(false);
      setSaveError(null);
    },
  });

  const uploadPhoto = useMutation({
    mutationFn: updateProfileAvatar,
    onSuccess: (next) => {
      queryClient.setQueryData(["profile"], next);
      syncSession(next);
      setPhotoError(null);
    },
    onError: (error) => setPhotoError(errorText(error)),
  });

  const removePhoto = useMutation({
    mutationFn: removeProfileAvatar,
    onSuccess: (next) => {
      queryClient.setQueryData(["profile"], next);
      syncSession(next);
      setRemovePhotoOpen(false);
      setPhotoError(null);
    },
    onError: (error) => setPhotoError(errorText(error)),
  });

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setPhotoError(null);
    try {
      const dataUrl = await imageFileToDataUrl(file);
      await uploadPhoto.mutateAsync(dataUrl);
    } catch (error) {
      setPhotoError(errorText(error));
    }
  }

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setSaveError("First name and last name are required.");
      return;
    }
    save.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      jobTitle: form.jobTitle.trim(),
      department: form.department.trim(),
      location: form.location.trim(),
      bio: form.bio.trim(),
    });
  }

  if (profileQuery.isPending) {
    return <ProfileSkeleton />;
  }

  if (profileQuery.isError || !profile) {
    return (
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-6 w-6"
          >
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-950">Profile could not be loaded</h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          {getApiErrorMessage(profileQuery.error)}
        </p>
        <Button className="mt-5" onClick={() => profileQuery.refetch()}>
          Try again
        </Button>
      </section>
    );
  }

  const completionFields = [
    { label: "Profile photo", done: Boolean(profile.avatarUrl) },
    { label: "Phone number", done: Boolean(profile.phone) },
    { label: "Job title", done: Boolean(profile.jobTitle) },
    { label: "Department", done: Boolean(profile.department) },
    { label: "Location", done: Boolean(profile.location) },
    { label: "Short bio", done: Boolean(profile.bio) },
  ];
  const completion = Math.round(
    (completionFields.filter((field) => field.done).length / completionFields.length) * 100,
  );
  const permissionGroups = new Map<string, number>();
  for (const permission of profile.permissions) {
    const [module] = permission.split(":");
    permissionGroups.set(module, (permissionGroups.get(module) ?? 0) + 1);
  }
  const isAdministrator = profile.roles.some((role) => role.code === "admin");
  const canEditOrganization =
    isAdministrator || profile.permissions.includes("organizations:update");
  const canDeleteOrganization =
    isAdministrator || profile.permissions.includes("organizations:delete");

  return (
    <section className="flex w-full flex-col gap-5">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.04]">
        <div className="h-1.5 bg-slate-800" />
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="relative w-fit shrink-0">
              <UserAvatar
                firstName={profile.firstName}
                lastName={profile.lastName}
                src={profile.avatarUrl}
                className="h-24 w-24 rounded-2xl border border-slate-200 bg-slate-100 sm:h-28 sm:w-28"
                fallbackClassName="bg-slate-800 text-white"
                textClassName="text-3xl"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadPhoto.isPending}
                className="absolute -bottom-1.5 -right-1.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white bg-slate-900 text-white shadow-md transition hover:bg-slate-700 disabled:opacity-60"
                aria-label="Upload profile photo"
                title="Upload profile photo"
              >
                {uploadPhoto.isPending ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className="h-4 w-4"
                  >
                    <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  {profile.firstName} {profile.lastName}
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {humanize(profile.status)}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-medium text-slate-600">
                {profile.jobTitle || "Add your job title"}
                {profile.department ? ` - ${profile.department}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    className="h-3.5 w-3.5"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m4 7 8 6 8-6" />
                  </svg>
                  {profile.email}
                </span>
                {profile.organization ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                    {profile.organization.name}
                  </span>
                ) : null}
                {profile.roles.map((role) => (
                  <span
                    key={role.code}
                    className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white"
                  >
                    {role.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 sm:max-w-[220px] sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadPhoto.isPending}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  className="mr-1.5 h-4 w-4"
                >
                  <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
                {uploadPhoto.isPending ? "Uploading..." : "Upload photo"}
              </Button>
              {!editing ? (
                <Button
                  className="bg-slate-900 hover:bg-slate-800"
                  onClick={() => {
                    setSaveError(null);
                    setEditing(true);
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className="mr-1.5 h-4 w-4"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  Edit profile
                </Button>
              ) : null}
              {profile.avatarUrl ? (
                <Button
                  variant="secondary"
                  onClick={() => setRemovePhotoOpen(true)}
                  disabled={removePhoto.isPending}
                >
                  Remove photo
                </Button>
              ) : null}
            </div>
          </div>

          {photoError ? (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {photoError}
            </p>
          ) : null}

          <div className="mt-5 grid gap-2 border-t border-slate-100 pt-4 text-xs font-medium text-slate-600 sm:grid-cols-3">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              Member since {formatDate(profile.createdAt)}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              Last sign-in {formatDateTime(profile.lastLoginAt)}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              {profile.location || "Location not added"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
        <div className="flex flex-col gap-5">
          <Card
            title="Personal information"
            description="Keep your contact and work details up to date."
            action={
              !editing ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline"
                  onClick={() => {
                    setSaveError(null);
                    setEditing(true);
                  }}
                >
                  Edit
                </button>
              ) : null
            }
          >
            {editing ? (
              <form className="flex flex-col gap-4" noValidate onSubmit={submitProfile}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel htmlFor="profile-first-name">First name</FieldLabel>
                    <Input
                      id="profile-first-name"
                      value={form.firstName}
                      onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                      className="h-10"
                      autoComplete="given-name"
                      maxLength={100}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel htmlFor="profile-last-name">Last name</FieldLabel>
                    <Input
                      id="profile-last-name"
                      value={form.lastName}
                      onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                      className="h-10"
                      autoComplete="family-name"
                      maxLength={100}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel htmlFor="profile-phone">Phone</FieldLabel>
                    <Input
                      id="profile-phone"
                      value={form.phone}
                      onChange={(event) => setForm({ ...form, phone: event.target.value })}
                      className="h-10"
                      autoComplete="tel"
                      placeholder="+92 300 1234567"
                      maxLength={32}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel htmlFor="profile-job-title">Job title</FieldLabel>
                    <Input
                      id="profile-job-title"
                      value={form.jobTitle}
                      onChange={(event) => setForm({ ...form, jobTitle: event.target.value })}
                      className="h-10"
                      placeholder="Sales manager"
                      maxLength={120}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel htmlFor="profile-department">Department</FieldLabel>
                    <Input
                      id="profile-department"
                      value={form.department}
                      onChange={(event) => setForm({ ...form, department: event.target.value })}
                      className="h-10"
                      placeholder="Commercial"
                      maxLength={120}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel htmlFor="profile-location">Location</FieldLabel>
                    <Input
                      id="profile-location"
                      value={form.location}
                      onChange={(event) => setForm({ ...form, location: event.target.value })}
                      className="h-10"
                      placeholder="Lahore, Pakistan"
                      maxLength={160}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <FieldLabel htmlFor="profile-email">Email address</FieldLabel>
                    <Input
                      id="profile-email"
                      value={profile.email}
                      readOnly
                      disabled
                      className="h-10 bg-slate-50 text-slate-500"
                    />
                    <p className="text-[11px] text-slate-400">
                      Email changes are managed by an administrator.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <FieldLabel htmlFor="profile-bio">Short bio</FieldLabel>
                      <span className="text-[11px] text-slate-400">{form.bio.length}/500</span>
                    </div>
                    <textarea
                      id="profile-bio"
                      value={form.bio}
                      onChange={(event) => setForm({ ...form, bio: event.target.value })}
                      maxLength={500}
                      rows={4}
                      placeholder="A short introduction about your role and responsibilities."
                      className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-700 focus:ring-4 focus:ring-brand-700/10"
                    />
                  </div>
                </div>

                {saveError ? <p className="text-sm text-rose-700">{saveError}</p> : null}
                {save.isError ? (
                  <p className="text-sm text-rose-700">{getApiErrorMessage(save.error)}</p>
                ) : null}

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setForm(formFromProfile(profile));
                      setEditing(false);
                      setSaveError(null);
                    }}
                    disabled={save.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-slate-900 hover:bg-slate-800"
                    disabled={save.isPending}
                  >
                    {save.isPending ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </form>
            ) : (
              <dl className="grid gap-5 sm:grid-cols-2">
                <Detail label="First name" value={profile.firstName} />
                <Detail label="Last name" value={profile.lastName} />
                <Detail label="Email address" value={profile.email} />
                <Detail
                  label="Phone"
                  value={profile.phone || <span className="text-slate-400">Not added</span>}
                />
                <Detail
                  label="Job title"
                  value={profile.jobTitle || <span className="text-slate-400">Not added</span>}
                />
                <Detail
                  label="Department"
                  value={profile.department || <span className="text-slate-400">Not added</span>}
                />
                <Detail
                  label="Location"
                  value={profile.location || <span className="text-slate-400">Not added</span>}
                />
                <Detail
                  label="Organization"
                  value={
                    profile.organization?.name || <span className="text-slate-400">Not linked</span>
                  }
                />
                <Detail
                  label="About"
                  wide
                  value={
                    profile.bio ? (
                      <p className="max-w-3xl text-sm font-normal leading-6 text-slate-600">
                        {profile.bio}
                      </p>
                    ) : (
                      <span className="text-slate-400">
                        Add a short bio to help teammates know you better.
                      </span>
                    )
                  }
                />
              </dl>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card
            title="Profile completion"
            description="A complete profile makes collaboration easier."
          >
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold tracking-tight text-slate-950">
                  {completion}%
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {completionFields.filter((field) => field.done).length} of{" "}
                  {completionFields.length} details added
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  className="h-5 w-5"
                >
                  <path d="M12 22a10 10 0 1 0-10-10" />
                  <path d="m12 12 4-4" />
                  <path d="M2 12h4M12 2v4" />
                </svg>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-700 transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
            <ul className="mt-4 space-y-2">
              {completionFields.map((field) => (
                <li key={field.label} className="flex items-center gap-2.5 text-xs">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full ${
                      field.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {field.done ? (
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                        <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
                      </svg>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <span className={field.done ? "font-medium text-slate-700" : "text-slate-500"}>
                    {field.label}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Access & roles" description="Effective access in your current organization.">
            <div className="flex flex-wrap gap-1.5">
              {profile.roles.length > 0 ? (
                profile.roles.map((role) => (
                  <span
                    key={role.code}
                    className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white"
                    title={role.description ?? role.name}
                  >
                    {role.name}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No roles assigned</span>
              )}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              {profile.permissions.length} permission
              {profile.permissions.length === 1 ? "" : "s"} across {permissionGroups.size} module
              {permissionGroups.size === 1 ? "" : "s"}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[...permissionGroups.entries()].slice(0, 8).map(([module, count]) => (
                <span
                  key={module}
                  className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-inset ring-slate-200"
                >
                  {humanize(module)} - {count}
                </span>
              ))}
            </div>
          </Card>

          <Card
            title="Account activity"
            description="Security-related timestamps for your account."
          >
            <ActivityRow label="Profile created" value={formatDate(profile.createdAt)} />
            <ActivityRow label="Last sign-in" value={formatDateTime(profile.lastLoginAt)} />
            <ActivityRow label="Password changed" value={formatDate(profile.passwordChangedAt)} />
          </Card>
        </div>
      </div>

      {profile.organization ? (
        <OrganizationSection
          organization={profile.organization}
          canEdit={canEditOrganization}
          canDelete={canDeleteOrganization}
        />
      ) : null}

      <SecuritySection
        passwordChangedAt={profile.passwordChangedAt}
        accountStatus={profile.status}
      />

      <ConfirmDialog
        open={removePhotoOpen}
        title="Remove profile photo?"
        description="Your initials will be shown until you upload a new photo."
        confirmLabel="Remove photo"
        busy={removePhoto.isPending}
        onCancel={() => setRemovePhotoOpen(false)}
        onConfirm={() => removePhoto.mutate()}
      />
    </section>
  );
}

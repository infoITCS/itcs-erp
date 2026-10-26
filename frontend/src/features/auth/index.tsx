import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { env } from "@/app/config/env.ts";
import { AuthLayout } from "@/components/layouts/AuthLayout.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { tokenStore } from "@/lib/token-store.ts";
import { getProviders, login } from "@/services/auth.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";

const loginSchema = z.object({
  email: z.string().trim().email({ error: "Enter a valid email" }),
  password: z.string().min(8, { error: "Use at least 8 characters" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const ssoErrors: Record<string, string> = {
  sso_cancelled: "Microsoft sign-in was cancelled.",
  sso_domain: "Use your ITCS Microsoft account (@itcs.com.pk).",
  sso_tenant: "Use your ITCS Microsoft account from the company tenant.",
  sso_account: "Your Microsoft account is not active in the ERP. Contact your administrator.",
  sso_expired: "The Microsoft sign-in session expired. Please try again.",
  sso_failed: "Microsoft sign-in could not be completed. Please try again.",
};

function safeReturnPath(from: unknown): string {
  if (
    typeof from !== "string" ||
    !from.startsWith("/") ||
    from.startsWith("//") ||
    from.startsWith("/login") ||
    from.includes("\\") ||
    [...from].some((character) => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f)
  ) {
    return "/";
  }
  try {
    const url = new URL(from, window.location.origin);
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : "/";
  } catch {
    return "/";
  }
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#f25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7fba00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00a4ef" d="M2 12.5h9.5V22H2z" />
      <path fill="#ffb900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const errorCode = search.get("error");
  const passwordChanged = search.get("passwordChanged") === "1";
  const returnTo = safeReturnPath((location.state as { from?: unknown } | null)?.from);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const providers = useQuery({
    queryKey: ["auth", "providers"],
    queryFn: getProviders,
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });
  const microsoftEnabled = providers.data?.data?.microsoft ?? false;
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <AuthLayout>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] short:p-4 sm:p-7">
        <div className="mb-5 short:mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Welcome back</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 short:text-xl">Sign in to ITCS ERP</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 short:hidden">
            Use your company Microsoft account or the email and password provided by your administrator.
          </p>
        </div>

        {passwordChanged ? (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">
            Password updated. Sign in again with your new password.
          </div>
        ) : null}

        {errorCode && ssoErrors[errorCode] ? (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
            {ssoErrors[errorCode]}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => window.location.assign(`${env.apiUrl}/api/v1/auth/microsoft/start`)}
          disabled={!microsoftEnabled}
          className="group flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          <MicrosoftIcon />
          <span>Continue with Microsoft</span>
          <span className="ml-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 group-disabled:bg-transparent">
            ITCS
          </span>
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-500 short:hidden">
          {providers.isPending
            ? "Checking company sign-in options…"
            : microsoftEnabled
              ? `Restricted to @${providers.data?.data?.microsoftDomain ?? "itcs.com.pk"} company accounts.`
              : "Microsoft SSO is not configured yet. Use email and password."}
        </p>

        <div className="my-5 flex items-center gap-3 short:my-4">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            or continue with email
          </span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form
          className="flex flex-col gap-3.5 short:gap-3"
          noValidate
          onSubmit={form.handleSubmit(async (values) => {
            setFormError(null);
            try {
              const result = await login(values);
              if (result.data?.accessToken && result.data.refreshToken && result.data.user) {
                tokenStore.setSession(result.data);
                navigate(returnTo, { replace: true });
              }
            } catch (error) {
              setFormError(getApiErrorMessage(error));
            }
          })}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Work email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="name@itcs.com.pk"
              className="h-11 rounded-xl border-slate-300 px-3.5 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-sm text-red-700">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <span className="text-xs text-slate-400">Admin-managed</span>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="h-11 rounded-xl border-slate-300 px-3.5 pr-16 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
                {...form.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-0 px-3.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {form.formState.errors.password ? (
              <p className="text-sm text-red-700">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          {formError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
              {formError}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="mt-1 h-11 rounded-xl bg-teal-800 px-4 text-sm font-semibold hover:bg-teal-900 disabled:bg-teal-800/60"
          >
            {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500 short:hidden">
          <span className="font-semibold text-slate-700">No access yet?</span> Ask an ERP administrator to
          create your account and assign a role. Passwords are never shown after they are set.
        </div>
      </div>
    </AuthLayout>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { env } from "@/app/config/env.ts";
import { AuthLayout } from "@/components/layouts/AuthLayout.tsx";
import { tokenStore } from "@/lib/token-store.ts";
import { exchangeMicrosoftTicket } from "@/services/auth.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";

const callbackErrors: Record<string, string> = {
  sso_cancelled: "Microsoft sign-in was cancelled.",
  sso_domain: "Use your ITCS Microsoft account (@itcs.com.pk).",
  sso_tenant: "Use your ITCS Microsoft account from the company tenant.",
  sso_account: "Your Microsoft account is not active in the ERP. Contact your administrator.",
  sso_expired: "The Microsoft sign-in session expired. Please try again.",
  sso_failed: "Microsoft sign-in could not be completed. Please try again.",
};

export function MicrosoftCallbackPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const started = useRef(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);

    const error = search.get("error");
    if (error) {
      setMessage(callbackErrors[error] ?? callbackErrors.sso_failed);
      return;
    }

    const ticket = search.get("ticket");
    if (!ticket) {
      setMessage("The Microsoft sign-in response is incomplete. Please try again.");
      return;
    }

    async function complete() {
      try {
        const result = await exchangeMicrosoftTicket(ticket as string);
        if (!result.data?.accessToken || !result.data.refreshToken || !result.data.user) {
          setMessage("The Microsoft sign-in response is incomplete. Please try again.");
          return;
        }
        tokenStore.setSession(result.data);
        navigate("/", { replace: true });
      } catch (error) {
        setMessage(getApiErrorMessage(error));
      }
    }

    void complete();
  }, [navigate, search]);

  return (
    <AuthLayout>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 ring-1 ring-teal-100">
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <path fill="#f25022" d="M2 2h9.5v9.5H2z" />
            <path fill="#7fba00" d="M12.5 2H22v9.5h-9.5z" />
            <path fill="#00a4ef" d="M2 12.5h9.5V22H2z" />
            <path fill="#ffb900" d="M12.5 12.5H22V22h-9.5z" />
          </svg>
        </div>

        <h1 className="mt-5 text-xl font-semibold text-slate-950">
          {message ? "Sign-in could not be completed" : "Completing Microsoft sign-in"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {message ?? "Verifying your ITCS account and opening the ERP workspace."}
        </p>

        {message ? (
          <div className="mt-6 flex flex-col gap-2">
            <Link
              to="/login"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-800 px-4 text-sm font-semibold text-white hover:bg-teal-900"
            >
              Back to sign in
            </Link>
            <button
              type="button"
              onClick={() => window.location.assign(`${env.apiUrl}/api/v1/auth/microsoft/start`)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Try Microsoft sign-in again
            </button>
          </div>
        ) : (
          <div className="mx-auto mt-6 h-1 w-40 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-teal-600" />
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

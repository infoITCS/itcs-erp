import type { ReactNode } from "react";

const highlights = [
  "Customer, product, reseller and opportunity data in one place",
  "Role-based access with a complete audit trail",
  "Microsoft 365 single sign-on for ITCS accounts",
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh overflow-hidden bg-slate-950">
      <div className="grid h-full lg:grid-cols-[1.05fr_1fr]">
        <aside className="relative hidden h-full min-h-0 overflow-hidden bg-slate-950 px-10 py-8 text-white short:py-5 lg:flex lg:flex-col xl:px-12">
          <div className="pointer-events-none absolute -left-24 top-24 h-80 w-80 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/15 ring-1 ring-teal-400/30">
              <span className="text-sm font-bold tracking-wider text-teal-300">IT</span>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide">ITCS ERP</p>
              <p className="text-xs text-slate-400">Commercial operations platform</p>
            </div>
          </div>

          <div className="relative my-auto max-w-lg py-10 short:py-4 xl:py-16">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-teal-200">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
              Secure company workspace
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight short:text-3xl xl:text-5xl">
              Run the commercial side of ITCS from one clear workspace.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-300 short:mt-3 short:text-sm">
              Sign in with your ITCS Microsoft 365 account, or use the credentials your
              administrator created for you.
            </p>

            <ul className="mt-10 flex flex-col gap-4 short:mt-5 short:gap-2">
              {highlights.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/15 ring-1 ring-teal-400/30">
                    <svg viewBox="0 0 20 20" className="h-3 w-3 text-teal-300" fill="currentColor" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 0 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-slate-500">
            ITCS internal system. Access is monitored and logged.
          </p>
        </aside>

        <main className="flex h-full min-h-0 flex-col bg-slate-50">
          <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-5 py-3 short:py-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950">
              <span className="text-[11px] font-bold tracking-wider text-teal-300">IT</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">ITCS ERP</p>
              <p className="text-[11px] text-slate-500">Commercial operations</p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-4 short:py-2 sm:px-8 sm:py-6">
            <div className="max-h-full w-full max-w-md">{children}</div>
          </div>

          <p className="shrink-0 px-6 pb-4 text-center text-xs text-slate-500 short:pb-2 lg:text-left">
            Need access? Contact your ITCS ERP administrator.
          </p>
        </main>
      </div>
    </div>
  );
}

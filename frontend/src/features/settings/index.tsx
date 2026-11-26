import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button.tsx";
import { ProfilePanel } from "@/features/profile/index.tsx";
import { DocumentTemplateSettingsPanel } from "@/features/settings/DocumentTemplateSettings.tsx";
import { useHasPermission, useIsAdmin } from "@/hooks/useSession.ts";
import { getProviders } from "@/services/auth.ts";
import {
  getAuditLogRetention,
  listAuditLogs,
  updateAuditLogRetention,
  type AuditLogEntry,
} from "@/services/audit-logs.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";

type SettingsTab = "profile" | "document-template" | "audit" | "sign-in";

const tabs: Array<{ id: SettingsTab; label: string; description: string; permission?: string }> = [
  {
    id: "profile",
    label: "Profile",
    description: "Your account details, security, organization, and access",
  },
  {
    id: "document-template",
    label: "Document & Print Template",
    description: "Configure company logo, legal address, bank wire details, and invoice/quote print format",
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

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
    new Date(value),
  );
}

type AuditDatePreset = "all" | "today" | "yesterday" | "7d" | "custom";

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function auditDateQuery(preset: AuditDatePreset, customDate: string) {
  if (preset === "custom") return customDate ? { date: customDate } : {};
  if (preset === "today") return { date: localDateString(new Date()) };
  if (preset === "yesterday") {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return { date: localDateString(date) };
  }
  if (preset === "7d") {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  return {};
}

function auditDateLabel(preset: AuditDatePreset, customDate: string): string {
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (preset === "today") return `Today, ${formatter.format(new Date())}`;
  if (preset === "yesterday") {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return `Yesterday, ${formatter.format(date)}`;
  }
  if (preset === "7d") return "Last 7 days";
  if (preset === "custom" && customDate) return formatter.format(new Date(`${customDate}T12:00:00`));
  return "All dates";
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

const TONE_STYLES: Record<AuditLogEntry["action"]["tone"], string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

const TONE_ICONS: Record<AuditLogEntry["action"]["tone"], string> = {
  emerald: "bg-emerald-500 ring-emerald-100",
  blue: "bg-blue-500 ring-blue-100",
  amber: "bg-amber-500 ring-amber-100",
  rose: "bg-rose-500 ring-rose-100",
  violet: "bg-violet-500 ring-violet-100",
  slate: "bg-slate-500 ring-slate-100",
};

type AuditCategory = AuditLogEntry["action"]["category"];

const CATEGORY_META: Record<AuditCategory, { label: string; tone: AuditLogEntry["action"]["tone"] }> = {
  create: { label: "Created", tone: "emerald" },
  update: { label: "Updated", tone: "blue" },
  status: { label: "Status changes", tone: "amber" },
  delete: { label: "Removed", tone: "rose" },
  security: { label: "Security", tone: "rose" },
  convert: { label: "Converted", tone: "violet" },
};

function relativeTime(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    return formatDateTime(value);
  }
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(value);
}

function sessionMeta(userAgent: string | null): string | null {
  if (!userAgent) {
    return null;
  }
  const browser = userAgent.includes("Edg/")
    ? "Edge"
    : userAgent.includes("Chrome/")
      ? "Chrome"
      : userAgent.includes("Firefox/")
        ? "Firefox"
        : userAgent.includes("Safari/")
          ? "Safari"
          : "Browser";
  const os = userAgent.includes("Windows")
    ? "Windows"
    : userAgent.includes("Android")
      ? "Android"
      : userAgent.includes("iPhone") || userAgent.includes("iPad")
        ? "iOS"
        : userAgent.includes("Mac OS")
          ? "macOS"
          : null;
  return os ? `${os} · ${browser}` : browser;
}

function ActivityGlyph({ icon, className }: { icon: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    edit: <path d="m16.5 3.5 4 4M4 20l4.5-1 11-11a2.12 2.12 0 0 0-3-3l-11 11L4 20Z" />,
    spark: <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1" />,
    trash: <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />,
    shield: <path d="M12 3 5 6v6c0 4.4 2.9 7.9 7 9 4.1-1.1 7-4.6 7-9V6l-7-3Zm-2.5 9 2 2 4-4" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[icon] ?? paths.spark}
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function AuditTab() {
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [datePreset, setDatePreset] = useState<AuditDatePreset>("all");
  const [customDate, setCustomDate] = useState("");
  const [retentionInput, setRetentionInput] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const dateQuery = useMemo(() => auditDateQuery(datePreset, customDate), [datePreset, customDate]);
  const audit = useInfiniteQuery({
    queryKey: ["audit-logs", moduleFilter, dateQuery.date, dateQuery.from, dateQuery.to],
    queryFn: ({ pageParam }) =>
      listAuditLogs({
        cursor: pageParam ?? undefined,
        limit: 25,
        ...(moduleFilter === "all" ? {} : { module: moduleFilter }),
        ...dateQuery,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
  });
  const retention = useQuery({
    queryKey: ["audit-log-retention"],
    queryFn: getAuditLogRetention,
  });
  const retentionMutation = useMutation({
    mutationFn: updateAuditLogRetention,
    onSuccess: (view) => {
      setRetentionInput(String(view.retentionDays));
      void queryClient.invalidateQueries({ queryKey: ["audit-log-retention"] });
      void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
  const entries = audit.data?.pages.flatMap((page) => page.items) ?? [];
  const retentionDays = retention.data?.retentionDays ?? 365;
  const draftRetentionDays = Number(retentionInput) || retentionDays;
  const retentionValid =
    Number.isInteger(draftRetentionDays) && draftRetentionDays >= 1 && draftRetentionDays <= 3650;

  const modules = useMemo(
    () =>
      Array.from(new Map(entries.map((entry) => [entry.module.key, entry.module.label])).entries())
        .map(([key, label]) => ({ key, label }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [entries],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (moduleFilter !== "all" && entry.module.key !== moduleFilter) return false;
      if (categoryFilter !== "all" && entry.action.category !== categoryFilter) return false;
      return !term || entry.searchText.includes(term);
    });
  }, [entries, search, moduleFilter, categoryFilter]);

  const groups = useMemo(() => {
    const grouped = new Map<string, AuditLogEntry[]>();
    for (const entry of filtered) {
      const key = entry.createdAt.slice(0, 10);
      const list = grouped.get(key) ?? [];
      list.push(entry);
      grouped.set(key, list);
    }
    return Array.from(grouped.entries()).map(([key, items]) => ({
      key,
      label: new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(
        new Date(`${key}T12:00:00`),
      ),
      items,
    }));
  }, [filtered]);

  const stats = useMemo(() => {
    const people = new Set(entries.map((entry) => entry.actor.email ?? entry.actor.name));
    const today = new Date().toISOString().slice(0, 10);
    return {
      loaded: entries.length,
      people: people.size,
      areas: modules.length,
      today: entries.filter((entry) => entry.createdAt.startsWith(today)).length,
    };
  }, [entries, modules]);

  const categoryStats = useMemo(() => {
    const counts = new Map<AuditCategory, number>();
    for (const entry of entries) {
      counts.set(entry.action.category, (counts.get(entry.action.category) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([key, count]) => ({
      key,
      count,
      label: CATEGORY_META[key].label,
      tone: CATEGORY_META[key].tone,
    }));
  }, [entries]);

  const toggleDetails = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Enterprise activity ledger
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
              Know who acted, what changed, and when.
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">
              Every event is translated into plain language, with the affected record and exact before/after values.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:w-[540px]">
            <Stat label="Events" value={String(stats.loaded)} />
            <Stat label="People" value={String(stats.people)} />
            <Stat label="Areas" value={String(stats.areas)} />
            <Stat label="Today" value={String(stats.today)} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-brand-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people, actions, or records…"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </label>
          <select
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            aria-label="Filter by area"
          >
            <option value="all">All areas</option>
            {modules.map((module) => (
              <option key={module.key} value={module.key}>{module.label}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            aria-label="Filter by event type"
          >
            <option value="all">All event types</option>
            {Array.from(new Set(entries.map((entry) => entry.action.category))).map((category) => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Date</span>
          {(
            [
              ["all", "All"],
              ["today", "Today"],
              ["yesterday", "Yesterday"],
              ["7d", "Last 7 days"],
              ["custom", "Custom"],
            ] as Array<[AuditDatePreset, string]>
          ).map(([preset, label]) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDatePreset(preset)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                datePreset === preset
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
          <input
            type="date"
            value={customDate}
            onFocus={() => setDatePreset("custom")}
            onChange={(event) => {
              setCustomDate(event.target.value);
              setDatePreset("custom");
            }}
            aria-label="Select custom date"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
          {(search || moduleFilter !== "all" || categoryFilter !== "all" || datePreset !== "all") ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setModuleFilter("all");
                setCategoryFilter("all");
                setDatePreset("all");
                setCustomDate("");
              }}
              className="ml-auto rounded-xl px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
            >
              Clear filters
            </button>
          ) : null}
        </div>
        <p className="mt-2.5 px-1 text-[11px] text-slate-400">
          Showing {filtered.length} of {entries.length} loaded events · {auditDateLabel(datePreset, customDate)} · names replace record IDs automatically
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">Retention policy</p>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
                Active
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Logs older than {retentionDays} days are removed automatically every 24 hours.
            </p>
          </div>
          {isAdmin ? (
            <div className="flex items-end gap-2">
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Days
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={retentionInput || String(retentionDays)}
                  onChange={(event) => setRetentionInput(event.target.value)}
                  className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                />
              </label>
              <Button
                type="button"
                disabled={!retentionValid || retentionMutation.isPending}
                onClick={() => retentionMutation.mutate(draftRetentionDays)}
              >
                {retentionMutation.isPending ? "Saving…" : "Save policy"}
              </Button>
            </div>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
              Managed by admin
            </span>
          )}
        </div>
        {retentionMutation.isError ? (
          <p className="mt-2 text-xs text-rose-600">{getApiErrorMessage(retentionMutation.error)}</p>
        ) : null}
      </section>

      {categoryStats.length > 0 ? (
        <section className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Event mix
          </span>
          {categoryStats.map((category) => {
            const active = categoryFilter === category.key;
            return (
              <button
                key={category.key}
                type="button"
                onClick={() => setCategoryFilter(active ? "all" : category.key)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  active
                    ? "border-brand-300 bg-white text-brand-800 shadow-sm ring-2 ring-brand-100"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${TONE_ICONS[category.tone].split(" ")[0]}`} />
                {category.label}
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                  {category.count}
                </span>
              </button>
            );
          })}
        </section>
      ) : null}

      <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        Read each event as <span className="font-semibold text-slate-800">actor → action → affected record → changes</span>.
        Record IDs are replaced with names wherever possible.
      </p>

      {audit.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : null}
      {audit.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          {getApiErrorMessage(audit.error)}
        </div>
      ) : null}
      {!audit.isPending && !audit.isError && filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <ActivityGlyph icon="shield" className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-800">
            {entries.length === 0 ? "No activity recorded yet" : "No events match these filters"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {entries.length === 0 ? "Actions across the workspace will appear here." : "Try a different search or clear the filters."}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.key}>
            <div className="mb-3 flex items-center gap-3">
              <span className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                {group.label}
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
            </div>
            <ol className="relative ml-4 space-y-4 border-l border-slate-200 pl-6 sm:ml-6 sm:pl-8">
              {group.items.map((entry) => {
                const detailsOpen = expanded.has(entry.id);
                const session = sessionMeta(entry.userAgent);
                return (
                  <li key={entry.id} className="relative">
                    <span
                      className={`absolute -left-[42px] top-5 flex h-7 w-7 items-center justify-center rounded-full text-white ring-4 sm:-left-[50px] ${TONE_ICONS[entry.action.tone]}`}
                    >
                      <ActivityGlyph icon={entry.action.icon} className="h-3.5 w-3.5" />
                    </span>
                    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:shadow-md sm:p-5">
                      <div className="flex gap-3 sm:gap-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-semibold text-white shadow-sm sm:h-10 sm:w-10">
                          {entry.actor.initials || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${TONE_STYLES[entry.action.tone]}`}>
                              {entry.action.label}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                              {entry.module.label}
                            </span>
                            {entry.actor.isSystem ? (
                              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
                                System
                              </span>
                            ) : null}
                            <div className="ml-auto flex items-center gap-2">
                              <time
                                dateTime={entry.createdAt}
                                title={formatDateTime(entry.createdAt)}
                                className="text-[11px] font-semibold text-slate-600"
                              >
                                {formatTime(entry.createdAt)}
                              </time>
                              <span className="text-[11px] text-slate-400">{relativeTime(entry.createdAt)}</span>
                            </div>
                          </div>
                          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            What happened
                          </p>
                          <h3 className="mt-1 text-sm font-semibold leading-6 text-slate-950 sm:text-base">
                            {entry.action.headline}
                          </h3>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{entry.action.description}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500">
                              Affected · {entry.subject.typeLabel}:{" "}
                              <span className="font-semibold text-slate-800">{entry.subject.label}</span>
                            </span>
                            {entry.subject.detail ? (
                              <span className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600">
                                {entry.subject.detail}
                              </span>
                            ) : null}
                            {entry.facts.slice(0, 3).map((fact) => (
                              <span key={fact.label} className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-500">
                                {fact.label}: <span className="font-semibold text-slate-700">{fact.value}</span>
                              </span>
                            ))}
                          </div>
                          {detailsOpen && entry.changes.length > 0 ? (
                            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2 font-semibold">Field</th>
                                    <th className="px-3 py-2 font-semibold">Before</th>
                                    <th className="px-3 py-2 font-semibold">After</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {entry.changes.map((change) => (
                                    <tr key={change.key}>
                                      <td className="px-3 py-2 font-semibold text-slate-700">{change.label}</td>
                                        <td className="px-3 py-2 text-slate-500">{change.before}</td>
                                        <td className="px-3 py-2 font-semibold text-emerald-700">{change.after}</td>

                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-700">{entry.actor.name}</span>
                            {entry.actor.email ? <span>{entry.actor.email}</span> : null}
                            <span title={formatDateTime(entry.createdAt)}>{formatDateTime(entry.createdAt)}</span>
                            {session ? <span>{session}</span> : null}
                            {entry.ipAddress ? <span>{entry.ipAddress}</span> : null}
                            {entry.changes.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => toggleDetails(entry.id)}
                                className="ml-auto rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-brand-700 transition hover:bg-brand-50"
                              >
                                {detailsOpen ? "Hide changes" : `View ${entry.changes.length} change${entry.changes.length === 1 ? "" : "s"}`}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      {audit.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => audit.fetchNextPage()} disabled={audit.isFetchingNextPage}>
            {audit.isFetchingNextPage ? "Loading older events…" : "Load older events"}
          </Button>
        </div>
      ) : null}
    </div>
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
  const canReadAudit = useHasPermission("audit-logs:read");
  const isAdmin = useIsAdmin();
  const visibleTabs = tabs.filter((tab) => {
    if (tab.id === "document-template") return isAdmin;
    if (tab.permission === "audit-logs:read") return canReadAudit;
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

      <div className="flex min-w-0 flex-col gap-6">
        <nav
          aria-label="Settings sections"
          className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm"
        >
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={current === tab.id ? "page" : undefined}
              onClick={() => setActiveTab(tab.id)}
              className={
                current === tab.id
                  ? "rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm"
                  : "rounded-lg px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">{currentTab.label}</h2>
            <p className="text-xs text-slate-500">{currentTab.description}</p>
          </div>
          {current === "profile" ? <ProfilePanel /> : null}
          {current === "document-template" ? (
            isAdmin ? <DocumentTemplateSettingsPanel /> : (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                <svg className="mx-auto h-10 w-10 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="mt-3 text-sm font-semibold text-red-800">Admin Access Required</p>
                <p className="mt-1 text-xs text-red-600">Only administrators can configure the document & print template.</p>
              </div>
            )
          ) : null}
          {current === "audit" ? <AuditTab /> : null}
          {current === "sign-in" ? <SignInTab /> : null}
        </div>
      </div>
    </section>
  );
}

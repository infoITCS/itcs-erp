import type { ProjectStatus } from "./api.ts";

export type ProjectStatusTone = "slate" | "brand" | "blue" | "emerald" | "amber" | "rose";

export function statusLabel(status: string): string {
  return status
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatMoney(amount: string, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

export function formatRupees(amount: string, currency: string): string {
  if (currency === "PKR") {
    return `PKRs. ${Number(amount).toFixed(2)}`;
  }
  return formatMoney(amount, currency);
}

export function formatPercent(value: string): string {
  return `${Number(value).toFixed(2)}%`;
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  return String(value).slice(0, 10);
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function projectStatusTone(status: ProjectStatus): ProjectStatusTone {
  switch (status) {
    case "IN_PROGRESS":
      return "brand";
    case "ON_HOLD":
      return "amber";
    case "COMPLETED":
      return "emerald";
    case "CANCELLED":
      return "rose";
    default:
      return "slate";
  }
}

const badgeStyles: Record<ProjectStatusTone, { badge: string; dot: string }> = {
  brand: { badge: "bg-brand-50 text-brand-800 ring-brand-200", dot: "bg-brand-600" },
  blue: { badge: "bg-blue-50 text-blue-800 ring-blue-200", dot: "bg-blue-600" },
  emerald: { badge: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  amber: { badge: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  rose: { badge: "bg-rose-50 text-rose-800 ring-rose-200", dot: "bg-rose-500" },
  slate: { badge: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
};

export function ProjectStatusBadge({ status, deleted = false }: { status: ProjectStatus; deleted?: boolean }) {
  if (deleted) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Deleted
      </span>
    );
  }
  const tone = badgeStyles[projectStatusTone(status)];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${tone.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} /> {statusLabel(status)}
    </span>
  );
}

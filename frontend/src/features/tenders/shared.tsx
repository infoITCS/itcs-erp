import { CLOSED_TENDER_STATUSES, type TenderStatus } from "./api.ts";

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
    }).format(Number(amount));
  } catch {
    return `${amount} ${currency}`;
  }
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

export function isDeadlineOverdue(deadline: string | null, status: TenderStatus): boolean {
  if (!deadline || CLOSED_TENDER_STATUSES.includes(status)) {
    return false;
  }
  return new Date(deadline).getTime() < Date.now();
}

export function toLocalDateTimeInput(value: string): string {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function TenderStatusBadge({
  status,
  deleted = false,
}: {
  status: TenderStatus;
  deleted?: boolean;
}) {
  if (deleted) {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
        Deleted
      </span>
    );
  }
  const tone = statusTone(status);
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function statusTone(status: TenderStatus): string {
  switch (status) {
    case "OPEN":
      return "bg-teal-50 text-teal-800 ring-teal-200";
    case "SUBMITTED":
      return "bg-blue-50 text-blue-800 ring-blue-200";
    case "WON":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "LOST":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "CANCELLED":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

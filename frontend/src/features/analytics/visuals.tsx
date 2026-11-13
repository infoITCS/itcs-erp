import { useEffect, useRef, useState, type ReactNode } from "react";

export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.08)] ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function TrendBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
        positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {positive ? <path d="M7 17 17 7M9 7h8v8" /> : <path d="M7 7 17 17M17 9v8H9" />}
      </svg>
      {positive ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

export function KpiCard({
  label,
  value,
  format,
  delta,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: number;
  format: (value: number) => string;
  delta?: number | null;
  sub?: string;
  icon: ReactNode;
  tone: string;
}) {
  const animated = useCountUp(value);

  return (
    <Card className="transition-shadow duration-200 hover:shadow-[0_10px_30px_-10px_rgba(6,81,237,0.2)]">
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${tone}`}>
          {icon}
        </span>
        {typeof delta === "number" ? <TrendBadge value={delta} /> : null}
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-800 md:text-3xl">
        {format(animated)}
      </p>
      {sub ? <p className="mt-1 text-xs text-slate-400">{sub}</p> : null}
    </Card>
  );
}

export function MiniStat({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.06)]">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500">{label}</p>
        <p className="text-lg font-bold tracking-tight text-slate-800">{value}</p>
        {sub ? <p className="truncate text-xs text-slate-400">{sub}</p> : null}
      </div>
    </div>
  );
}

export function BarList({
  items,
}: {
  items: { key: string; label: string; value: number; caption?: string }[];
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="space-y-3.5">
      {items.map((item, index) => (
        <li key={item.key}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-700">{item.label}</span>
            <span className="shrink-0 tabular-nums text-slate-400">{item.caption}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-[width] duration-700 ease-out"
              style={{
                width: `${Math.max((item.value / max) * 100, 3)}%`,
                transitionDelay: `${index * 50}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Funnel({ stages }: { stages: { key: string; label: string; count: number }[] }) {
  const max = Math.max(1, ...stages.map((stage) => stage.count));
  return (
    <ol className="space-y-3">
      {stages.map((stage, index) => (
        <li key={stage.key}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">{stage.label}</span>
            <span className="tabular-nums font-semibold text-slate-800">{stage.count}</span>
          </div>
          <div className="mt-1.5 h-8 overflow-hidden rounded-lg bg-slate-100">
            <div
              className="flex h-full items-center justify-end rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 pr-2 text-[11px] font-semibold text-white transition-[width] duration-700 ease-out"
              style={{
                width: `${Math.max((stage.count / max) * 100, 12)}%`,
                transitionDelay: `${index * 70}ms`,
              }}
            >
              {max > 0 ? `${Math.round((stage.count / max) * 100)}%` : ""}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

const SEGMENT_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  SENT: "#60a5fa",
  ACCEPTED: "#10b981",
  REJECTED: "#f87171",
  EXPIRED: "#f59e0b",
  CANCELLED: "#f472b6",
  CONFIRMED: "#60a5fa",
  PROCESSING: "#6366f1",
  FULFILLED: "#10b981",
  CLOSED: "#94a3b8",
  PARTIALLY_PAID: "#8b5cf6",
  PAID: "#10b981",
  OVERDUE: "#fb923c",
  VOID: "#f472b6",
};

export function StatusSegments({ segments }: { segments: { status: string; count: number }[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);

  if (total === 0) {
    return <p className="text-xs text-slate-400">No records in this range.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {segments.map((segment) => (
          <div
            key={segment.status}
            title={`${segment.status}: ${segment.count}`}
            style={{
              width: `${(segment.count / total) * 100}%`,
              backgroundColor: SEGMENT_COLORS[segment.status] ?? "#6366f1",
            }}
            className="transition-all duration-700"
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((segment) => (
          <li key={segment.status} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: SEGMENT_COLORS[segment.status] ?? "#6366f1" }}
            />
            <span className="text-slate-600">{segment.status}</span>
            <span className="tabular-nums">{segment.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

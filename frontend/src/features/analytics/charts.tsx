import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 12px 32px -12px rgba(6,81,237,0.25)",
  fontSize: 12,
  padding: "8px 12px",
} as const;

const LABEL_STYLE = { color: "#334155", fontWeight: 600, fontSize: 12 } as const;

const DONUT_COLORS = [
  "#3b82f6",
  "#06b6d4",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
];

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function RevenueAreaChart({
  data,
  format,
}: {
  data: { label: string; invoiced: number; collected: number }[];
  format: (value: number) => string;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="analyticsInvGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="analyticsColGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.26} />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            dy={6}
            tick={{ fontSize: 12, fill: "#94a3b8" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={54}
            tick={{ fontSize: 12, fill: "#94a3b8" }}
            tickFormatter={(value) => compactNumber(Number(value))}
          />
          <Tooltip
            cursor={{ stroke: "#cbd5e1", strokeWidth: 1, strokeDasharray: "4 4" }}
            formatter={(value) => format(Number(value))}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
          />
          <Area
            type="monotone"
            dataKey="invoiced"
            name="Invoiced"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fill="url(#analyticsInvGrad)"
          />
          <Area
            type="monotone"
            dataKey="collected"
            name="Collected"
            stroke="#06b6d4"
            strokeWidth={2.5}
            fill="url(#analyticsColGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SourceDonutChart({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((sum, row) => sum + row.value, 0);

  return (
    <div>
      <div className="relative h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={86}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tracking-tight text-slate-800">
            {total.toLocaleString("en-US")}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-slate-400">leads</span>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {data.map((row, index) => (
          <li key={row.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
              />
              <span className="truncate text-slate-600">{row.name}</span>
            </span>
            <span className="shrink-0 tabular-nums font-medium text-slate-700">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HorizontalBars({
  data,
  format,
  gradientId,
  from,
  to,
}: {
  data: { label: string; value: number }[];
  format: (value: number) => string;
  gradientId: string;
  from: string;
  to: string;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
          barCategoryGap={12}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal={false} strokeDasharray="4 6" stroke="#e2e8f0" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={104}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.1)" }}
            formatter={(value) => format(Number(value))}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18} fill={`url(#${gradientId})`} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

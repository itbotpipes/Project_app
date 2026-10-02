"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend as RLegend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#0891b2", "#db2777", "#65a30d"];

export function TrendLine({
  data,
}: {
  data: { label: string; score: number | null }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#2563eb"
          strokeWidth={2.5}
          dot={{ r: 4 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export type TrendPoint = {
  label?: string;
  month?: string;
  auto?: number | null;
  autoScore?: number | null;
  manager?: number | null;
  managerScore?: number | null;
  isLive?: boolean;
};

/** Auto (system) score vs. Manager (human) score, both out of 100, over time. */
export function DualTrendLine({
  data,
}: {
  data: TrendPoint[];
}) {
  const chartData = data.map((d) => ({
    ...d,
    label: d.label || d.month || "",
    month: d.month || d.label || "",
    auto: d.auto !== undefined ? d.auto : (d.autoScore !== undefined ? d.autoScore : null),
    manager: d.manager !== undefined ? d.manager : (d.managerScore !== undefined ? d.managerScore : null),
  }));

  const renderAutoDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || payload?.auto == null) return null;
    if (payload?.isLive) {
      return (
        <g key={`dot-live-${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r={6} fill="#ffffff" stroke="#2563eb" strokeWidth={2.5} />
          <circle cx={cx} cy={cy} r={2.5} fill="#2563eb" />
        </g>
      );
    }
    return <circle key={`dot-auto-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill="#2563eb" />;
  };

  const renderManagerDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || payload?.manager == null) return null;
    return <circle key={`dot-mgr-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill="#8b5cf6" />;
  };

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickMargin={6}
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} />
        <Tooltip
          formatter={(value: any, name: string) => {
            if (value === null || value === undefined) return ["—", name];
            return [`${Math.round(Number(value))}/100`, name];
          }}
          labelFormatter={(label: string, payload: any) => {
            const item = payload?.[0]?.payload;
            if (item?.isLive) {
              return `${item.month || label} (Live / In Progress — not finalized)`;
            }
            return item?.month || label;
          }}
          contentStyle={{
            backgroundColor: "#ffffff",
            borderColor: "#e2e8f0",
            borderRadius: "0.5rem",
            fontSize: "12px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
        />
        <RLegend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
        <Line
          type="monotone"
          dataKey="auto"
          name="Auto (system)"
          stroke="#2563eb"
          strokeWidth={2.5}
          dot={renderAutoDot}
          activeDot={{ r: 6 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="manager"
          name="Manager"
          stroke="#8b5cf6"
          strokeWidth={2.5}
          strokeDasharray="5 3"
          dot={renderManagerDot}
          activeDot={{ r: 6 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Donut({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (!data.length) {
    return <div className="grid h-[220px] place-items-center text-sm text-slate-400">No data yet</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ScoreBars({
  data,
}: {
  data: { name: string; score: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 12, fill: "#334155" }}
        />
        <Tooltip />
        <Bar dataKey="score" radius={[0, 6, 6, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.score >= 65 ? "#16a34a" : d.score >= 40 ? "#f59e0b" : "#ef4444"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Stacked horizontal bar showing the 3 increment components toward the max policy %. */
export function IncrementBar({
  kpi,
  behaviour,
  target,
  maxTotal,
}: {
  kpi: number;
  behaviour: number;
  target: number;
  maxTotal: number;
}) {
  const total = Math.round((kpi + behaviour + target) * 10) / 10;
  const seg = (v: number) => `${(v / maxTotal) * 100}%`;
  return (
    <div>
      <div className="flex h-8 w-full overflow-hidden rounded-lg bg-slate-100">
        <div className="flex items-center justify-center bg-blue-500 text-[10px] font-semibold text-white" style={{ width: seg(kpi) }} title={`Task/KPI: ${kpi}%`}>
          {kpi > 0.4 ? `${kpi}%` : ""}
        </div>
        <div className="flex items-center justify-center bg-emerald-500 text-[10px] font-semibold text-white" style={{ width: seg(behaviour) }} title={`Behaviour: ${behaviour}%`}>
          {behaviour > 0.4 ? `${behaviour}%` : ""}
        </div>
        <div className="flex items-center justify-center bg-violet-500 text-[10px] font-semibold text-white" style={{ width: seg(target) }} title={`Target vs actual: ${target}%`}>
          {target > 0.4 ? `${target}%` : ""}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Task/KPI (max 5%): <b>{kpi}%</b></span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Behaviour (max 5%): <b>{behaviour}%</b></span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> Target vs actual (max 10%): <b>{target}%</b></span>
        <span className="ml-auto font-semibold text-slate-800">Total: {total}% of {maxTotal}%</span>
      </div>
    </div>
  );
}

export function Legend({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ul className="mt-2 space-y-1">
      {data.map((d, i) => (
        <li key={d.name} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: COLORS[i % COLORS.length] }}
          />
          <span className="text-slate-600">{d.name}</span>
          <span className="ml-auto font-medium text-slate-800">{d.value}</span>
        </li>
      ))}
    </ul>
  );
}

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

/** Auto (system) score vs. Manager (human) score, both out of 100, over time. */
export function DualTrendLine({
  data,
}: {
  data: { label: string; auto: number | null; manager: number | null }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} />
        <Tooltip />
        <RLegend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="auto"
          name="Auto (system)"
          stroke="#2563eb"
          strokeWidth={2.5}
          dot={{ r: 4 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="manager"
          name="Manager"
          stroke="#8b5cf6"
          strokeWidth={2.5}
          strokeDasharray="5 3"
          dot={{ r: 4 }}
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

"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

interface MetricPoint {
  label: string
  value: number
}

interface Props {
  title: string
  data: MetricPoint[]
  format: (v: number) => string
  color: string
  lowerIsBetter?: boolean
  showTrend?: boolean   // default true; pass false to hide the % badge
  yoyMode?: boolean     // compare last two points (YoY) instead of first vs last
  note?: string
  description?: string
}

// "FY2024" → "FY24", "TTM" → "TTM"
function abbrevLabel(label: string): string {
  return label.startsWith("FY") ? "FY" + label.slice(-2) : label
}

export default function MetricChart({ title, data, format, color, lowerIsBetter, showTrend = true, yoyMode, note, description }: Props) {
  const chartData = data.map((p) => ({ ...p, label: abbrevLabel(p.label) }))
  const current = data.length > 0 ? data[data.length - 1].value : null

  // When TTM is the last point it overlaps ~9 months with the most recent FY,
  // producing a near-zero change. Skip that FY and compare TTM to the one before.
  const hasTTM = data.length > 0 && data[data.length - 1].label === "TTM"
  const baseline = yoyMode
    ? hasTTM
      ? (data.length > 2 ? data[data.length - 3].value : null)  // TTM vs FY 1 year prior
      : (data.length > 1 ? data[data.length - 2].value : null)  // latest FY vs previous FY
    : (data.length > 1 ? data[0].value : null)

  // Anchor Y axis at 0 when all values are non-negative so bars render
  // proportionally from the baseline. Use "auto" min only when negatives exist.
  const minVal = chartData.length > 0 ? Math.min(...chartData.map((d) => d.value)) : 0
  const yDomain: [number | "auto", "auto"] = [minVal < 0 ? "auto" : 0, "auto"]

  let changePct: number | null = null
  if (showTrend && current != null && baseline != null && baseline !== 0) {
    changePct = ((current - baseline) / Math.abs(baseline)) * 100
  }

  // For D/E and similar: going down is good, so invert the green/red logic
  const trendPositive = changePct != null
    ? (lowerIsBetter ? changePct <= 0 : changePct >= 0)
    : false
  const isUp = changePct != null && changePct >= 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight">
            {title}
          </p>
          {description && (
            <div className="relative group flex-shrink-0">
              <span className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-help text-xs leading-none">
                ⓘ
              </span>
              <div className="absolute z-20 hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-xl shadow-xl pointer-events-none">
                <p className="font-semibold mb-1 text-gray-200">{title}</p>
                <p className="text-gray-300 leading-relaxed">{description}</p>
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
              </div>
            </div>
          )}
        </div>
        {changePct != null && (
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 ml-1 ${
              trendPositive
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
            }`}
          >
            {isUp ? "▲" : "▼"} {Math.abs(changePct).toFixed(1)}% {yoyMode ? "YoY" : ""}
          </span>
        )}
      </div>

      <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-0.5">
        {current != null ? format(current) : "—"}
      </p>

      {note && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 leading-tight">{note}</p>
      )}

      {!note && <div className="mb-2" />}

      {chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickCount={3}
              tickFormatter={(v: number) => format(v)}
              width={44}
              domain={yDomain}
            />
            <Tooltip
              formatter={(v: number) => [format(v), title]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "white",
              }}
              labelStyle={{ color: "#6b7280" }}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={color}
                  fillOpacity={index === chartData.length - 1 ? 1 : 0.55}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-24 flex items-center justify-center text-xs text-gray-300 dark:text-gray-600">
          No trend data
        </div>
      )}
    </div>
  )
}

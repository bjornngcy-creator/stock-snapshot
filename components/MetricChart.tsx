"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
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
}

// "FY2024" → "FY24", "TTM" → "TTM"
function abbrevLabel(label: string): string {
  return label.startsWith("FY") ? "FY" + label.slice(-2) : label
}

export default function MetricChart({ title, data, format, color }: Props) {
  const chartData = data.map((p) => ({ ...p, label: abbrevLabel(p.label) }))
  const current = data.length > 0 ? data[data.length - 1].value : null
  const oldest = data.length > 1 ? data[0].value : null

  let changePct: number | null = null
  if (current != null && oldest != null && oldest !== 0) {
    changePct = ((current - oldest) / Math.abs(oldest)) * 100
  }
  const isUp = changePct != null && changePct >= 0

  // Safe gradient ID from title
  const gradId = `grad-${title.replace(/[^a-z0-9]/gi, "")}`

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4">
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight">
          {title}
        </p>
        {changePct != null && (
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 ml-1 ${
              isUp
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
            }`}
          >
            {isUp ? "▲" : "▼"} {Math.abs(changePct).toFixed(1)}%
          </span>
        )}
      </div>

      <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
        {current != null ? format(current) : "—"}
      </p>

      {chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={["auto", "auto"]} />
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
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-20 flex items-center justify-center text-xs text-gray-300 dark:text-gray-600">
          No trend data
        </div>
      )}
    </div>
  )
}

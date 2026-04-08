"use client"

import { useState } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { PricePoint } from "@/lib/financials"

interface Props {
  history1Y: PricePoint[]
  history5Y: PricePoint[]
  ticker: string
}

type View = "1Y" | "5Y"

function calcReturn(data: PricePoint[]): number | null {
  if (data.length < 2) return null
  const first = data[0].price
  const last = data[data.length - 1].price
  if (first === 0) return null
  return Math.round(((last - first) / first) * 1000) / 10
}

// Show ~6 evenly spaced tick labels
function buildTicks(data: PricePoint[], count = 6): string[] {
  if (data.length === 0) return []
  const step = Math.floor(data.length / (count - 1))
  const ticks: string[] = []
  for (let i = 0; i < data.length; i += step) ticks.push(data[i].date)
  if (ticks[ticks.length - 1] !== data[data.length - 1].date)
    ticks.push(data[data.length - 1].date)
  return ticks
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const { date, price } = payload[0].payload
  return (
    <div className="bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl">
      <p className="font-semibold">${price.toFixed(2)}</p>
      <p className="text-gray-400">{date}</p>
    </div>
  )
}

export default function PriceChart({ history1Y, history5Y, ticker }: Props) {
  const [view, setView] = useState<View>("1Y")
  const data = view === "1Y" ? history1Y : history5Y
  const ret = calcReturn(data)
  const positive = ret == null || ret >= 0
  const color = positive ? "#10b981" : "#f43f5e"
  const gradientId = `price-gradient-${ticker}-${view}`
  const ticks = buildTicks(data)

  if (data.length === 0) return null

  const minPrice = Math.min(...data.map((d) => d.price))
  const maxPrice = Math.max(...data.map((d) => d.price))
  const padding = (maxPrice - minPrice) * 0.08
  const yDomain = [minPrice - padding, maxPrice + padding]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-3 sm:p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Price Chart
          </h3>
          {ret != null && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              positive
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
            }`}>
              {positive ? "+" : ""}{ret}% {view}
            </span>
          )}
        </div>
        {/* Toggle */}
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "rgba(0,0,0,0.05)" }}>
          {(["1Y", "5Y"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-xs font-semibold px-3 py-1 rounded-md transition-all ${
                view === v
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            ticks={ticks}
            tick={{ fontSize: 9, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 9, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            tickCount={4}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

"use client"

import MetricChart from "./MetricChart"
import type { MetricPoint, SnapshotFinancials } from "@/lib/financials"

// ── Format helpers ────────────────────────────────────────────────────────────

const fmtBillions = (v: number) => `$${(v / 1e9).toFixed(1)}B`
const fmtDollars = (v: number) => `$${Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)}`
const fmtPct = (v: number) => `${v.toFixed(1)}%`
const fmtRatio = (v: number) => v.toFixed(2)
const fmtMarketCap = (v: number) =>
  v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : `$${(v / 1e9).toFixed(1)}B`

const METRICS: {
  key: keyof SnapshotFinancials["metrics"]
  title: string
  format: (v: number) => string
  color: string
}[] = [
  { key: "revenue",    title: "Revenue",           format: fmtBillions, color: "#3b82f6" },
  { key: "fcf",        title: "Free Cash Flow",    format: fmtBillions, color: "#10b981" },
  { key: "eps",        title: "EPS (Diluted)",     format: fmtDollars,  color: "#8b5cf6" },
  { key: "netMargin",  title: "Net Margin",        format: fmtPct,      color: "#f97316" },
  { key: "opMargin",   title: "Operating Margin",  format: fmtPct,      color: "#f59e0b" },
  { key: "debtEquity", title: "Debt / Equity",     format: fmtRatio,    color: "#f43f5e" },
  { key: "roe",        title: "Return on Equity",  format: fmtPct,      color: "#06b6d4" },
]

// ── Analysis types ────────────────────────────────────────────────────────────

interface AnalysisData {
  businessOverview: string
  strengths: string[]
  weaknesses: string[]
}

interface Props {
  financials: SnapshotFinancials
  analysis: AnalysisData | null
  analysisLoading: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SnapshotCard({ financials, analysis, analysisLoading }: Props) {
  return (
    <div className="space-y-5">

      {/* Company header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {financials.companyName}
              </h2>
              <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-mono px-2 py-0.5 rounded-lg">
                {financials.ticker}
              </span>
            </div>
            {(financials.sector || financials.industry) && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {[financials.sector, financials.industry].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          <div className="flex gap-6 text-right flex-wrap justify-end">
            {financials.currentPrice != null && (
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Price</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  ${financials.currentPrice.toFixed(2)}
                </p>
              </div>
            )}
            {financials.marketCap != null && (
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Market Cap</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {fmtMarketCap(financials.marketCap)}
                </p>
              </div>
            )}
            {financials.peRatio != null && (
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">P/E</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {financials.peRatio.toFixed(1)}x
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI analysis blocks */}
      {analysisLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {["Business Overview", "Strengths", "Weaknesses"].map((title) => (
            <div
              key={title}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 animate-pulse"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                {title}
              </p>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : analysis ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Business Overview */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
              Business Overview
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {analysis.businessOverview}
            </p>
          </div>

          {/* Strengths */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-500 mb-3">
              Strengths
            </h3>
            <ul className="space-y-3">
              {analysis.strengths.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="text-green-500 mt-0.5 shrink-0 font-bold">✓</span>
                  <span className="leading-snug">{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Weaknesses */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-500 mb-3">
              Weaknesses
            </h3>
            <ul className="space-y-3">
              {analysis.weaknesses.map((w, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="text-red-500 mt-0.5 shrink-0 font-bold">✗</span>
                  <span className="leading-snug">{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {METRICS.map(({ key, title, format, color }) => (
          <MetricChart
            key={key}
            title={title}
            data={financials.metrics[key]}
            format={format}
            color={color}
          />
        ))}
      </div>

    </div>
  )
}

"use client"

import { useState } from "react"
import MetricChart from "./MetricChart"
import MetricNA from "./MetricNA"
import PriceChart from "./PriceChart"
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
  lowerIsBetter?: boolean
  showTrend?: boolean
  yoyMode?: boolean
  description: string
}[] = [
  {
    key: "revenue",
    title: "Revenue",
    format: fmtBillions,
    color: "#3b82f6",
    yoyMode: true,
    description: "Total income from sales. The % badge shows year-over-year growth for the most recent period. Watch whether growth is accelerating or slowing.",
  },
  {
    key: "grossMargin",
    title: "Gross Margin",
    format: fmtPct,
    color: "#6366f1",
    yoyMode: true,
    description: "Revenue minus cost of goods sold, as a % of revenue. Shows pricing power and product profitability before overhead. Higher and stable is better — compression here is an early warning sign.",
  },
  {
    key: "fcf",
    title: "Free Cash Flow",
    format: fmtBillions,
    color: "#10b981",
    yoyMode: true,
    description: "Cash left after capital expenditures. Higher is better — it funds dividends, buybacks, and expansion. Negative FCF can signal heavy investment or cash burn.",
  },
  {
    key: "netIncome",
    title: "Net Income",
    format: fmtBillions,
    color: "#f97316",
    yoyMode: true,
    description: "Bottom-line profit after all expenses, taxes, and interest. Shows the actual dollars the company earned. Compare with FCF — large divergence can signal earnings quality issues.",
  },
  {
    key: "eps",
    title: "EPS (Diluted)",
    format: fmtDollars,
    color: "#8b5cf6",
    yoyMode: true,
    description: "Earnings per share, accounting for all dilutive securities. Higher and growing is better. Declining EPS may signal shrinking profitability or rising share count from dilution.",
  },
  {
    key: "opMargin",
    title: "Operating Margin",
    format: fmtPct,
    color: "#f59e0b",
    yoyMode: true,
    description: "% of revenue kept as operating profit, before interest and taxes. More comparable across companies than net margin as it excludes capital structure and tax differences.",
  },
  {
    key: "debtEquity",
    title: "Debt / Equity",
    format: fmtRatio,
    color: "#f43f5e",
    lowerIsBetter: true,
    showTrend: false,
    description: "Total debt relative to shareholders' equity. Lower means less financial risk. Very high D/E increases vulnerability to rising rates. Negative D/E often means equity was reduced by buybacks, not losses.",
  },
  {
    key: "roe",
    title: "Return on Equity",
    format: fmtPct,
    color: "#06b6d4",
    yoyMode: true,
    description: "Net income as a % of shareholders' equity. Higher means management generates more profit from invested capital. Very high ROE can be inflated by high debt reducing equity.",
  },
]

// ── Sector swap definitions ───────────────────────────────────────────────────

type SwapMetric = {
  key: keyof SnapshotFinancials["metrics"]
  title: string
  format: (v: number) => string
  color: string
  lowerIsBetter?: boolean
  showTrend?: boolean
  yoyMode?: boolean
  description: string
}

type SectorOverride = { type: "swap"; swapTo: SwapMetric }

const SWAP_METRICS: Record<string, SwapMetric> = {
  netInterestIncome: {
    key: "netInterestIncome",
    title: "Net Interest Income",
    format: fmtBillions,
    color: "#6366f1",
    yoyMode: true,
    description: "Interest earned on loans minus interest paid on deposits — the primary revenue driver for banks. Equivalent to gross profit for regular companies.",
  },
  efficiencyRatio: {
    key: "efficiencyRatio",
    title: "Efficiency Ratio",
    format: fmtPct,
    color: "#f59e0b",
    lowerIsBetter: true,
    yoyMode: true,
    description: "Non-interest expenses as a % of revenue. The standard cost metric for banks — lower is better. 50–60% is considered efficient; above 70% signals cost problems.",
  },
  priceToBook: {
    key: "priceToBook",
    title: "Price / Book",
    format: fmtRatio,
    color: "#10b981",
    showTrend: false,
    description: "Market price relative to book value per share. Banks typically trade at 1–2x book. Below 1x may signal concerns; above 2x reflects a premium franchise.",
  },
}

// Sector-driven swaps — applied by sector, not by whether data is empty
const SECTOR_OVERRIDES: Record<string, Partial<Record<keyof SnapshotFinancials["metrics"], SectorOverride>>> = {
  "Financial Services": {
    grossMargin: { type: "swap", swapTo: SWAP_METRICS.netInterestIncome },
    opMargin:    { type: "swap", swapTo: SWAP_METRICS.efficiencyRatio },
    fcf:         { type: "swap", swapTo: SWAP_METRICS.priceToBook },
  },
}

// ── Valuation signal ──────────────────────────────────────────────────────────

type ValuationLevel = "cheap" | "fair" | "expensive"

function valuationSignal(
  current: number | null,
  avg: number | null
): { level: ValuationLevel; pct: number; label: string } | null {
  if (current == null || avg == null || avg === 0) return null
  const pct = ((current - avg) / avg) * 100
  let level: ValuationLevel
  if (pct <= -15) level = "cheap"
  else if (pct >= 15) level = "expensive"
  else level = "fair"
  return { level, pct, label: pct > 0 ? `+${pct.toFixed(0)}%` : `${pct.toFixed(0)}%` }
}

const VALUATION_STYLES: Record<ValuationLevel, { badge: string; dot: string; text: string }> = {
  cheap:     { badge: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700", dot: "bg-emerald-500", text: "Below historical avg" },
  fair:      { badge: "bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600",                  dot: "bg-gray-400",    text: "Near historical avg" },
  expensive: { badge: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-700",                  dot: "bg-rose-500",    text: "Above historical avg" },
}

// ── Trend flags ───────────────────────────────────────────────────────────────

type FlagSeverity = "warn" | "info"
interface TrendFlag { message: string; severity: FlagSeverity }

function lastN(series: MetricPoint[], n: number): number[] {
  return series.slice(-n).map((p) => p.value).filter((v) => v != null && isFinite(v)) as number[]
}

function isConsistentlyDecreasing(vals: number[]): boolean {
  if (vals.length < 3) return false
  for (let i = 1; i < vals.length; i++) if (vals[i] >= vals[i - 1]) return false
  return true
}

function computeFlags(financials: SnapshotFinancials): TrendFlag[] {
  const flags: TrendFlag[] = []
  const { metrics, sector } = financials
  const isBank = sector === "Financial Services"

  // 1. Margin compression — 3 consecutive years down
  const marginKey = isBank ? "efficiencyRatio" : "grossMargin"
  const marginLabel = isBank ? "efficiency ratio" : "gross margin"
  const marginVals = lastN(metrics[marginKey], 4)
  if (isConsistentlyDecreasing(marginVals) && !isBank) {
    flags.push({ message: `Gross margin has compressed for ${marginVals.length - 1} consecutive years`, severity: "warn" })
  }
  if (isBank) {
    // For banks, efficiency ratio rising = bad (higher = worse)
    const effVals = lastN(metrics.efficiencyRatio, 4)
    if (effVals.length >= 3) {
      const isRising = effVals.every((v, i) => i === 0 || v > effVals[i - 1])
      if (isRising) flags.push({ message: `Efficiency ratio rising for ${effVals.length - 1} consecutive years (costs increasing)`, severity: "warn" })
    }
  }

  // 2. Operating margin compression (non-banks)
  if (!isBank) {
    const opVals = lastN(metrics.opMargin, 4)
    if (isConsistentlyDecreasing(opVals)) {
      flags.push({ message: `Operating margin declining for ${opVals.length - 1} consecutive years`, severity: "warn" })
    }
  }

  // 3. FCF divergence from net income (earnings quality)
  if (!isBank) {
    const fcfVals = lastN(metrics.fcf, 3)
    const niVals  = lastN(metrics.netIncome, 3)
    if (fcfVals.length >= 2 && niVals.length >= 2) {
      const recentFcf = fcfVals[fcfVals.length - 1]
      const recentNi  = niVals[niVals.length - 1]
      // FCF significantly below net income — potential accrual issue
      if (recentNi > 0 && recentFcf < recentNi * 0.5) {
        flags.push({ message: `Free cash flow is well below net income — earnings may be of lower quality`, severity: "warn" })
      }
      // FCF declining while net income growing
      const fcfTrend = fcfVals[fcfVals.length - 1] - fcfVals[0]
      const niTrend  = niVals[niVals.length - 1] - niVals[0]
      if (niTrend > 0 && fcfTrend < 0) {
        flags.push({ message: `Net income is growing but free cash flow is declining — watch earnings quality`, severity: "warn" })
      }
    }
  }

  // 4. Debt acceleration (D/E rising meaningfully)
  const deVals = lastN(metrics.debtEquity, 4)
  if (deVals.length >= 3 && deVals[0] > 0) {
    if (isConsistentlyDecreasing(deVals.map((v) => -v))) {
      // consistently increasing D/E
      const rise = deVals[deVals.length - 1] - deVals[0]
      if (rise > 0.5) {
        flags.push({ message: `Debt/Equity has risen by ${rise.toFixed(1)}x over the past ${deVals.length - 1} years`, severity: "warn" })
      }
    }
  }

  // 5. Revenue stalling (last 2 years < 3% growth)
  const revVals = lastN(metrics.revenue, 3)
  if (revVals.length >= 3) {
    const g1 = (revVals[1] - revVals[0]) / Math.abs(revVals[0])
    const g2 = (revVals[2] - revVals[1]) / Math.abs(revVals[1])
    if (g1 < 0.03 && g2 < 0.03 && revVals[0] > 0) {
      flags.push({ message: `Revenue growth has stalled — below 3% for 2 consecutive years`, severity: "info" })
    }
  }

  // 6. EPS declining
  const epsVals = lastN(metrics.eps, 4)
  if (isConsistentlyDecreasing(epsVals) && epsVals[epsVals.length - 1] > 0) {
    flags.push({ message: `EPS has declined for ${epsVals.length - 1} consecutive years`, severity: "warn" })
  }

  return flags
}

// ── Analysis types ────────────────────────────────────────────────────────────

interface AnalysisData {
  businessOverview: string
  strengths: string[]
  weaknesses: string[]
  news?: { title: string; publisher: string; url: string }[]
}

interface Props {
  financials: SnapshotFinancials
  analysis: AnalysisData | null
  analysisLoading: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

// Ticker-based logo URL — no domain required
function logoUrl(ticker: string) {
  return `https://assets.parqet.com/logos/symbol/${ticker}?format=png`
}

export default function SnapshotCard({ financials, analysis, analysisLoading }: Props) {
  const [logoError, setLogoError] = useState(false)

  const trailingSignal = valuationSignal(financials.peRatio, financials.peRatio5yrAvg)
  const forwardSignal  = valuationSignal(financials.forwardPE, financials.forwardPE5yrAvg)
  const flags = computeFlags(financials)

  return (
    <div className="space-y-5">

      {/* Company header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-3 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

          {/* Logo + name */}
          <div className="flex items-center gap-3">
            {!logoError && (
              <img
                src={logoUrl(financials.ticker)}
                alt={`${financials.companyName} logo`}
                onError={() => setLogoError(true)}
                className="w-12 h-12 rounded-xl object-contain bg-gray-50 dark:bg-gray-700 p-1 border border-gray-100 dark:border-gray-600 flex-shrink-0"
              />
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
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
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:justify-end items-start">
            {financials.currentPrice != null && (
              <div className="text-right">
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest">Price</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                  ${financials.currentPrice.toFixed(2)}
                </p>
                {financials.fiftyTwoWeekHigh != null && financials.fiftyTwoWeekLow != null && (
                  <div className="mt-1">
                    <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-0.5">
                      <span>${financials.fiftyTwoWeekLow.toFixed(2)}</span>
                      <span className="text-gray-300 dark:text-gray-600 mx-1">52w</span>
                      <span>${financials.fiftyTwoWeekHigh.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0,
                            ((financials.currentPrice - financials.fiftyTwoWeekLow) /
                             (financials.fiftyTwoWeekHigh - financials.fiftyTwoWeekLow)) * 100
                          ))}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {financials.marketCap != null && (
              <div className="text-right">
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest">{financials.isETF ? "AUM" : "Market Cap"}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {fmtMarketCap(financials.marketCap)}
                </p>
                {financials.earningsDate && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Earnings: <span className="font-medium text-gray-600 dark:text-gray-300">{financials.earningsDate}</span>
                  </p>
                )}
              </div>
            )}

            {/* P/E trailing — bordered card */}
            {financials.peRatio != null && (
              <div className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-right">
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">P/E (Trailing)</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{financials.peRatio.toFixed(1)}x</p>
                {financials.peRatio5yrAvg != null && (
                  <div className="mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-400 dark:text-gray-500">5yr avg: <span className="font-semibold text-gray-600 dark:text-gray-300">{financials.peRatio5yrAvg.toFixed(1)}x</span></p>
                  </div>
                )}
                {trailingSignal && (
                  <div className="mt-1.5 flex justify-end">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md border ${VALUATION_STYLES[trailingSignal.level].badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${VALUATION_STYLES[trailingSignal.level].dot}`} />
                      {trailingSignal.label} vs avg
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Forward P/E — bordered card */}
            {financials.forwardPE != null && (
              <div className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-right">
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Forward P/E</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{financials.forwardPE.toFixed(1)}x</p>
                {financials.forwardPE5yrAvg != null && (
                  <div className="mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-400 dark:text-gray-500">5yr avg: <span className="font-semibold text-gray-600 dark:text-gray-300">{financials.forwardPE5yrAvg.toFixed(1)}x</span></p>
                  </div>
                )}
                {forwardSignal && (
                  <div className="mt-1.5 flex justify-end">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md border ${VALUATION_STYLES[forwardSignal.level].badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${VALUATION_STYLES[forwardSignal.level].dot}`} />
                      {forwardSignal.label} vs avg
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 2. Business overview — full width, above price chart */}
      {analysisLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-3 sm:p-5 animate-pulse">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Business Overview</p>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          </div>
        </div>
      ) : analysis ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-3 sm:p-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">
            Business Overview
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {analysis.businessOverview}
          </p>
        </div>
      ) : null}

      {/* 3. Price chart */}
      <PriceChart
        history1Y={financials.priceHistory1Y}
        history5Y={financials.priceHistory5Y}
        ticker={financials.ticker}
      />

      {/* 4. Strengths + Weaknesses — two columns */}
      {analysisLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {["Strengths", "Weaknesses"].map((title) => (
            <div key={title} className="bg-white dark:bg-gray-800 rounded-2xl shadow p-3 sm:p-5 animate-pulse">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">{title}</p>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
              </div>
            </div>
          ))}
        </div>
      ) : analysis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-3 sm:p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-green-600 dark:text-green-500 mb-3">
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-3 sm:p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-red-600 dark:text-red-500 mb-3">
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

      {/* 5. ETF-specific sections */}
      {financials.isETF && (
        <div className="space-y-4">
          {/* ETF Key Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-3 sm:p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">ETF Overview</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {financials.aum != null && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">AUM</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{fmtMarketCap(financials.aum)}</p>
                </div>
              )}
              {financials.expenseRatio != null && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Expense Ratio</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{(financials.expenseRatio * 100).toFixed(2)}%</p>
                </div>
              )}
              {financials.dividendYield != null && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Dividend Yield</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{fmtPct(financials.dividendYield)}</p>
                </div>
              )}
              {financials.etfCategory && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Category</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{financials.etfCategory}</p>
                </div>
              )}
            </div>
          </div>

          {/* Annualized Performance */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-3 sm:p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Annualized Performance</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
              {([
                { label: "YTD",    value: financials.ytdReturn },
                { label: "1-Year", value: financials.oneYearReturn },
                { label: "3-Year", value: financials.threeYearReturn },
                { label: "5-Year", value: financials.fiveYearReturn },
                { label: "10-Year",value: financials.tenYearReturn },
              ] as { label: string; value: number | null }[]).map(({ label, value }) => (
                <div key={label} className="text-center border border-gray-100 dark:border-gray-700 rounded-xl p-3">
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">{label}</p>
                  {value != null ? (
                    <p className={`text-xl font-bold ${value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {value >= 0 ? "+" : ""}{value.toFixed(1)}%
                    </p>
                  ) : (
                    <p className="text-xl font-bold text-gray-300 dark:text-gray-600">—</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Top 10 Holdings */}
          {financials.topHoldings.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-3 sm:p-5">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Top 10 Holdings</h3>
              <div className="space-y-2">
                {financials.topHoldings.map((holding, i) => (
                  <div key={holding.symbol} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 dark:text-gray-500 w-4 shrink-0 text-right">{i + 1}</span>
                    <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-200 w-12 shrink-0">{holding.symbol}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300 flex-1 truncate">{holding.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, (holding.weight / (financials.topHoldings[0]?.weight || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 w-10 text-right">{holding.weight.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Metrics grid (stocks only) */}
      {!financials.isETF && <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {METRICS.map(({ key, title, format, color, lowerIsBetter, showTrend, yoyMode, description }) => {
          const sector = financials.sector ?? ""
          const override = (SECTOR_OVERRIDES[sector] ?? {})[key]

          // Sector-driven swap — always applies for this sector regardless of data
          if (override?.type === "swap") {
            const { key: swapKey, title: swapTitle, format: swapFmt, color: swapColor,
                    lowerIsBetter: swapLower, showTrend: swapTrend, description: swapDesc } = override.swapTo
            return (
              <MetricChart
                key={key}
                title={swapTitle}
                data={financials.metrics[swapKey]}
                format={swapFmt}
                color={swapColor}
                lowerIsBetter={swapLower}
                showTrend={swapTrend}
                description={swapDesc}
              />
            )
          }

          const data = financials.metrics[key]
          const currentVal = data.length > 0 ? data[data.length - 1].value : null
          const note =
            key === "debtEquity" && currentVal != null && currentVal < 0
              ? "Negative equity — likely due to buybacks"
              : undefined

          return (
            <MetricChart
              key={key}
              title={title}
              data={data}
              format={format}
              color={color}
              lowerIsBetter={lowerIsBetter}
              showTrend={showTrend}
              yoyMode={yoyMode}
              note={note}
              description={description}
            />
          )
        })}
      </div>}

      {/* 5. Trend flags (stocks only) */}
      {!financials.isETF && flags.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-3 sm:p-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">
            Trend Flags
          </h3>
          <div className="flex flex-wrap gap-2">
            {flags.map((flag, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 text-sm px-3 py-2 rounded-xl border ${
                  flag.severity === "warn"
                    ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300"
                    : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300"
                }`}
              >
                <span className="shrink-0 mt-0.5">{flag.severity === "warn" ? "⚠" : "ⓘ"}</span>
                <span>{flag.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Analyst consensus */}
      {financials.analystConsensus && (() => {
        const ac = financials.analystConsensus!
        const total = ac.buy + ac.hold + ac.sell
        const buyPct  = total > 0 ? (ac.buy  / total) * 100 : 0
        const holdPct = total > 0 ? (ac.hold / total) * 100 : 0
        const sellPct = total > 0 ? (ac.sell / total) * 100 : 0
        const upsidePositive = ac.upside != null && ac.upside >= 0
        return (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-3 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">
                  Analyst Consensus{ac.numberOfAnalysts != null && <span className="ml-1 font-normal normal-case">({ac.numberOfAnalysts} analysts)</span>}
                </h3>
                <div className="flex rounded-full overflow-hidden h-3 w-full mb-2">
                  {buyPct > 0  && <div className="bg-emerald-500" style={{ width: `${buyPct}%` }} />}
                  {holdPct > 0 && <div className="bg-amber-400"  style={{ width: `${holdPct}%` }} />}
                  {sellPct > 0 && <div className="bg-rose-500"   style={{ width: `${sellPct}%` }} />}
                </div>
                <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-300">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Buy <strong>{ac.buy}</strong></span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Hold <strong>{ac.hold}</strong></span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />Sell <strong>{ac.sell}</strong></span>
                </div>
              </div>
              {ac.targetPrice != null && (
                <div className="text-left sm:text-right">
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Price Target</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">${ac.targetPrice.toFixed(2)}</p>
                  {ac.upside != null && (
                    <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-lg ${
                      upsidePositive
                        ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                        : "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                    }`}>
                      {upsidePositive ? "+" : ""}{ac.upside.toFixed(1)}% upside
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* 7. News */}
      {analysis?.news && analysis.news.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-3 sm:p-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">
            Recent News
          </h3>
          <ul className="space-y-3">
            {analysis.news.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-gray-300 dark:text-gray-600 text-sm mt-0.5 shrink-0">→</span>
                <div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline leading-snug line-clamp-2"
                  >
                    {item.title}
                  </a>
                  {item.publisher && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.publisher}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  )
}

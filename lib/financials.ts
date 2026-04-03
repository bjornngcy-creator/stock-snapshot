import YahooFinance from "yahoo-finance2"

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false },
})

// ── StockAnalysis scraping helpers ─────────────────────────────────────────

function extractNumArray(html: string, field: string): (number | null)[] {
  const re = new RegExp(`(?:^|[,{])${field}:\\[([^\\]]+)\\]`)
  const m = html.match(re)
  if (!m) return []
  try {
    const fixed = m[1].replace(/(^|[,\[])(-?)\.(\d)/g, "$1$20.$3")
    return JSON.parse(`[${fixed}]`).map((v: any) =>
      v === null || v === undefined ? null : Number(v)
    )
  } catch {
    return []
  }
}

function extractStrArray(html: string, field: string): string[] {
  const re = new RegExp(`(?:^|[,{])${field}:\\[([^\\]]+)\\]`)
  const m = html.match(re)
  if (!m) return []
  try {
    return JSON.parse(`[${m[1]}]`)
  } catch {
    return []
  }
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
  })
  if (!res.ok) throw new Error(`StockAnalysis fetch failed: ${res.status} for ${url}`)
  return res.text()
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface MetricPoint {
  label: string
  value: number
}

export interface SnapshotFinancials {
  ticker: string
  companyName: string
  sector: string | null
  industry: string | null
  currentPrice: number | null
  marketCap: number | null
  peRatio: number | null
  metrics: {
    revenue: MetricPoint[]
    fcf: MetricPoint[]
    eps: MetricPoint[]
    netMargin: MetricPoint[]
    opMargin: MetricPoint[]
    debtEquity: MetricPoint[]
    roe: MetricPoint[]
  }
}

// ── Main function ──────────────────────────────────────────────────────────

export async function getSnapshotFinancials(ticker: string): Promise<SnapshotFinancials> {
  const t = ticker.toLowerCase()

  const [incHtml, bsHtml, summary, quote] = await Promise.all([
    fetchPage(`https://stockanalysis.com/stocks/${t}/financials/?p=annual`),
    fetchPage(`https://stockanalysis.com/stocks/${t}/financials/balance-sheet/?p=annual`),
    yf.quoteSummary(ticker, {
      modules: ["financialData", "summaryDetail", "summaryProfile", "defaultKeyStatistics"] as const,
    }),
    yf.quote(ticker),
  ])

  // ── Company info ──────────────────────────────────────────────────────
  const companyName =
    (quote as any).longName ?? (quote as any).shortName ?? ticker
  const sector = (summary as any).summaryProfile?.sector ?? null
  const industry = (summary as any).summaryProfile?.industry ?? null
  const currentPrice = (quote as any).regularMarketPrice ?? null
  const marketCap =
    (quote as any).marketCap ?? (summary as any).summaryDetail?.marketCap ?? null
  const peRatio = (summary as any).summaryDetail?.trailingPE ?? null

  // ── Parse income statement ────────────────────────────────────────────
  const datekeys = extractStrArray(incHtml, "datekey")
  const fiscalYears = extractStrArray(incHtml, "fiscalYear")
  const hasTTM = datekeys[0] === "TTM"

  const revVals = extractNumArray(incHtml, "revenue")
  const fcfVals = extractNumArray(incHtml, "fcf")
  const epsVals = extractNumArray(incHtml, "epsDiluted")
  const niVals = extractNumArray(incHtml, "netIncome")
  const oiVals = extractNumArray(incHtml, "operatingIncome")

  // ── Parse balance sheet ───────────────────────────────────────────────
  const bsDatekeys = extractStrArray(bsHtml, "datekey")
  const bsFiscalYears = extractStrArray(bsHtml, "fiscalYear")
  const bsHasTTM = bsDatekeys[0] === "TTM"

  // Try multiple field name variants for total equity
  let equityVals = extractNumArray(bsHtml, "balance_sheet_total_equity")
  if (equityVals.length === 0)
    equityVals = extractNumArray(bsHtml, "balance_sheet_stockholders_equity")
  if (equityVals.length === 0)
    equityVals = extractNumArray(bsHtml, "totalEquity")

  // Debt components (same formula as the main app)
  const stDebtVals = extractNumArray(bsHtml, "balance_sheet_short_term_debt")
  const cpLtVals = extractNumArray(bsHtml, "balance_sheet_current_portion_of_long_term_debt")
  const ltDebtVals = extractNumArray(bsHtml, "balance_sheet_long_term_debt")
  const leasesVals = extractNumArray(bsHtml, "longTermLeases")

  // ── Build annual series helper ────────────────────────────────────────
  // StockAnalysis: index 0 = TTM (if present), 1+ = annual newest-first
  function buildSeries(
    vals: (number | null)[],
    dates: string[],
    years: string[],
    hasT: boolean,
    n = 5
  ): MetricPoint[] {
    const annual: MetricPoint[] = []
    const start = hasT ? 1 : 0
    for (let i = start; i < dates.length; i++) {
      if (vals[i] != null) annual.push({ label: `FY${years[i]}`, value: vals[i]! })
    }
    annual.reverse() // oldest → newest
    const sliced = annual.slice(-n)
    if (hasT && vals[0] != null) sliced.push({ label: "TTM", value: vals[0]! })
    return sliced
  }

  // Build total debt series (sum of components per period)
  function buildDebtSeries(
    dates: string[],
    years: string[],
    hasT: boolean,
    n = 5
  ): MetricPoint[] {
    const annual: MetricPoint[] = []
    const start = hasT ? 1 : 0
    for (let i = start; i < dates.length; i++) {
      const total =
        (stDebtVals[i] ?? 0) +
        (cpLtVals[i] ?? 0) +
        (ltDebtVals[i] ?? 0) +
        (leasesVals[i] ?? 0)
      annual.push({ label: `FY${years[i]}`, value: total })
    }
    annual.reverse()
    return annual.slice(-n)
  }

  const revSeries = buildSeries(revVals, datekeys, fiscalYears, hasTTM)
  const fcfSeries = buildSeries(fcfVals, datekeys, fiscalYears, hasTTM)
  const epsSeries = buildSeries(epsVals, datekeys, fiscalYears, hasTTM)
  const niSeries = buildSeries(niVals, datekeys, fiscalYears, hasTTM)
  const oiSeries = buildSeries(oiVals, datekeys, fiscalYears, hasTTM)
  const equitySeries = buildSeries(equityVals, bsDatekeys, bsFiscalYears, bsHasTTM)
  const debtSeries = buildDebtSeries(bsDatekeys, bsFiscalYears, bsHasTTM)

  // ── Compute derived metrics by matching fiscal year labels ────────────
  function derivedRatio(
    numerator: MetricPoint[],
    denominator: MetricPoint[],
    scalePct = true
  ): MetricPoint[] {
    return numerator
      .map((n) => {
        const d = denominator.find((d) => d.label === n.label)
        if (!d || d.value === 0) return null
        const raw = n.value / d.value
        const val = scalePct ? Math.round(raw * 1000) / 10 : Math.round(raw * 100) / 100
        return { label: n.label, value: val }
      })
      .filter(Boolean) as MetricPoint[]
  }

  // Net margin = net income / revenue × 100
  const netMarginSeries = derivedRatio(niSeries, revSeries, true)

  // Operating margin = operating income / revenue × 100
  const opMarginSeries = derivedRatio(oiSeries, revSeries, true)

  // Debt/Equity = total debt / equity (ratio)
  const debtEquitySeries = equitySeries
    .map((eq) => {
      const debt = debtSeries.find((d) => d.label === eq.label)
      if (!debt || eq.value === 0) return null
      return { label: eq.label, value: Math.round((debt.value / eq.value) * 100) / 100 }
    })
    .filter(Boolean) as MetricPoint[]

  // ROE = net income / equity × 100
  const roeSeries = derivedRatio(niSeries, equitySeries, true)

  return {
    ticker,
    companyName,
    sector,
    industry,
    currentPrice,
    marketCap,
    peRatio,
    metrics: {
      revenue: revSeries,
      fcf: fcfSeries,
      eps: epsSeries,
      netMargin: netMarginSeries,
      opMargin: opMarginSeries,
      debtEquity: debtEquitySeries,
      roe: roeSeries,
    },
  }
}

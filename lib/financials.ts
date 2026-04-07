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

export interface AnalystConsensus {
  buy: number
  hold: number
  sell: number
  targetPrice: number | null
  upside: number | null
  numberOfAnalysts: number | null
}

export interface SnapshotFinancials {
  ticker: string
  companyName: string
  sector: string | null
  industry: string | null
  currentPrice: number | null
  marketCap: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  earningsDate: string | null
  analystConsensus: AnalystConsensus | null
  peRatio: number | null
  peRatio5yrAvg: number | null
  forwardPE: number | null
  forwardPE5yrAvg: number | null
  metrics: {
    revenue: MetricPoint[]
    grossMargin: MetricPoint[]
    fcf: MetricPoint[]
    netIncome: MetricPoint[]
    eps: MetricPoint[]
    opMargin: MetricPoint[]
    debtEquity: MetricPoint[]
    roe: MetricPoint[]
    roa: MetricPoint[]
    // Financial Services replacements
    netInterestIncome: MetricPoint[]
    efficiencyRatio: MetricPoint[]
    priceToBook: MetricPoint[]
  }
}

// ── Main function ──────────────────────────────────────────────────────────

export async function getSnapshotFinancials(ticker: string): Promise<SnapshotFinancials> {
  // StockAnalysis uses dot notation for class-B shares (BRK-B → brk.b)
  const t = ticker.toLowerCase().replace(/-([a-z])$/, ".$1")

  const [incHtml, bsHtml, valHtml, summary, quote] = await Promise.all([
    fetchPage(`https://stockanalysis.com/stocks/${t}/financials/?p=annual`),
    fetchPage(`https://stockanalysis.com/stocks/${t}/financials/balance-sheet/?p=annual`),
    fetchPage(`https://stockanalysis.com/stocks/${t}/financials/ratios/?p=annual`).catch(() =>
      fetchPage(`https://stockanalysis.com/stocks/${t}/financials/valuation/`).catch(() => "")
    ),
    yf.quoteSummary(ticker, {
      modules: ["financialData", "summaryDetail", "summaryProfile", "defaultKeyStatistics", "recommendationTrend", "calendarEvents"] as const,
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
  const fiftyTwoWeekHigh = (quote as any).fiftyTwoWeekHigh ?? null
  const fiftyTwoWeekLow  = (quote as any).fiftyTwoWeekLow  ?? null
  const peRatio = (summary as any).summaryDetail?.trailingPE ?? null

  // ── Earnings date ─────────────────────────────────────────────────────
  let earningsDate: string | null = null
  try {
    const earningsDates: Date[] = (summary as any).calendarEvents?.earnings?.earningsDate ?? []
    const upcoming = earningsDates.find((d) => new Date(d) >= new Date())
    if (upcoming) {
      earningsDate = new Date(upcoming).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    }
  } catch { /* leave null */ }

  // ── Analyst consensus ────────────────────────────────────────────────
  let analystConsensus: AnalystConsensus | null = null
  try {
    const trend = (summary as any).recommendationTrend?.trend ?? []
    const current = trend.find((t: any) => t.period === "0m") ?? trend[0]
    if (current) {
      const buy  = (current.strongBuy ?? 0) + (current.buy ?? 0)
      const hold = current.hold ?? 0
      const sell = (current.sell ?? 0) + (current.strongSell ?? 0)
      const targetPrice = (summary as any).financialData?.targetMeanPrice ?? null
      const upside =
        targetPrice != null && currentPrice != null && currentPrice > 0
          ? Math.round(((targetPrice - currentPrice) / currentPrice) * 1000) / 10
          : null
      const numberOfAnalysts = (summary as any).financialData?.numberOfAnalystOpinions ?? null
      if (buy + hold + sell > 0) {
        analystConsensus = { buy, hold, sell, targetPrice, upside, numberOfAnalysts }
      }
    }
  } catch { /* leave null */ }

  // ── Parse income statement ────────────────────────────────────────────
  const datekeys = extractStrArray(incHtml, "datekey")
  const fiscalYears = extractStrArray(incHtml, "fiscalYear")
  const hasTTM = datekeys[0] === "TTM"

  const revVals    = extractNumArray(incHtml, "revenue")
  const gpVals     = extractNumArray(incHtml, "grossProfit")
  const fcfVals    = extractNumArray(incHtml, "fcf")
  const epsVals    = extractNumArray(incHtml, "epsDiluted")
  const niVals     = extractNumArray(incHtml, "netIncome")
  const oiVals     = extractNumArray(incHtml, "operatingIncome")
  // Financial Services specific
  const netIntIncVals  = extractNumArray(incHtml, "netInterestIncomeBank")
  const nonIntExpVals  = extractNumArray(incHtml, "income_statement_total_non_interest_expense")

  // ── Parse balance sheet ───────────────────────────────────────────────
  const bsDatekeys = extractStrArray(bsHtml, "datekey")
  const bsFiscalYears = extractStrArray(bsHtml, "fiscalYear")
  const bsHasTTM = bsDatekeys[0] === "TTM"

  // Try multiple field name variants for total equity
  let equityVals = extractNumArray(bsHtml, "totalEquity")
  if (equityVals.length === 0)
    equityVals = extractNumArray(bsHtml, "equity")
  if (equityVals.length === 0)
    equityVals = extractNumArray(bsHtml, "shEquity")
  if (equityVals.length === 0)
    equityVals = extractNumArray(bsHtml, "shareholdersEquity")
  if (equityVals.length === 0)
    equityVals = extractNumArray(bsHtml, "commonEquity")
  if (equityVals.length === 0)
    equityVals = extractNumArray(bsHtml, "balance_sheet_total_equity")
  if (equityVals.length === 0)
    equityVals = extractNumArray(bsHtml, "balance_sheet_stockholders_equity")

  // Try total debt directly first, then fall back to summing components
  let directDebtVals = extractNumArray(bsHtml, "totalDebt")
  if (directDebtVals.length === 0)
    directDebtVals = extractNumArray(bsHtml, "balance_sheet_total_debt")
  if (directDebtVals.length === 0)
    directDebtVals = extractNumArray(bsHtml, "totalBorrowings")
  if (directDebtVals.length === 0)
    directDebtVals = extractNumArray(bsHtml, "debt")

  const stDebtVals = extractNumArray(bsHtml, "shortTermDebt")
  const cpLtVals =
    extractNumArray(bsHtml, "currentLongTermDebt").length > 0
      ? extractNumArray(bsHtml, "currentLongTermDebt")
      : extractNumArray(bsHtml, "currentPortionOfLongTermDebt")
  const ltDebtVals =
    extractNumArray(bsHtml, "longTermDebt").length > 0
      ? extractNumArray(bsHtml, "longTermDebt")
      : extractNumArray(bsHtml, "totalLongTermDebt")
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

  // Build total debt series — prefer direct totalDebt field, fall back to components
  function buildDebtSeries(
    dates: string[],
    years: string[],
    hasT: boolean,
    n = 5
  ): MetricPoint[] {
    const useDirectDebt = directDebtVals.length > 0
    const hasComponents =
      stDebtVals.length > 0 || cpLtVals.length > 0 || ltDebtVals.length > 0
    if (!useDirectDebt && !hasComponents) return []

    const annual: MetricPoint[] = []
    const start = hasT ? 1 : 0
    for (let i = start; i < dates.length; i++) {
      const total = useDirectDebt
        ? (directDebtVals[i] ?? 0)
        : (stDebtVals[i] ?? 0) + (cpLtVals[i] ?? 0) + (ltDebtVals[i] ?? 0) + (leasesVals[i] ?? 0)
      annual.push({ label: `FY${years[i]}`, value: total })
    }
    annual.reverse()
    return annual.slice(-n)
  }

  const revSeries  = buildSeries(revVals, datekeys, fiscalYears, hasTTM)
  const gpSeries   = buildSeries(gpVals,  datekeys, fiscalYears, hasTTM)
  const fcfSeries  = buildSeries(fcfVals, datekeys, fiscalYears, hasTTM)
  const epsSeries  = buildSeries(epsVals, datekeys, fiscalYears, hasTTM)
  const niSeries   = buildSeries(niVals,  datekeys, fiscalYears, hasTTM)
  const oiSeries   = buildSeries(oiVals,  datekeys, fiscalYears, hasTTM)
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

  // Gross margin = gross profit / revenue × 100
  const grossMarginSeries = derivedRatio(gpSeries, revSeries, true)

  // Financial Services metrics
  const netIntIncSeries    = buildSeries(netIntIncVals, datekeys, fiscalYears, hasTTM)
  const nonIntExpSeries    = buildSeries(nonIntExpVals, datekeys, fiscalYears, hasTTM)
  // Efficiency ratio = non-interest expense / revenue × 100 (lower = better)
  const efficiencyRatioSeries = derivedRatio(nonIntExpSeries, revSeries, true)

  // ── P/E 5-year averages from valuation page ───────────────────────────
  const valDatekeys    = extractStrArray(valHtml, "datekey")
  const valFiscalYears = extractStrArray(valHtml, "fiscalYear")
  const valHasTTM      = valDatekeys[0] === "TTM"
  const roaVals  = extractNumArray(valHtml, "roa")
  const pbVals   = extractNumArray(valHtml, "pb")
  const roaSeries = buildSeries(roaVals, valDatekeys, valFiscalYears, valHasTTM)
  const pbSeries  = buildSeries(pbVals,  valDatekeys, valFiscalYears, valHasTTM)

  let peHistVals = extractNumArray(valHtml, "pe")
  if (peHistVals.length === 0) peHistVals = extractNumArray(valHtml, "peRatio")
  if (peHistVals.length === 0) peHistVals = extractNumArray(valHtml, "trailingPe")

  const fwdPeHistVals = extractNumArray(valHtml, "peForward")

  function avg5yr(vals: (number | null)[], hasT: boolean): number | null {
    const start = hasT ? 1 : 0
    const annual = vals
      .slice(start, start + 5)
      .filter((v): v is number => v != null && v > 0)
    if (annual.length === 0) return null
    return Math.round((annual.reduce((a, b) => a + b, 0) / annual.length) * 10) / 10
  }

  const peRatio5yrAvg = avg5yr(peHistVals, valHasTTM)
  const forwardPE = (summary as any).defaultKeyStatistics?.forwardPE ?? null
  const forwardPE5yrAvg = avg5yr(fwdPeHistVals, valHasTTM)

  return {
    ticker,
    companyName,
    sector,
    industry,
    currentPrice,
    marketCap,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    earningsDate,
    analystConsensus,
    peRatio,
    peRatio5yrAvg,
    forwardPE,
    forwardPE5yrAvg,
    metrics: {
      revenue: revSeries,
      grossMargin: grossMarginSeries,
      fcf: fcfSeries,
      netIncome: niSeries,
      eps: epsSeries,
      opMargin: opMarginSeries,
      debtEquity: debtEquitySeries,
      roe: roeSeries,
      roa: roaSeries,
      netInterestIncome: netIntIncSeries,
      efficiencyRatio: efficiencyRatioSeries,
      priceToBook: pbSeries,
    },
  }
}

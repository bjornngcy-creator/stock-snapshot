import YahooFinance from "yahoo-finance2"

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  validation: { logErrors: false },
})

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

export interface PricePoint {
  date: string
  price: number
}

export interface EtfHolding {
  symbol: string
  name: string
  weight: number
}

export interface EtfSectorWeight {
  sector: string
  weight: number
}

export interface SnapshotFinancials {
  ticker: string
  isETF: boolean
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
  priceHistory1Y: PricePoint[]
  priceHistory5Y: PricePoint[]
  // ETF-specific (null/[] for stocks)
  aum: number | null
  expenseRatio: number | null
  etfCategory: string | null
  dividendYield: number | null
  ytdReturn: number | null
  oneYearReturn: number | null
  threeYearReturn: number | null
  fiveYearReturn: number | null
  tenYearReturn: number | null
  topHoldings: EtfHolding[]
  sectorWeights: EtfSectorWeight[]
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
    netInterestIncome: MetricPoint[]
    efficiencyRatio: MetricPoint[]
    priceToBook: MetricPoint[]
  }
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function buildPriceSeries(rows: any[]): PricePoint[] {
  return rows
    .filter((r) => r.adjClose != null || r.close != null)
    .map((r) => ({
      date: new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      price: Math.round((r.adjClose ?? r.close) * 100) / 100,
    }))
}

// Build a MetricPoint series from fundamentalsTimeSeries annual data (oldest-first)
function ftsSeries(stmts: any[], getValue: (s: any) => number | null | undefined, n = 5): MetricPoint[] {
  return stmts
    .slice(-n)
    .map((s: any) => {
      const val = getValue(s)
      if (val == null || !isFinite(val as number)) return null
      const year = new Date(s.date).getFullYear()
      return { label: `FY${year}`, value: val as number }
    })
    .filter((x): x is MetricPoint => x !== null)
}

function derivedRatio(numerator: MetricPoint[], denominator: MetricPoint[], scalePct = true): MetricPoint[] {
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

const EMPTY_METRICS = {
  revenue: [], grossMargin: [], fcf: [], netIncome: [], eps: [],
  opMargin: [], debtEquity: [], roe: [], roa: [],
  netInterestIncome: [], efficiencyRatio: [], priceToBook: [],
}

// ── Main function ──────────────────────────────────────────────────────────

export async function getSnapshotFinancials(ticker: string): Promise<SnapshotFinancials> {
  const now = new Date()
  const date1Y = new Date(now); date1Y.setFullYear(now.getFullYear() - 1)
  const date5Y = new Date(now); date5Y.setFullYear(now.getFullYear() - 5)

  // Detect ETF vs stock
  const earlyQuote = await yf.quote(ticker)
  const isETF = (earlyQuote as any).quoteType === "ETF"

  // ── ETF path ───────────────────────────────────────────────────────────────
  if (isETF) {
    const date10Y = new Date(now); date10Y.setFullYear(now.getFullYear() - 10)
    const [etfSummary, hist1Y, hist5Y, hist10Y] = await Promise.all([
      yf.quoteSummary(ticker, {
        modules: ["summaryDetail", "defaultKeyStatistics", "fundProfile", "topHoldings"] as any,
      }),
      yf.historical(ticker, { period1: date1Y, period2: now, interval: "1d" }).catch(() => []),
      yf.historical(ticker, { period1: date5Y, period2: now, interval: "1wk" }).catch(() => []),
      yf.historical(ticker, { period1: date10Y, period2: now, interval: "1wk" }).catch(() => []),
    ])

    const companyName = (earlyQuote as any).longName ?? (earlyQuote as any).shortName ?? ticker
    const currentPrice = (earlyQuote as any).regularMarketPrice ?? null
    const fiftyTwoWeekHigh = (earlyQuote as any).fiftyTwoWeekHigh ?? null
    const fiftyTwoWeekLow = (earlyQuote as any).fiftyTwoWeekLow ?? null

    const sd = (etfSummary as any).summaryDetail ?? {}
    const dks = (etfSummary as any).defaultKeyStatistics ?? {}
    const fp = (etfSummary as any).fundProfile ?? {}
    const th = (etfSummary as any).topHoldings ?? {}

    const aum = sd.totalAssets ?? dks.totalAssets ?? null
    const expenseRatio = dks.annualReportExpenseRatio ?? null
    const etfCategory = fp.categoryName ?? null
    const pct = (v: number | null | undefined) => v != null ? Math.round(v * 1000) / 10 : null
    const dividendYield = pct(sd.yield ?? sd.trailingAnnualDividendYield)
    const ytdReturn = pct(dks.ytdReturn)
    const threeYearReturn = pct(dks.threeYearAverageReturn)
    const fiveYearReturn = pct(dks.fiveYearAverageReturn)

    // Compute 1-year and 10-year from adjClose history (total return, dividends included via price adjustment)
    const cagrFromHistory = (rows: any[], years: number): number | null => {
      const prices = buildPriceSeries(rows)
      if (prices.length < 2) return null
      const start = prices[0].price
      const end = prices[prices.length - 1].price
      if (start <= 0) return null
      const cagr = (Math.pow(end / start, 1 / years) - 1) * 100
      return Math.round(cagr * 10) / 10
    }
    const oneYearReturn = cagrFromHistory(hist1Y as any[], 1)
    const tenYearReturn = cagrFromHistory(hist10Y as any[], 10)

    const topHoldings: EtfHolding[] = (th.holdings ?? []).slice(0, 10).map((h: any) => ({
      symbol: h.symbol ?? "",
      name: h.holdingName ?? h.symbol ?? "",
      weight: Math.round((h.holdingPercent ?? 0) * 1000) / 10,
    }))

    const sectorWeights: EtfSectorWeight[] = (th.sectorWeightings ?? [])
      .flatMap((s: any) =>
        Object.entries(s).map(([sector, weight]) => ({
          sector,
          weight: Math.round((weight as number) * 1000) / 10,
        }))
      )
      .filter((s: any) => s.weight > 0)
      .sort((a: any, b: any) => b.weight - a.weight)

    return {
      ticker,
      isETF: true,
      companyName,
      sector: etfCategory,
      industry: null,
      currentPrice,
      marketCap: aum,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      earningsDate: null,
      analystConsensus: null,
      peRatio: null,
      peRatio5yrAvg: null,
      forwardPE: null,
      forwardPE5yrAvg: null,
      priceHistory1Y: buildPriceSeries(hist1Y as any[]),
      priceHistory5Y: buildPriceSeries(hist5Y as any[]),
      aum,
      expenseRatio,
      etfCategory,
      dividendYield,
      ytdReturn,
      oneYearReturn,
      threeYearReturn,
      fiveYearReturn,
      tenYearReturn,
      topHoldings,
      sectorWeights,
      metrics: EMPTY_METRICS,
    }
  }

  // ── Stock path — all Yahoo Finance ────────────────────────────────────────
  const quote = earlyQuote
  const date6Y = new Date(now); date6Y.setFullYear(now.getFullYear() - 6)
  const [summary, hist1Y, hist5Y, finData, cfData, bsData] = await Promise.all([
    yf.quoteSummary(ticker, {
      modules: [
        "financialData", "summaryDetail", "summaryProfile", "defaultKeyStatistics",
        "recommendationTrend", "calendarEvents",
      ] as any,
    }),
    yf.historical(ticker, { period1: date1Y, period2: now, interval: "1d" }).catch(() => []),
    yf.historical(ticker, { period1: date5Y, period2: now, interval: "1wk" }).catch(() => []),
    (yf as any).fundamentalsTimeSeries(ticker, { period1: date6Y, period2: now, module: "financials", type: "annual" }).catch(() => []),
    (yf as any).fundamentalsTimeSeries(ticker, { period1: date6Y, period2: now, module: "cash-flow", type: "annual" }).catch(() => []),
    (yf as any).fundamentalsTimeSeries(ticker, { period1: date6Y, period2: now, module: "balance-sheet", type: "annual" }).catch(() => []),
  ])

  // ── Company info ──────────────────────────────────────────────────────────
  const companyName = (quote as any).longName ?? (quote as any).shortName ?? ticker
  const sector = (summary as any).summaryProfile?.sector ?? null
  const industry = (summary as any).summaryProfile?.industry ?? null
  const currentPrice = (quote as any).regularMarketPrice ?? null
  const marketCap = (quote as any).marketCap ?? (summary as any).summaryDetail?.marketCap ?? null
  const fiftyTwoWeekHigh = (quote as any).fiftyTwoWeekHigh ?? null
  const fiftyTwoWeekLow = (quote as any).fiftyTwoWeekLow ?? null
  const peRatio = (summary as any).summaryDetail?.trailingPE ?? null
  const forwardPE = (summary as any).defaultKeyStatistics?.forwardPE ?? null

  // ── Earnings date ─────────────────────────────────────────────────────────
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

  // ── Analyst consensus ─────────────────────────────────────────────────────
  let analystConsensus: AnalystConsensus | null = null
  try {
    const trend = (summary as any).recommendationTrend?.trend ?? []
    const current = trend.find((t: any) => t.period === "0m") ?? trend[0]
    if (current) {
      const buy = (current.strongBuy ?? 0) + (current.buy ?? 0)
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

  // ── Financial statements (via fundamentalsTimeSeries annual) ─────────────
  const revSeries    = ftsSeries(finData as any[], (s) => s.totalRevenue)
  const gpSeries     = ftsSeries(finData as any[], (s) => s.grossProfit)
  const niSeries     = ftsSeries(finData as any[], (s) => s.netIncome)
  const oiSeries     = ftsSeries(finData as any[], (s) => s.operatingIncome ?? s.EBIT)
  const epsSeries    = ftsSeries(finData as any[], (s) => s.dilutedEPS)
  const equitySeries = ftsSeries(bsData as any[],  (s) => s.stockholdersEquity ?? s.commonStockEquity)
  const assetsSeries = ftsSeries(bsData as any[],  (s) => s.totalAssets)
  const debtSeries   = ftsSeries(bsData as any[],  (s) => s.totalDebt)
  const fcfSeries    = ftsSeries(cfData as any[],  (s) => {
    if (s.freeCashFlow != null) return s.freeCashFlow
    const op = s.operatingCashFlow ?? s.cashFlowFromContinuingOperatingActivities
    const cap = s.capitalExpenditure
    if (op != null && cap != null) return op + cap
    return null
  })

  // ── Derived metrics ───────────────────────────────────────────────────────
  const grossMarginSeries  = derivedRatio(gpSeries, revSeries, true)
  const opMarginSeries     = derivedRatio(oiSeries, revSeries, true)
  const roeSeries          = derivedRatio(niSeries, equitySeries, true)
  const roaSeries          = derivedRatio(niSeries, assetsSeries, true)

  const debtEquitySeries = equitySeries
    .map((eq) => {
      const debt = debtSeries.find((d) => d.label === eq.label)
      if (!debt || eq.value === 0) return null
      return { label: eq.label, value: Math.round((debt.value / eq.value) * 100) / 100 }
    })
    .filter(Boolean) as MetricPoint[]

  // ── Price history ─────────────────────────────────────────────────────────
  const priceHistory1Y = buildPriceSeries(hist1Y as any[])
  const priceHistory5Y = buildPriceSeries(hist5Y as any[])

  return {
    ticker,
    isETF: false,
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
    peRatio5yrAvg: null, // not available from Yahoo Finance
    forwardPE,
    forwardPE5yrAvg: null, // not available from Yahoo Finance
    priceHistory1Y,
    priceHistory5Y,
    aum: null,
    expenseRatio: null,
    etfCategory: null,
    dividendYield: null,
    ytdReturn: null,
    oneYearReturn: null,
    threeYearReturn: null,
    fiveYearReturn: null,
    tenYearReturn: null,
    topHoldings: [],
    sectorWeights: [],
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
      netInterestIncome: [],
      efficiencyRatio: [],
      priceToBook: [],
    },
  }
}

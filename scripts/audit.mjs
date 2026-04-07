const TICKERS = [
  "AAPL","MSFT","NVDA","GOOGL","AMZN",
  "META","TSLA","JPM","JNJ","V",
  "WMT","BRK-B","XOM","UNH","NFLX",
  "AMD","BA","DIS","KO","INTC"
]

async function check(ticker) {
  const res = await fetch(`http://localhost:3000/api/financials?ticker=${ticker}`)
  const d = await res.json()
  if (d.error) return { ticker, issues: [`FETCH ERROR: ${d.error}`] }

  const m = d.metrics
  const issues = []

  if (d.peRatio == null)         issues.push("no trailingPE")
  if (d.peRatio5yrAvg == null)   issues.push("no PE 5yr avg")
  if (d.forwardPE == null)       issues.push("no forwardPE")
  if (d.forwardPE5yrAvg == null) issues.push("no fwdPE 5yr avg")

  for (const key of ["revenue","grossMargin","fcf","netIncome","eps","opMargin","debtEquity","roe"]) {
    const pts = m[key]
    if (!pts || pts.length === 0)          issues.push(`${key}: empty`)
    else if (pts.every(p => p.value === 0)) issues.push(`${key}: all-zero`)
    else if (pts.length < 3)               issues.push(`${key}: only ${pts.length} point(s)`)
  }

  return { ticker, issues }
}

const results = await Promise.all(TICKERS.map(check))

let anyIssues = false
for (const { ticker, issues } of results) {
  const pad = ticker.padEnd(6)
  if (issues.length === 0) {
    console.log(`${pad} ✓ OK`)
  } else {
    anyIssues = true
    console.log(`${pad} ✗ ${issues.join(" | ")}`)
  }
}
if (!anyIssues) console.log("\nAll 20 companies passed with no issues.")

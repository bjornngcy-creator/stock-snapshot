"use client"

import { useState, useEffect } from "react"
import SnapshotCard from "@/components/SnapshotCard"
import HistoryDrawer, {
  type HistoryEntry,
  loadHistory,
  saveToHistory,
  deleteFromHistory,
} from "@/components/HistoryDrawer"
import type { SnapshotFinancials } from "@/lib/financials"

interface AnalysisData {
  businessOverview: string
  strengths: string[]
  weaknesses: string[]
  news?: { title: string; publisher: string; url: string }[]
}

export default function Home() {
  const [ticker, setTicker] = useState("")
  const [loading, setLoading] = useState<"idle" | "financials" | "analysis" | "done">("idle")
  const [financials, setFinancials] = useState<SnapshotFinancials | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [error, setError] = useState("")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setHistory(loadHistory())
    const saved = localStorage.getItem("theme")
    const dark = saved === "dark"
    setIsDark(dark)
    document.documentElement.classList.toggle("dark", dark)
  }, [])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("theme", next ? "dark" : "light")
  }

  function refreshHistory() {
    setHistory(loadHistory())
  }

  const isLoading = loading === "financials" || loading === "analysis"

  async function handleAnalyze() {
    if (!ticker.trim() || isLoading) return
    setError("")
    setFinancials(null)
    setAnalysis(null)

    const t = ticker.trim().toUpperCase()

    try {
      setLoading("financials")
      const finRes = await fetch(`/api/financials?ticker=${t}`)
      const fin: SnapshotFinancials = await finRes.json()
      if ("error" in fin) throw new Error((fin as any).error)
      setFinancials(fin)

      setLoading("analysis")
      const analRes = await fetch(
        `/api/analysis?ticker=${t}&name=${encodeURIComponent(fin.companyName)}`
      )
      const anal: AnalysisData = await analRes.json()
      if ("error" in anal) throw new Error((anal as any).error)
      setAnalysis(anal)

      const entry: HistoryEntry = {
        id: Date.now().toString(),
        ticker: t,
        companyName: fin.companyName,
        date: new Date().toLocaleDateString("en-GB", {
          day: "numeric", month: "short", year: "numeric",
        }),
        financials: fin,
        analysis: anal,
      }
      saveToHistory(entry)
      refreshHistory()

      setLoading("done")
    } catch (err: any) {
      setError(err.message)
      setLoading("idle")
    }
  }

  function loadFromHistory(entry: HistoryEntry) {
    setTicker(entry.ticker)
    setFinancials(entry.financials)
    setAnalysis(entry.analysis)
    setLoading("done")
    setError("")
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-6 transition-colors">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="relative text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Stock Health Checker</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Is this stock worth a closer look?</p>
          <button
            onClick={toggleTheme}
            className="absolute right-0 top-0 w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        {/* Search row */}
        <div className="flex gap-3 mb-8 justify-center items-center">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder="Enter ticker (e.g. AAPL)"
            className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm w-64 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500"
          />
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-800 text-white font-medium px-6 py-3 rounded-xl text-sm transition-colors"
          >
            {loading === "financials"
              ? "Fetching data..."
              : loading === "analysis"
              ? "Analysing..."
              : "Analyse"}
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium px-4 py-3 rounded-xl text-sm transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
            {history.length > 0 && (
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {history.length}
              </span>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl p-4 mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {/* Results */}
        {financials && (
          <SnapshotCard
            financials={financials}
            analysis={analysis}
            analysisLoading={loading === "analysis"}
          />
        )}

      </div>

      {/* Footer */}
      <footer className="mt-12 flex flex-col items-center gap-3 text-sm text-gray-400 dark:text-gray-500">
        <a
          href="https://linktr.ee/investwithbjorn"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="/bjorn-banner.png"
            alt="Invest with Bjorn"
            className="h-16 w-auto rounded-xl object-contain opacity-90 hover:opacity-100 transition-opacity"
          />
        </a>
        <span>
          Built by{" "}
          <a
            href="https://linktr.ee/investwithbjorn"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            Invest with Bjorn
          </a>
        </span>
      </footer>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        onLoad={(entry) => { loadFromHistory(entry); setHistoryOpen(false) }}
        onDelete={(id) => { deleteFromHistory(id); refreshHistory() }}
        onClearAll={() => { localStorage.removeItem("stock-snapshot-history"); refreshHistory() }}
      />
    </main>
  )
}

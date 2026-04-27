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

const TOOL_URL = "https://stock-snapshot.vercel.app"

interface AnalysisData {
  businessOverview: string
  strengths: string[]
  weaknesses: string[]
  news?: { title: string; publisher: string; url: string }[]
}

type Gate = "loading" | "gate" | "success" | "tool"

export default function Home() {
  const [gate, setGate] = useState<Gate>("loading")
  const [nameInput, setNameInput] = useState("")
  const [emailInput, setEmailInput] = useState("")
  const [emailError, setEmailError] = useState("")
  const [emailSubmitting, setEmailSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  const [ticker, setTicker] = useState("")
  const [loading, setLoading] = useState<"idle" | "financials" | "analysis" | "done">("idle")
  const [financials, setFinancials] = useState<SnapshotFinancials | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [error, setError] = useState("")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isDark, setIsDark] = useState(false)
  const [showSearchTip, setShowSearchTip] = useState(false)

  useEffect(() => {
    const hasAccess = localStorage.getItem("stock-snapshot-access")
    setGate(hasAccess ? "tool" : "gate")
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

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    const email = emailInput.trim().toLowerCase()
    const name = nameInput.trim()
    if (!name) { setEmailError("Please enter your name."); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address.")
      return
    }
    setEmailError("")
    setEmailSubmitting(true)
    try {
      await fetch("/api/capture-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      })
    } catch { /* silently continue — don't block access on Sheets failure */ }
    localStorage.setItem("stock-snapshot-access", "1")
    setEmailSubmitting(false)
    setGate("success")
  }

  function handleCopyLink() {
    try {
      navigator.clipboard.writeText(TOOL_URL)
      setCopied(true)
    } catch {
      // Fallback for non-HTTPS or older browsers
      const el = document.createElement("textarea")
      el.value = TOOL_URL
      el.style.position = "fixed"
      el.style.opacity = "0"
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
      setCopied(true)
    }
    setTimeout(() => setCopied(false), 2000)
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
        `/api/analysis?ticker=${t}&name=${encodeURIComponent(fin.companyName)}&isETF=${fin.isETF}`
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

  // ── Gate screen ────────────────────────────────────────────────────────────
  if (gate === "loading") return null

  if (gate === "gate") {
    return (
      <main className="relative min-h-screen bg-[#1A2636] flex items-center justify-center px-4 overflow-hidden">

        <div className="noise-overlay" />

        {/* Static gradient orbs */}
        <div className="absolute top-[-15%] left-[-15%] w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(212,169,60,0.2) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute bottom-[-15%] right-[-10%] w-[550px] h-[550px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(143,163,188,0.15) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute top-[35%] right-[15%] w-[350px] h-[350px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(212,169,60,0.12) 0%, transparent 70%)", filter: "blur(50px)" }} />

        <div className="relative w-full max-w-md fade-in-up">
          {/* Glass card with visible glow border */}
          <div className="rounded-3xl p-8 text-center"
            style={{
              background: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              borderTop: "1px solid rgba(255,255,255,0.28)",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              borderRight: "1px solid rgba(255,255,255,0.08)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              boxShadow: "0 0 80px rgba(212,169,60,0.12), 0 25px 50px rgba(0,0,0,0.5)",
            }}>

            <a href="https://linktr.ee/investwithbjorn" target="_blank" rel="noopener noreferrer">
              <img
                src="/bjorn-banner.png"
                alt="Invest with Bjorn"
                className="h-12 w-auto mx-auto rounded-xl object-contain mb-7 opacity-80 hover:opacity-100 transition-opacity"
              />
            </a>

            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-3 leading-tight font-serif-display"
                style={{ background: "linear-gradient(135deg, #ffffff 0%, #F5F3EE 50%, #D4A93C 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Stock Health Checker
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: "#8FA3BC" }}>
                Instant financial health checks on any stock — revenue trends, margins, analyst consensus, and AI-powered insights.
              </p>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3 text-left">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your first name"
                className="w-full rounded-xl px-4 py-3 text-sm text-white transition-all outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                onFocus={e => e.currentTarget.style.border = "1px solid rgba(212,169,60,0.7)"}
                onBlur={e => e.currentTarget.style.border = "1px solid rgba(255,255,255,0.12)"}
              />
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Your email address"
                className="w-full rounded-xl px-4 py-3 text-sm text-white transition-all outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                onFocus={e => e.currentTarget.style.border = "1px solid rgba(212,169,60,0.7)"}
                onBlur={e => e.currentTarget.style.border = "1px solid rgba(255,255,255,0.12)"}
              />
              {emailError && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <span className="text-red-400 shrink-0 text-xs">✕</span>
                  <p className="text-red-400 text-sm">{emailError}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={emailSubmitting}
                className="shimmer-btn w-full font-semibold py-3 rounded-xl text-sm transition-all disabled:opacity-50"
                style={{ color: "#1A2636", background: "linear-gradient(135deg, #D4A93C, #b8901f)", boxShadow: "0 8px 32px rgba(212,169,60,0.3)" }}
              >
                {emailSubmitting ? "Getting access..." : "Get Free Access →"}
              </button>
            </form>

            <p className="text-xs mt-5" style={{ color: "rgba(143,163,188,0.5)" }}>
              Free forever · No spam · Unsubscribe anytime
            </p>
          </div>
        </div>
      </main>
    )
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (gate === "success") {
    return (
      <main className="relative min-h-screen bg-[#1A2636] flex items-center justify-center px-4 overflow-hidden">

        <div className="absolute top-[-15%] left-[-15%] w-[600px] h-[600px] rounded-full blob"
          style={{ background: "radial-gradient(circle, rgba(212,169,60,0.2) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute bottom-[-15%] right-[-10%] w-[550px] h-[550px] rounded-full blob blob-delay-2"
          style={{ background: "radial-gradient(circle, rgba(143,163,188,0.15) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute top-[35%] right-[15%] w-[350px] h-[350px] rounded-full blob blob-delay-4"
          style={{ background: "radial-gradient(circle, rgba(212,169,60,0.12) 0%, transparent 70%)", filter: "blur(50px)" }} />

        <div className="relative w-full max-w-md fade-in-up">
          <div className="rounded-3xl p-8 text-center"
            style={{
              background: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              borderTop: "1px solid rgba(255,255,255,0.28)",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              borderRight: "1px solid rgba(255,255,255,0.08)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              boxShadow: "0 0 80px rgba(212,169,60,0.12), 0 25px 50px rgba(0,0,0,0.5)",
            }}>

            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)" }}>
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-3xl font-bold mb-2 font-serif-display"
              style={{ background: "linear-gradient(135deg, #ffffff 0%, #F5F3EE 50%, #D4A93C 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              You're in!
            </h2>
            <p className="text-sm mb-7 leading-relaxed" style={{ color: "#8FA3BC" }}>
              Save your access link — bookmark it so you can come back anytime, even if your browser clears.
            </p>

            <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-2"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <span className="text-sm flex-1 text-left truncate font-mono" style={{ color: "rgba(255,255,255,0.65)" }}>
                {TOOL_URL}
              </span>
              <button
                onClick={handleCopyLink}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{ background: "rgba(212,169,60,0.15)", border: "1px solid rgba(212,169,60,0.35)", color: "#D4A93C" }}
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <p className="text-xs mb-7" style={{ color: "rgba(143,163,188,0.5)" }}>Bookmark this or save it somewhere safe</p>

            <button
              onClick={() => setGate("tool")}
              className="shimmer-btn w-full font-semibold py-3 rounded-xl text-sm transition-all"
              style={{ color: "#1A2636", background: "linear-gradient(135deg, #D4A93C, #b8901f)", boxShadow: "0 8px 32px rgba(212,169,60,0.3)" }}
            >
              Start Analysing →
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ── Tool ───────────────────────────────────────────────────────────────────
  return (
    <main className="relative min-h-screen bg-[#1A2636] py-10 px-3 sm:px-6 overflow-x-hidden">

      <div className="noise-overlay" />

      {/* Static background orbs */}
      <div className="pointer-events-none fixed top-[-20%] left-[-10%] w-[700px] h-[700px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(212,169,60,0.1) 0%, transparent 65%)", filter: "blur(80px)" }} />
      <div className="pointer-events-none fixed bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(143,163,188,0.08) 0%, transparent 65%)", filter: "blur(80px)" }} />
      <div className="pointer-events-none fixed top-[40%] right-[20%] w-[400px] h-[400px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(212,169,60,0.06) 0%, transparent 65%)", filter: "blur(70px)" }} />

      <div className="relative max-w-6xl mx-auto">

        {/* Header */}
        {/* Shared social icons snippet — rendered in both layouts */}
        {(() => {
          const socialIcons = (
            <div className="flex items-center gap-1.5">
              <a href="https://youtube.com/@investwithbjorn" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-opacity hover:opacity-100"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)", opacity: 0.75 }}
                title="YouTube">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              <a href="https://tiktok.com/@investwithbjorn" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-opacity hover:opacity-100"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)", opacity: 0.75 }}
                title="TikTok">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/>
                </svg>
              </a>
              <a href="https://t.me/investwithbjorn" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-opacity hover:opacity-100"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)", opacity: 0.75 }}
                title="Telegram">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </a>
            </div>
          )
          const themeBtn = (
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors shrink-0"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}
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
          )
          return (
            <div className="mb-8 fade-in-up">

              {/* Mobile: centered stack */}
              <div className="sm:hidden flex flex-col items-center gap-2 mb-4">
                <img src="/bjorn-banner.png" alt="Invest with Bjorn" className="w-[120px] h-auto rounded-xl object-contain" />
                {socialIcons}
              </div>
              <div className="sm:hidden flex items-start justify-between mb-1">
                <div className="text-left">
                  <h1 className="text-2xl font-bold mb-0.5 font-serif-display"
                    style={{ background: "linear-gradient(135deg, #ffffff 0%, #F5F3EE 50%, #D4A93C 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    Stock Health Checker
                  </h1>
                  <p className="text-sm" style={{ color: "#8FA3BC" }}>Is this stock worth a closer look?</p>
                </div>
                {themeBtn}
              </div>

              {/* Desktop: brand+socials left, title center, toggle right */}
              <div className="hidden sm:block relative text-center">
                <h1 className="text-3xl font-bold mb-1 font-serif-display"
                  style={{ background: "linear-gradient(135deg, #ffffff 0%, #F5F3EE 50%, #D4A93C 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  Stock Health Checker
                </h1>
                <p className="text-sm" style={{ color: "#8FA3BC" }}>Is this stock worth a closer look?</p>
                <div className="absolute left-0 top-0 flex flex-col items-start gap-1.5">
                  <img src="/bjorn-banner.png" alt="Invest with Bjorn" className="w-[120px] h-auto rounded-xl object-contain" />
                  {socialIcons}
                </div>
                <div className="absolute right-0 top-0">{themeBtn}</div>
              </div>

            </div>
          )
        })()}

        {/* Search row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8 items-center sm:justify-center fade-in-up relative z-10">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              placeholder="Enter ticker (e.g. AAPL)"
              className="rounded-xl px-4 py-3 pr-10 text-sm w-full text-white placeholder-gray-500 outline-none transition-all"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
              onFocus={e => e.currentTarget.style.border = "1px solid rgba(212,169,60,0.7)"}
              onBlur={e => e.currentTarget.style.border = "1px solid rgba(255,255,255,0.12)"}
            />
            {/* Info icon */}
            <button
              type="button"
              onMouseEnter={() => setShowSearchTip(true)}
              onMouseLeave={() => setShowSearchTip(false)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full transition-colors"
              style={{ color: "rgba(255,255,255,0.3)" }}
              title="How to search international stocks"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="8" strokeLinecap="round" strokeWidth={2.5}/>
                <line x1="12" y1="12" x2="12" y2="16" strokeLinecap="round"/>
              </svg>
            </button>
            {/* Tooltip */}
            {showSearchTip && (
              <div
                className="absolute left-0 top-full mt-2 z-50 rounded-xl p-3.5 text-xs w-64"
                style={{
                  background: "rgb(15,20,35)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                <p className="font-semibold mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>Searching international stocks</p>
                <p className="mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>Add the exchange suffix after the ticker:</p>
                <div className="space-y-1">
                  {[
                    ["🇺🇸 US", "AAPL, MSFT"],
                    ["🇰🇷 Korea (.KS)", "000660.KS"],
                    ["🇯🇵 Japan (.T)", "7203.T"],
                    ["🇭🇰 Hong Kong (.HK)", "0005.HK"],
                    ["🇬🇧 London (.L)", "HSBA.L"],
                    ["🇸🇬 Singapore (.SI)", "D05.SI"],
                  ].map(([label, example]) => (
                    <div key={label} className="flex justify-between items-center">
                      <span style={{ color: "#8FA3BC" }}>{label}</span>
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.07)", color: "#D4A93C" }}>{example}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="shimmer-btn font-semibold px-6 py-3 rounded-xl text-sm transition-all disabled:opacity-50 w-full sm:w-auto"
            style={{ color: "#1A2636", background: "linear-gradient(135deg, #D4A93C, #b8901f)", boxShadow: "0 8px 32px rgba(212,169,60,0.3)" }}
          >
            {loading === "financials"
              ? "Fetching data..."
              : loading === "analysis"
              ? "Analysing..."
              : "Analyse"}
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center justify-center gap-2 font-medium px-4 py-3 rounded-xl text-sm transition-all w-full sm:w-auto"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
            {history.length > 0 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(212,169,60,0.2)", color: "#D4A93C" }}>
                {history.length}
              </span>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl p-4 mb-6 text-sm text-center"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
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
      <footer className="relative mt-12 flex flex-col items-center gap-3 text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>
        <span>
          Built by{" "}
          <a
            href="https://linktr.ee/investwithbjorn"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold transition-colors hover:opacity-80"
            style={{ color: "#8FA3BC" }}
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

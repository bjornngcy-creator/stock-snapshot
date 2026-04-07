import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { tavily } from "@tavily/core"
import { getCachedAnalysis, setCachedAnalysis } from "@/lib/sheets"
import YahooFinance from "yahoo-finance2"

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false },
})

export const dynamic = "force-dynamic"

async function fetchYahooNews(ticker: string): Promise<{ title: string; publisher: string; url: string }[]> {
  try {
    const result = await yf.search(ticker, { newsCount: 5, quotesCount: 0 })
    return (result.news ?? []).slice(0, 5).map((item: any) => ({
      title: item.title,
      publisher: item.publisher ?? "",
      url: item.link,
    }))
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase()
  const companyName = req.nextUrl.searchParams.get("name") ?? ticker
  if (!ticker) return NextResponse.json({ error: "No ticker provided" }, { status: 400 })

  try {
    // ── Check cache first ────────────────────────────────────────────────
    const [cached, newsResults] = await Promise.all([
      getCachedAnalysis(ticker),
      fetchYahooNews(ticker),
    ])

    if (cached) {
      return NextResponse.json({
        ticker,
        companyName,
        ...cached.data,
        news: newsResults,
        fromCache: true,
      })
    }

    // ── Cache miss — call Gemini + Tavily ────────────────────────────────
    const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
    const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! })

    const searchResults = await tavilyClient.search(
      `${companyName} ${ticker} business model competitive advantages risks 2024 2025`,
      { maxResults: 5, includeAnswer: true }
    )

    const context = [
      searchResults.answer ?? "",
      ...searchResults.results.map((r: any) => `[${r.title}]: ${r.content}`),
    ].join("\n\n")

    const prompt = `You are a professional equity analyst. Analyze ${companyName} (${ticker}).

Use the research context below, but also apply your own knowledge of ${companyName}.

RESEARCH CONTEXT:
${context}

Respond ONLY with valid JSON in this exact format:
{
  "businessOverview": "A detailed 3-4 sentence paragraph explaining what ${companyName} does, its business model, key revenue streams, and market position.",
  "strengths": [
    "First competitive strength with specific detail about ${companyName}",
    "Second competitive strength with specific detail",
    "Third competitive strength with specific detail"
  ],
  "weaknesses": [
    "First key risk or weakness with specific detail about ${companyName}",
    "Second key risk or weakness with specific detail",
    "Third key risk or weakness with specific detail"
  ]
}

Rules:
- Always refer to the company by name (${companyName}), never say "the company" or "based on the context"
- Be specific: mention actual products, segments, markets, or competitive dynamics
- strengths: focus on durable competitive advantages and market position
- weaknesses: focus on material risks, threats, or structural vulnerabilities`

    const model = genai.getGenerativeModel({ model: "gemini-2.5-flash-lite" })
    const result = await model.generateContent(prompt)
    const raw = result.response.text()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("Could not parse Gemini response as JSON")

    const parsed = JSON.parse(jsonMatch[0])

    // ── Save to cache (don't await — let it run in background) ───────────
    setCachedAnalysis(ticker, companyName as string, parsed)

    return NextResponse.json({ ticker, companyName, ...parsed, news: newsResults })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

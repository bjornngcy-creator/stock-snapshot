import { NextRequest, NextResponse } from "next/server"
import { getSnapshotFinancials } from "@/lib/financials"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: "No ticker provided" }, { status: 400 })
  try {
    const data = await getSnapshotFinancials(ticker)
    return NextResponse.json(data, {
      headers: {
        // Cache at Vercel's CDN for 1 hour; serve stale for up to 24h while revalidating
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

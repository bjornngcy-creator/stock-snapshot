import { NextRequest, NextResponse } from "next/server"
import { getSnapshotFinancials } from "@/lib/financials"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: "No ticker provided" }, { status: 400 })
  try {
    const data = await getSnapshotFinancials(ticker)
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

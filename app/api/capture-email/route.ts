import { NextRequest, NextResponse } from "next/server"
import { captureEmail } from "@/lib/sheets"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { name, email } = await req.json()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }
    await captureEmail(email.toLowerCase().trim(), (name ?? "").trim())
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const SUBSTACK_URL = "https://investwithbjorn.substack.com/api/v1/free"

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }

    const cleanEmail = email.toLowerCase().trim()

    await fetch(SUBSTACK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://investwithbjorn.substack.com",
        "Referer": "https://investwithbjorn.substack.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
      },
      body: JSON.stringify({
        email: cleanEmail,
        first_url: "https://investwithbjorn.substack.com",
        first_referrer: "",
      }),
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

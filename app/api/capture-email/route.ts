import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const SUBSTACK_URL = "https://investwithbjorn.substack.com/api/v1/free?nojs=true"

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }

    const cleanEmail = email.toLowerCase().trim()

    // Subscribe to Substack — they will receive a confirmation email
    await fetch(SUBSTACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: cleanEmail }),
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

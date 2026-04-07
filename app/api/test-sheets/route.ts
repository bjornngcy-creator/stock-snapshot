import { NextResponse } from "next/server"
import { google } from "googleapis"

export const dynamic = "force-dynamic"

export async function GET() {
  const results: Record<string, any> = {}

  // 1. Check env vars are present
  results.hasSheetId    = !!process.env.GOOGLE_SHEET_ID
  results.hasEmail      = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  results.hasKey        = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  results.keyStart      = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.slice(0, 40) ?? "missing"
  results.keyHasLiteral = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.includes("\\n") ?? false
  results.keyHasReal    = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.includes("\n") ?? false

  try {
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!.replace(/\\n/g, "\n")
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    const sheets = google.sheets({ version: "v4", auth })

    // 2. Try to get spreadsheet metadata
    const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID! })
    results.sheetTitle    = meta.data.properties?.title
    results.firstTabName  = meta.data.sheets?.[0]?.properties?.title

    // 3. Try to append a test row
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID!,
      range: `${results.firstTabName}!A:F`,
      valueInputOption: "RAW",
      requestBody: { values: [["TEST", "Test Co", "Test overview", "[]", "[]", new Date().toISOString().split("T")[0]]] },
    })
    results.writeSuccess = true

  } catch (err: any) {
    results.error   = err.message
    results.code    = err.code
    results.status  = err.status
  }

  return NextResponse.json(results)
}

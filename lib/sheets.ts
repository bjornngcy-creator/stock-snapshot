import { google } from "googleapis"

const SHEET_ID = process.env.GOOGLE_SHEET_ID!
const CACHE_TTL_DAYS = 30

export interface CachedAnalysis {
  businessOverview: string
  strengths: string[]
  weaknesses: string[]
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY!.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
}

export async function getCachedAnalysis(ticker: string): Promise<{ data: CachedAnalysis; rowIndex: number } | null> {
  try {
    const sheets = google.sheets({ version: "v4", auth: getAuth() })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Sheet1!A:F",
    })
    const rows = res.data.values ?? []
    const rowIndex = rows.findIndex((r) => r[0] === ticker)
    if (rowIndex < 1) return null // 0 = header row, -1 = not found

    const row = rows[rowIndex]
    const cachedAt = new Date(row[5])
    const daysDiff = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff > CACHE_TTL_DAYS) return null

    return {
      data: {
        businessOverview: row[2],
        strengths: JSON.parse(row[3]),
        weaknesses: JSON.parse(row[4]),
      },
      rowIndex: rowIndex + 1, // 1-based for Sheets API
    }
  } catch {
    return null
  }
}

export async function setCachedAnalysis(
  ticker: string,
  companyName: string,
  analysis: CachedAnalysis,
  rowIndex?: number
): Promise<void> {
  try {
    const sheets = google.sheets({ version: "v4", auth: getAuth() })
    const values = [[
      ticker,
      companyName,
      analysis.businessOverview,
      JSON.stringify(analysis.strengths),
      JSON.stringify(analysis.weaknesses),
      new Date().toISOString().split("T")[0],
    ]]

    if (rowIndex) {
      // Update the existing stale row
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Sheet1!A${rowIndex}:F${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values },
      })
    } else {
      // Append a new row
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: "Sheet1!A:F",
        valueInputOption: "RAW",
        requestBody: { values },
      })
    }
  } catch (err) {
    console.error("Sheets cache write failed:", err)
    // Don't throw — a cache failure should never break the app
  }
}

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

// Cache the tab name in module scope — it never changes, no need to re-fetch per request
let _cachedSheetName: string | null = null

async function getFirstSheetName(): Promise<string> {
  if (_cachedSheetName) return _cachedSheetName
  try {
    const sheets = google.sheets({ version: "v4", auth: getAuth() })
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
    _cachedSheetName = meta.data.sheets?.[0]?.properties?.title ?? "Sheet1"
    return _cachedSheetName
  } catch {
    return "Sheet1"
  }
}

export async function getCachedAnalysis(ticker: string): Promise<{ data: CachedAnalysis; rowIndex: number } | null> {
  try {
    const sheets = google.sheets({ version: "v4", auth: getAuth() })
    const tab = await getFirstSheetName()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${tab}!A:F`,
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

export async function captureEmail(email: string, name: string = ""): Promise<void> {
  const sheets = google.sheets({ version: "v4", auth: getAuth() })
  const tab = await getFirstSheetName()

  // Write to a dedicated "Leads" tab — create it if it doesn't exist
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const leadsTab = meta.data.sheets?.find(s => s.properties?.title === "Leads")

  if (!leadsTab) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Leads" } } }],
      },
    })
    // Add header row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: "Leads!A1:B1",
      valueInputOption: "RAW",
      requestBody: { values: [["name", "email", "date"]] },
    })
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "Leads!A:C",
    valueInputOption: "RAW",
    requestBody: {
      values: [[name, email, new Date().toISOString().split("T")[0]]],
    },
  })
}

export async function setCachedAnalysis(
  ticker: string,
  companyName: string,
  analysis: CachedAnalysis,
  rowIndex?: number
): Promise<void> {
  try {
    const sheets = google.sheets({ version: "v4", auth: getAuth() })
    const tab = await getFirstSheetName()
    const values = [[
      ticker,
      companyName,
      analysis.businessOverview,
      JSON.stringify(analysis.strengths),
      JSON.stringify(analysis.weaknesses),
      new Date().toISOString().split("T")[0],
    ]]

    if (rowIndex) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${tab}!A${rowIndex}:F${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values },
      })
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${tab}!A:F`,
        valueInputOption: "RAW",
        requestBody: { values },
      })
    }
  } catch (err) {
    console.error("Sheets cache write failed:", err)
  }
}

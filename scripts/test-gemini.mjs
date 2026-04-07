import { readFileSync } from "fs"

// Read key from .env.local
const env = readFileSync(".env.local", "utf8")
const key = env.match(/GOOGLE_API_KEY=(.+)/)?.[1]?.trim()
console.log("Key prefix:", key?.slice(0, 8))

const models = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
]

for (const model of models) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Say OK" }] }] }),
      }
    )
    const data = await res.json()
    if (res.ok) {
      console.log(`✓ ${model} — WORKS`)
    } else {
      console.log(`✗ ${model} — ${data.error?.message?.slice(0, 60)}`)
    }
  } catch (e) {
    console.log(`✗ ${model} — ${e.message}`)
  }
}

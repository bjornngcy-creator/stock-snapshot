import { readFileSync } from "fs"

const env = readFileSync(".env.local", "utf8")
const key = env.match(/GOOGLE_API_KEY=(.+)/)?.[1]?.trim()

// Test 1: basic call
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: "Say OK" }] }] }),
  }
)
const data = await res.json()
console.log("Status:", res.status)
console.log("Full response:", JSON.stringify(data, null, 2))

// Test 2: list available models
const res2 = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
)
const data2 = await res2.json()
console.log("\nModels status:", res2.status)
if (data2.error) console.log("Models error:", data2.error.message)
else console.log("First model:", data2.models?.[0]?.name)

import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "StockSnapshot",
  description: "Bird's eye view of any company",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

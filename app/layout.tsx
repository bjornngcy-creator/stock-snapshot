import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import "./globals.css"

export const metadata: Metadata = {
  title: "Stock Health Checker",
  description: "Is this stock worth a closer look?",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={GeistSans.className}>{children}</body>
    </html>
  )
}

import "./globals.css"
import type { ReactNode } from "react"

export const metadata = { title: "cardartpicker — load test" }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

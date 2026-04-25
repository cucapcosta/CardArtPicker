import "./globals.css"
import type { ReactNode } from "react"

export const metadata = { title: "ProxyMart — CardArtPicker demo" }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

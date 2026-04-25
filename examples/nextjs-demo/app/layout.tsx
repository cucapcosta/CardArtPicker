import "./globals.css"
import type { ReactNode } from "react"
import { Cinzel, Geist, JetBrains_Mono } from "next/font/google"

const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-display" })
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata = { title: "ProxyMart — Card Art Cabinet" }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${geist.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}

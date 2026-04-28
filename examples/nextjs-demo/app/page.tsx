import { CardArtPicker } from "cardartpicker/ui"
import { DemoHeader } from "@/components/DemoHeader"
import { DownloadSummary } from "@/components/DownloadSummary"
import { Footer } from "@/components/Footer"

const SAMPLE = `
4 Lightning Bolt
1 Sol Ring (C21) 472
1 Arlinn, the Pack's Hope // Arlinn, the Moon's Fury

TOKENS:
3 Treasure
`.trim()

export default function Home() {
  return (
    <main style={{ padding: "2rem" }}>
      <CardArtPicker
        initialList={SAMPLE}
        apiBase="/api/cardartpicker"
        slots={{ header: <DemoHeader />, sidebar: <DownloadSummary />, footer: <Footer /> }}
      />
    </main>
  )
}

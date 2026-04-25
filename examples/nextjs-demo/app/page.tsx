import { CardArtPicker } from "cardartpicker/ui"

const SAMPLE = `
4 Lightning Bolt
1 Sol Ring (C21) 472
1 Arlinn, the Pack's Hope // Arlinn, the Moon's Fury
1 Jace, the Mind Sculptor

TOKENS:
3 Treasure
`.trim()

export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>ProxyMart</h1>
      <CardArtPicker initialList={SAMPLE} />
    </main>
  )
}

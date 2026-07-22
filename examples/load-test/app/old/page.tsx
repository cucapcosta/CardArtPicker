import { CardArtPicker } from "../../components_old/CardArtPicker"

const SAMPLE = `
4 Lightning Bolt
4 Counterspell
4 Brainstorm
2 Sol Ring
1 Mithril Coat
1 Steam Vents
1 Arlinn, the Pack's Hope // Arlinn, the Moon's Fury

TOKENS:
3 Treasure
2 Soldier
`.trim()

export default function OldHome() {
  return (
    <main>
      <div className="lt-bar">
        <span><span className="dot" />cardartpicker · load-test · legacy component</span>
        <span><a href="/">new version →</a></span>
      </div>
      <div style={{ padding: "1.5rem" }}>
        <CardArtPicker initialList={SAMPLE} apiBase="/api/cardartpicker" />
      </div>
    </main>
  )
}

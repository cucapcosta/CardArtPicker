"use client"

import { useState } from "react"
import { useCardPicker } from "cardartpicker/client"
import styles from "./styles/CardArtPicker.module.css"

export function ListImporter({ initialList = "" }: { initialList?: string }) {
  const { parseList, loading } = useCardPicker()
  const [text, setText] = useState(initialList)
  return (
    <div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={6}
        placeholder="Paste Moxfield list here…"
        style={{ width: "100%", fontFamily: "var(--cap-font)", padding: "0.5rem" }}
        disabled={loading}
      />
      <button
        onClick={() => void parseList(text)}
        disabled={loading || text.trim().length === 0}
        className={styles.arrow}
        style={{ marginTop: "0.5rem" }}
      >
        {loading ? "Parsing…" : "Parse list"}
      </button>
    </div>
  )
}

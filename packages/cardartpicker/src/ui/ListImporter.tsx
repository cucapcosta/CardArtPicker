"use client"

import { useState } from "react"
import { useCardPicker } from "cardartpicker/client"

export function ListImporter({ initialList = "" }: { initialList?: string }) {
  const { parseList, loading } = useCardPicker()
  const [text, setText] = useState(initialList)
  const empty = text.trim().length === 0

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h4 className="font-mono text-[0.7rem] uppercase tracking-[0.25em] text-brass-soft">Decklist</h4>
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted">
          moxfield · arena · plain
        </span>
      </div>
      <div className="relative">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={6}
          placeholder={"4 Lightning Bolt\n1 Sol Ring (C21) 472\n\nTOKENS:\n3 Treasure"}
          disabled={loading}
          className="w-full bg-ink-soft border border-edge focus:border-brass/60 focus:outline-none rounded-[3px] p-3 font-mono text-sm text-bone-dim placeholder:text-muted/60 transition-colors disabled:opacity-50 leading-relaxed"
        />
      </div>
      <button
        onClick={() => void parseList(text)}
        disabled={loading || empty}
        className="group inline-flex items-center gap-3 px-5 py-2 border border-brass/60 bg-brass/0 hover:bg-brass hover:text-ink text-brass font-display tracking-[0.2em] text-sm uppercase transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <span className="text-base leading-none transition-transform group-hover:translate-x-1">→</span>
        {loading ? "summoning" : "summon"}
      </button>
    </div>
  )
}

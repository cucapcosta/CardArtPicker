"use client"

import { useCardPicker } from "cardartpicker/client"

function Row({ label, value, muted = false }: { label: string; value: string | number; muted?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 ${muted ? "text-muted" : "text-bone-dim"}`}>
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em]">{label}</span>
      <span className="flex-1 border-b border-dotted border-edge translate-y-[-2px]" />
      <span className="font-mono text-sm tabular-nums">{value}</span>
    </div>
  )
}

export function DownloadSummary() {
  const { list, selections, download } = useCardPicker()
  const totalCount = list.mainboard.length + list.tokens.length
  const pickedCount = Object.keys(selections).length

  return (
    <aside className="sticky top-6 self-start space-y-5 p-5 bg-surface/80 border border-edge backdrop-blur-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display tracking-[0.25em] text-sm uppercase text-brass">Selection</h2>
      </div>

      <div className="space-y-3">
        <Row label="mainboard" value={String(list.mainboard.length).padStart(2, "0")} />
        <Row label="tokens" value={String(list.tokens.length).padStart(2, "0")} />
        <Row label="prints chosen" value={String(pickedCount).padStart(2, "0")} />
      </div>

      <div className="divider-brass" />

      <button
        onClick={() => void download()}
        disabled={pickedCount === 0}
        className="w-full px-4 py-3 bg-brass text-ink hover:bg-brass-soft disabled:bg-edge disabled:text-muted disabled:cursor-not-allowed font-display tracking-[0.25em] text-sm uppercase transition-colors"
      >
        Download zip ↓
      </button>

      <p className="font-mono text-[0.6rem] text-muted text-center uppercase tracking-[0.2em]">
        personal use only · respect upstream rights
      </p>

      {totalCount > 0 && pickedCount < totalCount && (
        <p className="font-mono text-[0.65rem] text-crimson/80 text-center">
          {totalCount - pickedCount} slot{totalCount - pickedCount === 1 ? "" : "s"} unfilled
        </p>
      )}
    </aside>
  )
}

"use client"

import { useCardPicker } from "cardartpicker/client"

function Row({ label, value, muted = false, mono = true }: { label: string; value: string | number; muted?: boolean; mono?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 ${muted ? "text-muted" : "text-bone-dim"}`}>
      <span className={`${mono ? "font-mono" : ""} text-[0.7rem] uppercase tracking-[0.18em]`}>{label}</span>
      <span className="flex-1 border-b border-dotted border-edge translate-y-[-2px]" />
      <span className={`${mono ? "font-mono" : "font-display"} text-sm tabular-nums`}>{value}</span>
    </div>
  )
}

export function OrderSummary() {
  const { list, selections, download } = useCardPicker()
  const totalCount = list.mainboard.length + list.tokens.length
  const pickedCount = Object.keys(selections).length

  return (
    <aside className="sticky top-6 self-start space-y-5 p-5 bg-surface/80 border border-edge backdrop-blur-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display tracking-[0.25em] text-sm uppercase text-brass">Order Ledger</h2>
        <span className="font-mono text-[0.6rem] text-muted uppercase tracking-[0.2em]">no.{Date.now().toString(36).slice(-4)}</span>
      </div>

      <div className="space-y-3">
        <Row label="mainboard" value={String(list.mainboard.length).padStart(2, "0")} />
        <Row label="tokens" value={String(list.tokens.length).padStart(2, "0")} />
        <Row label="prints chosen" value={String(pickedCount).padStart(2, "0")} />
      </div>

      <div className="divider-brass" />

      <div className="space-y-3">
        <Row label="subtotal" value="$0.00" />
        <Row label="shipping" value="free" muted />
        <div className="flex items-baseline gap-2 pt-2">
          <span className="font-display text-xs uppercase tracking-[0.25em] text-bone">total</span>
          <span className="flex-1 border-b border-dotted border-brass/40 translate-y-[-2px]" />
          <span className="font-display text-2xl text-brass tabular-nums">$0</span>
        </div>
      </div>

      <button
        onClick={() => void download()}
        disabled={pickedCount === 0}
        className="group relative w-full px-4 py-3 bg-brass text-ink hover:bg-brass-soft disabled:bg-edge disabled:text-muted disabled:cursor-not-allowed font-display tracking-[0.25em] text-sm uppercase transition-colors"
      >
        <span className="relative z-10">Print order ↓</span>
      </button>

      <p className="font-mono text-[0.6rem] text-muted text-center uppercase tracking-[0.2em]">
        * demo · triggers zip download
      </p>

      {totalCount > 0 && pickedCount < totalCount && (
        <p className="font-mono text-[0.65rem] text-crimson/80 text-center">
          {totalCount - pickedCount} slot{totalCount - pickedCount === 1 ? "" : "s"} unfilled
        </p>
      )}
    </aside>
  )
}

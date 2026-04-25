"use client"

import type { ChangeEvent } from "react"
import { useCardPicker } from "cardartpicker/client"
import type { Slot } from "../types.js"

export function CardSlot({ slot, onOpenOptions }: { slot: Slot; onOpenOptions: (slotId: string) => void }) {
  const { cycleOption, flipSlot, uploadCustom } = useCardPicker()
  const current = slot.options.find(o => o.id === slot.selectedOptionId)
  const imageUrl = slot.flipped && current?.backImageUrl ? current.backImageUrl : current?.imageUrl
  const idx = slot.options.findIndex(o => o.id === slot.selectedOptionId)
  const canFlip = Boolean(current?.backImageUrl)

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void uploadCustom(slot.id, file)
  }

  if (slot.status === "not-found") {
    return (
      <div className="group flex flex-col bg-surface/40 p-3 transition-colors">
        <div className="aspect-[63/88] flex items-center justify-center border border-dashed border-edge text-center font-mono text-xs uppercase tracking-widest text-muted px-3">
          card not found
          <span className="block text-bone-dim/60 text-[0.65rem] mt-1 normal-case tracking-normal">check spelling</span>
        </div>
        <div className="mt-3 font-display text-sm tracking-wider text-bone-dim truncate">{slot.cardName}</div>
      </div>
    )
  }

  return (
    <div className="group flex flex-col gap-2.5 transition-transform duration-300 hover:-translate-y-0.5">
      <div className="relative overflow-hidden rounded-[3px] bg-surface frame-card">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={slot.cardName}
            onClick={() => onOpenOptions(slot.id)}
            loading="lazy"
            className="w-full aspect-[63/88] object-cover cursor-pointer transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="aspect-[63/88] flex items-center justify-center font-mono text-[0.7rem] uppercase tracking-widest text-muted">
            <span className="animate-pulse">summoning…</span>
          </div>
        )}
        {canFlip && (
          <button
            onClick={() => flipSlot(slot.id)}
            aria-label="Flip card"
            className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-ink/80 text-brass border border-brass/40 backdrop-blur-sm flex items-center justify-center text-sm hover:bg-brass hover:text-ink transition-colors"
          >
            ⟳
          </button>
        )}
        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-ink/90 border border-edge/80 text-[0.6rem] font-mono uppercase tracking-[0.15em] text-bone-dim">
          ×{slot.quantity}
        </div>
      </div>

      <div className="flex items-center gap-2 px-0.5">
        <button
          onClick={() => cycleOption(slot.id, "prev")}
          aria-label="Previous option"
          className="text-muted hover:text-brass transition-colors text-base leading-none px-1.5 py-0.5 -my-1"
        >◀</button>
        <div className="flex-1 min-w-0 text-center font-display text-[0.85rem] tracking-wide text-bone truncate">
          {slot.cardName}
        </div>
        <button
          onClick={() => cycleOption(slot.id, "next")}
          aria-label="Next option"
          className="text-muted hover:text-brass transition-colors text-base leading-none px-1.5 py-0.5 -my-1"
        >▶</button>
      </div>

      <div className="flex items-baseline justify-between px-0.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted">
        <span className="text-brass-soft">
          {current?.sourceName ?? "—"}
        </span>
        <span>
          {current ? `${idx + 1} / ${slot.options.length}` : ""}
        </span>
      </div>

      <label className="cursor-pointer self-start font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted hover:text-brass transition-colors px-0.5">
        + upload custom
        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFileInput} />
      </label>
    </div>
  )
}

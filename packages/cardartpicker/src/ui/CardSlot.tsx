"use client"

import type { ChangeEvent } from "react"
import { useCardPicker } from "cardartpicker/client"
import type { Slot } from "../types.js"
import styles from "./styles/CardArtPicker.module.css"

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
      <div className={styles.slot}>
        <div className={styles.notFoundOverlay}>Card not found — check name</div>
        <div className={styles.slotName}>{slot.cardName}</div>
      </div>
    )
  }

  return (
    <div className={styles.slot}>
      <div className={styles.imageWrap}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={slot.cardName}
            className={styles.slotImage}
            onClick={() => onOpenOptions(slot.id)}
            loading="lazy"
          />
        ) : (
          <div className={styles.notFoundOverlay}>Loading…</div>
        )}
        {canFlip && (
          <button className={styles.flipButton} onClick={() => flipSlot(slot.id)} aria-label="Flip card">⟳</button>
        )}
      </div>
      <div className={styles.slotMeta}>
        <button className={styles.arrow} onClick={() => cycleOption(slot.id, "prev")} aria-label="Previous option">◀</button>
        <div className={styles.slotName}>{slot.cardName}</div>
        <button className={styles.arrow} onClick={() => cycleOption(slot.id, "next")} aria-label="Next option">▶</button>
      </div>
      <div className={styles.slotSource}>
        {current ? `${current.sourceName} · ${idx + 1} / ${slot.options.length}` : "—"}
      </div>
      <label className={styles.slotSource} style={{ cursor: "pointer" }}>
        Upload
        <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={onFileInput} />
      </label>
    </div>
  )
}

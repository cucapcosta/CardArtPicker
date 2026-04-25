"use client"

import { useCardPicker } from "cardartpicker/client"
import styles from "./styles/CardArtPicker.module.css"

export function OptionsModal({ slotId, onClose }: { slotId: string; onClose: () => void }) {
  const { getSlot, selectOption } = useCardPicker()
  const slot = getSlot(slotId)
  if (!slot) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 1000 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "var(--cap-bg)", padding: "1.5rem", borderRadius: 8, width: "min(90vw, 1400px)", maxHeight: "85vh", overflow: "auto" }}
      >
        <h3>{slot.cardName} — pick art</h3>
        <div className={styles.grid}>
          {slot.options.map(opt => (
            <div
              key={opt.id}
              className={styles.slot}
              onClick={() => { selectOption(slot.id, opt.id); onClose() }}
              style={{ cursor: "pointer", outline: opt.id === slot.selectedOptionId ? "2px solid var(--cap-accent)" : "none" }}
            >
              <img src={opt.thumbnailUrl ?? opt.imageUrl} alt="" className={styles.slotImage} />
              <div className={styles.slotSource}>
                {opt.sourceName}{opt.meta.setCode ? ` · ${opt.meta.setCode}` : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

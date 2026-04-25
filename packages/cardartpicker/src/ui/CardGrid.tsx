"use client"

import type { Slot } from "../types.js"
import { CardSlot } from "./CardSlot.js"
import styles from "./styles/CardArtPicker.module.css"

export function CardGrid({ slots, onOpenOptions }: { slots: Slot[]; onOpenOptions: (slotId: string) => void }) {
  if (slots.length === 0) return null
  return (
    <div className={styles.grid}>
      {slots.map(slot => <CardSlot key={slot.id} slot={slot} onOpenOptions={onOpenOptions} />)}
    </div>
  )
}

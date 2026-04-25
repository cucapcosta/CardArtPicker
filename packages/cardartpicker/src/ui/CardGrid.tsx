"use client"

import type { Slot } from "../types.js"
import { CardSlot } from "./CardSlot.js"

export function CardGrid({ slots, onOpenOptions }: { slots: Slot[]; onOpenOptions: (slotId: string) => void }) {
  if (slots.length === 0) return null
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-x-5 gap-y-7">
      {slots.map(slot => <CardSlot key={slot.id} slot={slot} onOpenOptions={onOpenOptions} />)}
    </div>
  )
}

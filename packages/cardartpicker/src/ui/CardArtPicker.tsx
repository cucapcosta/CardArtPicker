"use client"

import { useEffect, useState, type ReactNode } from "react"
import { CardPickerProvider, useCardPicker } from "cardartpicker/client"
import { ListImporter } from "./ListImporter.js"
import { CardGrid } from "./CardGrid.js"
import { OptionsModal } from "./OptionsModal.js"

export type CardArtPickerProps = {
  initialList?: string
  eagerLoad?: boolean
  apiBase?: string
  className?: string
  slots?: { header?: ReactNode; sidebar?: ReactNode; footer?: ReactNode }
  onSelectionChange?: (s: Record<string, string>) => void
  onDownload?: (zip: Blob) => void
  onError?: (err: Error) => void
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline gap-4 mb-5 mt-10 first:mt-0">
      <h3 className="font-display text-xl tracking-[0.2em] uppercase text-bone">
        {label}
      </h3>
      <span className="font-mono text-[0.75rem] text-brass-soft tracking-widest">
        ·{String(count).padStart(2, "0")}
      </span>
      <div className="flex-1 divider-brass" />
    </div>
  )
}

function Inner({ initialList, slots, onSelectionChange, onError }: Omit<CardArtPickerProps, "apiBase" | "className" | "eagerLoad">) {
  const { list, download, selections, errors } = useCardPicker()
  const [openSlotId, setOpenSlotId] = useState<string | null>(null)
  const notFoundCount = [...list.mainboard, ...list.tokens].filter(s => s.status === "not-found").length
  const totalCount = list.mainboard.length + list.tokens.length

  useEffect(() => { onSelectionChange?.(selections) }, [selections, onSelectionChange])
  useEffect(() => { errors.forEach(e => onError?.(e)) }, [errors, onError])

  return (
    <div className="relative z-10 flex flex-col">
      {slots?.header}

      <div className={`grid gap-10 px-8 py-10 mx-auto w-full max-w-[1600px] ${slots?.sidebar ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
        <div className="min-w-0 space-y-6">
          <div className="flex items-end justify-between gap-4 pb-4 border-b border-edge">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-brass-soft mb-2">build · pick · print</p>
              <h1 className="font-display text-4xl md:text-5xl tracking-[0.05em] text-bone leading-none">
                The Card Art Cabinet
              </h1>
            </div>
            <button
              onClick={() => void download()}
              disabled={Object.keys(selections).length === 0}
              className="hidden md:inline-flex shrink-0 items-center gap-2 px-4 py-2 border border-edge hover:border-brass disabled:opacity-30 disabled:cursor-not-allowed text-bone hover:text-brass transition-colors font-mono text-[0.75rem] uppercase tracking-[0.2em]"
            >
              <span>↓</span>
              <span>{Object.keys(selections).length} prints</span>
            </button>
          </div>

          <ListImporter initialList={initialList ?? ""} />

          {notFoundCount > 0 && (
            <div className="border-l-2 border-crimson bg-crimson/10 px-4 py-3 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-crimson">
              <span className="text-crimson font-semibold">{notFoundCount}</span>{" "}
              <span className="text-crimson/80">card{notFoundCount === 1 ? "" : "s"} unfound — verify spelling</span>
            </div>
          )}

          {totalCount === 0 && (
            <div className="py-16 text-center">
              <div className="inline-block font-mono text-[0.7rem] uppercase tracking-[0.3em] text-muted border border-dashed border-edge px-6 py-3">
                cabinet empty — paste a list above
              </div>
            </div>
          )}

          {list.mainboard.length > 0 && (
            <>
              <SectionHeader label="Mainboard" count={list.mainboard.length} />
              <CardGrid slots={list.mainboard} onOpenOptions={setOpenSlotId} />
            </>
          )}
          {list.tokens.length > 0 && (
            <>
              <SectionHeader label="Tokens" count={list.tokens.length} />
              <CardGrid slots={list.tokens} onOpenOptions={setOpenSlotId} />
            </>
          )}

          {openSlotId && <OptionsModal slotId={openSlotId} onClose={() => setOpenSlotId(null)} />}
        </div>

        {slots?.sidebar && <div className="min-w-0">{slots.sidebar}</div>}
      </div>

      {slots?.footer}
    </div>
  )
}

export function CardArtPicker({ apiBase = "/api/cardartpicker", className, ...rest }: CardArtPickerProps) {
  return (
    <CardPickerProvider apiBase={apiBase}>
      <div className={className}>
        <Inner {...rest} />
      </div>
    </CardPickerProvider>
  )
}

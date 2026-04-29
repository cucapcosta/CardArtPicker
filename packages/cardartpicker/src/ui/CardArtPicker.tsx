"use client"

import { useEffect, useState, type ReactNode } from "react"
import { CardPickerProvider, useCardPicker } from "cardartpicker/client"
import { ListImporter } from "./ListImporter.js"
import { CardGrid } from "./CardGrid.js"
import { OptionsModal } from "./OptionsModal.js"
import "./styles/cap.css"

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
      <h3 className="font-[family-name:var(--cap-font-display)] text-xl tracking-[0.2em] uppercase text-[var(--cap-fg)]">
        {label}
      </h3>
      <span className="font-[family-name:var(--cap-font-mono)] text-[0.75rem] text-[var(--cap-accent-soft)] tracking-widest">
        ·{String(count).padStart(2, "0")}
      </span>
      <div className="flex-1 cap-divider" />
    </div>
  )
}

function Inner({ initialList, slots, onSelectionChange, onError }: Omit<CardArtPickerProps, "apiBase" | "className" | "eagerLoad">) {
  const { list, download, selections, errors, optionsProgress, imageProgress } = useCardPicker()
  const [openSlotId, setOpenSlotId] = useState<string | null>(null)
  const notFoundCount = [...list.mainboard, ...list.tokens].filter(s => s.status === "not-found").length
  const totalCount = list.mainboard.length + list.tokens.length
  const optionsPct = optionsProgress && optionsProgress.total > 0
    ? Math.round((optionsProgress.loaded / optionsProgress.total) * 100)
    : 0
  const imagePct = imageProgress && imageProgress.total > 0
    ? Math.round((imageProgress.loaded / imageProgress.total) * 100)
    : 0

  useEffect(() => { onSelectionChange?.(selections) }, [selections, onSelectionChange])
  useEffect(() => { errors.forEach(e => onError?.(e)) }, [errors, onError])

  return (
    <div className="relative z-10 flex flex-col font-[family-name:var(--cap-font)] text-[var(--cap-fg)]">
      {slots?.header}

      <div className={`grid gap-10 px-8 py-10 mx-auto w-full max-w-[1600px] ${slots?.sidebar ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
        <div className="min-w-0 space-y-6">
          <div className="flex items-end justify-between gap-4 pb-4 border-b border-[var(--cap-border)]">
            <div>
              <p className="font-[family-name:var(--cap-font-mono)] text-[0.65rem] uppercase tracking-[0.3em] text-[var(--cap-accent-soft)] mb-2">
                build · pick · print
              </p>
              <h1 className="font-[family-name:var(--cap-font-display)] text-4xl md:text-5xl tracking-[0.05em] text-[var(--cap-fg)] leading-none">
                Card Art Cabinet
              </h1>
            </div>
            <button
              onClick={() => void download()}
              disabled={Object.keys(selections).length === 0}
              className="hidden md:inline-flex shrink-0 items-center gap-2 px-4 py-2 border border-[var(--cap-border)] hover:border-[var(--cap-accent)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--cap-fg)] hover:text-[var(--cap-accent)] transition-colors font-[family-name:var(--cap-font-mono)] text-[0.75rem] uppercase tracking-[0.2em]"
            >
              <span>↓</span>
              <span>{Object.keys(selections).length} prints</span>
            </button>
          </div>

          <ListImporter initialList={initialList ?? ""} />

          {(optionsProgress || imageProgress) && (
            <div className="font-[family-name:var(--cap-font-mono)] text-[0.65rem] uppercase tracking-[0.25em] text-[var(--cap-muted)] space-y-3">
              {optionsProgress && (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span>indexing prints · {optionsProgress.loaded}/{optionsProgress.total}</span>
                    <span className="text-[var(--cap-accent-soft)]">{optionsPct}%</span>
                  </div>
                  <div className="h-px bg-[var(--cap-border)] overflow-hidden">
                    <div className="h-px bg-[var(--cap-accent)] transition-[width] duration-300" style={{ width: `${optionsPct}%` }} />
                  </div>
                </div>
              )}
              {imageProgress && (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span>caching images · {imageProgress.loaded}/{imageProgress.total}</span>
                    <span className="text-[var(--cap-accent-soft)]">{imagePct}%</span>
                  </div>
                  <div className="h-px bg-[var(--cap-border)] overflow-hidden">
                    <div className="h-px bg-[var(--cap-accent-soft)] transition-[width] duration-300" style={{ width: `${imagePct}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {notFoundCount > 0 && (
            <div className="border-l-2 border-[var(--cap-danger)] bg-[var(--cap-danger)]/10 px-4 py-3 font-[family-name:var(--cap-font-mono)] text-[0.75rem] uppercase tracking-[0.18em] text-[var(--cap-danger)]">
              <span className="font-semibold">{notFoundCount}</span>{" "}
              <span className="opacity-80">card{notFoundCount === 1 ? "" : "s"} unfound — verify spelling</span>
            </div>
          )}

          {totalCount === 0 && (
            <div className="py-16 text-center">
              <div className="inline-block font-[family-name:var(--cap-font-mono)] text-[0.7rem] uppercase tracking-[0.3em] text-[var(--cap-muted)] border border-dashed border-[var(--cap-border)] px-6 py-3">
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

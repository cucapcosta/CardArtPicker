"use client"

import { useEffect, useState, type ReactNode } from "react"
import { CardPickerProvider, useCardPicker } from "../client/index.js"
import { ListImporter } from "./ListImporter.js"
import { CardGrid } from "./CardGrid.js"
import { OptionsModal } from "./OptionsModal.js"
import styles from "./styles/CardArtPicker.module.css"
import "./styles/theme.css"

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

function Inner({ initialList, slots, onSelectionChange, onError }: Omit<CardArtPickerProps, "apiBase" | "className" | "eagerLoad">) {
  const { list, download, selections, errors } = useCardPicker()
  const [openSlotId, setOpenSlotId] = useState<string | null>(null)
  const notFoundCount = [...list.mainboard, ...list.tokens].filter(s => s.status === "not-found").length

  useEffect(() => { onSelectionChange?.(selections) }, [selections, onSelectionChange])
  useEffect(() => { errors.forEach(e => onError?.(e)) }, [errors, onError])

  return (
    <div className={styles.root}>
      {slots?.header}
      <div style={{ display: "grid", gridTemplateColumns: slots?.sidebar ? "1fr 280px" : "1fr", gap: "2rem" }}>
        <div>
          <div className={styles.toolbar}>
            <button className={styles.arrow} onClick={() => void download()} disabled={Object.keys(selections).length === 0}>
              Download ({Object.keys(selections).length})
            </button>
          </div>
          <ListImporter initialList={initialList ?? ""} />
          {notFoundCount > 0 && (
            <div className={styles.warning}>
              {notFoundCount} card{notFoundCount === 1 ? "" : "s"} not found.
            </div>
          )}
          {list.mainboard.length > 0 && (
            <>
              <h3 className={styles.sectionHeader}>Mainboard ({list.mainboard.length})</h3>
              <CardGrid slots={list.mainboard} onOpenOptions={setOpenSlotId} />
            </>
          )}
          {list.tokens.length > 0 && (
            <>
              <h3 className={styles.sectionHeader}>Tokens ({list.tokens.length})</h3>
              <CardGrid slots={list.tokens} onOpenOptions={setOpenSlotId} />
            </>
          )}
          {openSlotId && <OptionsModal slotId={openSlotId} onClose={() => setOpenSlotId(null)} />}
        </div>
        {slots?.sidebar}
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

"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import type { CardIdentifier, CardOption, ParsedList, Selections, Slot, SourceResult } from "../types.js"

type ListState = { mainboard: Slot[]; tokens: Slot[] }

export type PickerState = {
  apiBase: string
  list: ListState
  parseList: (text: string) => Promise<void>
  getSlot: (slotId: string) => Slot | undefined
  cycleOption: (slotId: string, dir: "next" | "prev") => Promise<void>
  selectOption: (slotId: string, optionId: string) => void
  flipSlot: (slotId: string) => void
  uploadCustom: (slotId: string, file: File) => Promise<void>
  download: () => Promise<void>
  selections: Selections
  loading: boolean
  errors: Error[]
}

const PickerContext = createContext<PickerState | null>(null)

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return res.json() as Promise<T>
}

export function CardPickerProvider({ children, apiBase = "/api/cardartpicker" }: { children: ReactNode; apiBase?: string }) {
  const [list, setList] = useState<ListState>({ mainboard: [], tokens: [] })
  const [errors, setErrors] = useState<Error[]>([])
  const [loading, setLoading] = useState(false)
  const expanded = useRef<Set<string>>(new Set())

  const updateSlot = useCallback((id: string, patch: Partial<Slot>) => {
    setList(prev => {
      const mapper = (s: Slot) => s.id === id ? { ...s, ...patch } : s
      return { mainboard: prev.mainboard.map(mapper), tokens: prev.tokens.map(mapper) }
    })
  }, [])

  const parseList = useCallback(async (text: string) => {
    setLoading(true)
    expanded.current.clear()
    try {
      const parsed = await getJson<ParsedList>(`${apiBase}/parse`, {
        method: "POST", body: JSON.stringify({ text }),
        headers: { "Content-Type": "application/json" },
      })
      const build = (lines: ParsedList["mainboard"], section: "mainboard" | "tokens") =>
        lines.flatMap((line, lineIdx) =>
          Array.from({ length: line.quantity }, (_, i): Slot => {
            const identifier: CardIdentifier = line.setHint
              ? { name: line.name, type: line.type, setHint: line.setHint }
              : { name: line.name, type: line.type }
            return {
              id: `${section}-${lineIdx}-${i}`,
              section, cardName: line.name, quantity: 1,
              identifier,
              options: [], selectedOptionId: null, flipped: false,
              status: "loading", sourceErrors: [],
            }
          }))
      const mainboard = build(parsed.mainboard, "mainboard")
      const tokens = build(parsed.tokens, "tokens")
      setList({ mainboard, tokens })

      const allSlots = [...mainboard, ...tokens]
      await Promise.all(allSlots.map(async s => {
        try {
          const params = new URLSearchParams({ name: s.cardName, type: s.identifier.type })
          const opt = await getJson<CardOption>(`${apiBase}/default?${params}`)
          updateSlot(s.id, { options: [opt], selectedOptionId: opt.id, status: "ready" })
        } catch {
          updateSlot(s.id, { status: "not-found" })
        }
      }))
    } catch (e) {
      setErrors(es => [...es, e as Error])
    } finally { setLoading(false) }
  }, [apiBase, updateSlot])

  const expandOptions = useCallback(async (slot: Slot) => {
    if (expanded.current.has(slot.id)) return
    expanded.current.add(slot.id)
    const params = new URLSearchParams({ name: slot.cardName, type: slot.identifier.type })
    try {
      const results = await getJson<SourceResult[]>(`${apiBase}/options?${params}`)
      const allOptions = results.flatMap(r => r.ok ? r.options : [])
      const sourceErrors = results.flatMap(r => r.ok ? [] : [{ source: r.source, message: r.error.message }])
      const nextStatus: Slot["status"] = allOptions.length === 0 ? "not-found" : sourceErrors.length > 0 ? "partial" : "ready"
      updateSlot(slot.id, {
        options: allOptions,
        selectedOptionId: slot.selectedOptionId ?? allOptions[0]?.id ?? null,
        status: nextStatus, sourceErrors,
      })
    } catch (e) {
      updateSlot(slot.id, { status: "error" })
      setErrors(es => [...es, e as Error])
    }
  }, [apiBase, updateSlot])

  const cycleOption = useCallback(async (slotId: string, dir: "next" | "prev") => {
    const slot = [...list.mainboard, ...list.tokens].find(s => s.id === slotId)
    if (!slot) return
    await expandOptions(slot)
    setList(prev => {
      const mapper = (s: Slot): Slot => {
        if (s.id !== slotId || s.options.length === 0) return s
        const i = s.options.findIndex(o => o.id === s.selectedOptionId)
        const nextIdx = dir === "next" ? (i + 1) % s.options.length : (i - 1 + s.options.length) % s.options.length
        const nextOpt = s.options[nextIdx]
        if (!nextOpt) return s
        return { ...s, selectedOptionId: nextOpt.id }
      }
      return { mainboard: prev.mainboard.map(mapper), tokens: prev.tokens.map(mapper) }
    })
  }, [list, expandOptions])

  const selectOption = useCallback((slotId: string, optionId: string) => {
    updateSlot(slotId, { selectedOptionId: optionId })
  }, [updateSlot])

  const flipSlot = useCallback((slotId: string) => {
    const slot = [...list.mainboard, ...list.tokens].find(s => s.id === slotId)
    if (!slot) return
    updateSlot(slotId, { flipped: !slot.flipped })
  }, [list, updateSlot])

  const getSlot = useCallback((slotId: string): Slot | undefined => {
    return [...list.mainboard, ...list.tokens].find(s => s.id === slotId)
  }, [list])

  const uploadCustom = useCallback(async (slotId: string, file: File) => {
    const form = new FormData()
    form.append("file", file)
    form.append("cardName", getSlot(slotId)?.cardName ?? "")
    form.append("slotId", slotId)
    const res = await fetch(`${apiBase}/upload`, { method: "POST", body: form })
    if (!res.ok) throw new Error(`upload ${res.status}`)
    const option = (await res.json()) as CardOption
    const slot = getSlot(slotId)
    if (!slot) return
    updateSlot(slotId, {
      options: [...slot.options, option],
      selectedOptionId: option.id,
      status: "ready",
    })
  }, [apiBase, getSlot, updateSlot])

  const download = useCallback(async () => {
    const all = [...list.mainboard, ...list.tokens]
    const selections = all
      .filter(s => s.selectedOptionId)
      .map(s => ({ slotId: s.id, optionId: s.selectedOptionId!, quantity: 1 }))
    const options = Object.fromEntries(all.flatMap(s => s.options.map(o => [o.id, o] as const)))
    const res = await fetch(`${apiBase}/download`, {
      method: "POST",
      body: JSON.stringify({ selections, options }),
      headers: { "Content-Type": "application/json" },
    })
    if (!res.ok) throw new Error(`download ${res.status}`)
    const blob = await res.blob()
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "proxies.zip"
    a.click()
    URL.revokeObjectURL(a.href)
  }, [apiBase, list])

  const selections: Selections = useMemo(() => {
    const entries = [...list.mainboard, ...list.tokens]
      .filter(s => s.selectedOptionId)
      .map(s => [s.id, s.selectedOptionId!] as const)
    return Object.fromEntries(entries)
  }, [list])

  const value: PickerState = {
    apiBase, list, parseList, getSlot, cycleOption, selectOption, flipSlot,
    uploadCustom, download, selections, loading, errors,
  }

  return <PickerContext.Provider value={value}>{children}</PickerContext.Provider>
}

export function usePickerContext(): PickerState {
  const ctx = useContext(PickerContext)
  if (!ctx) throw new Error("useCardPicker must be used within <CardPickerProvider>")
  return ctx
}

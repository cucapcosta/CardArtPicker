"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { CardIdentifier, CardOption, CardType, ParsedList, Selections, Slot, SourceResult } from "../types.js"

type ListState = { mainboard: Slot[]; tokens: Slot[] }
type Progress = { loaded: number; total: number }

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
  optionsProgress: Progress | null
  imageProgress: Progress | null
  errors: Error[]
}

const PickerContext = createContext<PickerState | null>(null)

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return res.json() as Promise<T>
}

const nameKey = (type: CardType, name: string) => `${type}:${name.toLowerCase()}`

async function runWithLimit<T>(items: T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      const item = items[idx]
      if (item !== undefined) await fn(item)
    }
  })
  await Promise.all(workers)
}

export function CardPickerProvider({ children, apiBase = "/api/cardartpicker" }: { children: ReactNode; apiBase?: string }) {
  const [list, setList] = useState<ListState>({ mainboard: [], tokens: [] })
  const [errors, setErrors] = useState<Error[]>([])
  const [loading, setLoading] = useState(false)
  const [optionsProgress, setOptionsProgress] = useState<Progress | null>(null)
  const [imageProgress, setImageProgress] = useState<Progress | null>(null)
  const expandPromises = useRef<Map<string, Promise<void>>>(new Map())
  const warmedUrls = useRef<Set<string>>(new Set())

  const proxyUrl = useCallback((url: string): string => {
    if (!url) return url
    if (url.startsWith("data:") || url.startsWith("blob:")) return url
    if (url.startsWith(apiBase)) return url
    return `${apiBase}/img?u=${encodeURIComponent(url)}`
  }, [apiBase])

  const proxyOption = useCallback((opt: CardOption): CardOption => ({
    ...opt,
    imageUrl: proxyUrl(opt.imageUrl),
    ...(opt.thumbnailUrl ? { thumbnailUrl: proxyUrl(opt.thumbnailUrl) } : {}),
    ...(opt.backImageUrl ? { backImageUrl: proxyUrl(opt.backImageUrl) } : {}),
  }), [proxyUrl])

  const updateSlot = useCallback((id: string, patch: Partial<Slot>) => {
    setList(prev => {
      const mapper = (s: Slot) => s.id === id ? { ...s, ...patch } : s
      return { mainboard: prev.mainboard.map(mapper), tokens: prev.tokens.map(mapper) }
    })
  }, [])

  const expandByName = useCallback((type: CardType, name: string): Promise<void> => {
    const key = nameKey(type, name)
    const inflight = expandPromises.current.get(key)
    if (inflight) return inflight
    const promise = (async () => {
      const params = new URLSearchParams({ name, type })
      const results = await getJson<SourceResult[]>(`${apiBase}/options?${params}`)
      const allOptionsRaw = results.flatMap(r => r.ok ? r.options : [])
      const allOptions = allOptionsRaw.map(proxyOption)
      const sourceErrors = results.flatMap(r => r.ok ? [] : [{ source: r.source, message: r.error.message }])
      const nextStatus: Slot["status"] =
        allOptions.length === 0 ? "not-found" : sourceErrors.length > 0 ? "partial" : "ready"
      setList(prev => {
        const mapper = (s: Slot): Slot => {
          if (s.identifier.type !== type || s.cardName.toLowerCase() !== name.toLowerCase()) return s
          return {
            ...s,
            options: allOptions,
            selectedOptionId: s.selectedOptionId ?? allOptions[0]?.id ?? null,
            status: nextStatus,
            sourceErrors,
          }
        }
        return { mainboard: prev.mainboard.map(mapper), tokens: prev.tokens.map(mapper) }
      })
      const thumbs = allOptions
        .map(o => o.thumbnailUrl ?? o.imageUrl)
        .filter((u): u is string => Boolean(u) && !warmedUrls.current.has(u))
      if (thumbs.length > 0) {
        for (const u of thumbs) warmedUrls.current.add(u)
        setImageProgress(p => ({ loaded: p?.loaded ?? 0, total: (p?.total ?? 0) + thumbs.length }))
        void runWithLimit(thumbs, 6, async u => {
          try { await fetch(u, { cache: "force-cache" }) } catch {}
          setImageProgress(p => p ? { loaded: p.loaded + 1, total: p.total } : p)
        })
      }
    })().catch(e => {
      expandPromises.current.delete(key)
      throw e
    })
    expandPromises.current.set(key, promise)
    return promise
  }, [apiBase])

  const parseList = useCallback(async (text: string) => {
    setLoading(true)
    setOptionsProgress(null)
    setImageProgress(null)
    expandPromises.current.clear()
    warmedUrls.current.clear()
    let kicked: Slot[] = []
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
      kicked = allSlots
      await Promise.all(allSlots.map(async s => {
        try {
          const params = new URLSearchParams({ name: s.cardName, type: s.identifier.type })
          const raw = await getJson<CardOption>(`${apiBase}/default?${params}`)
          const opt = proxyOption(raw)
          updateSlot(s.id, { options: [opt], selectedOptionId: opt.id, status: "ready" })
        } catch {
          updateSlot(s.id, { status: "not-found" })
        }
      }))
    } catch (e) {
      setErrors(es => [...es, e as Error])
    } finally {
      setLoading(false)
    }

    if (kicked.length === 0) return
    const groups = new Map<string, { type: CardType; name: string }>()
    for (const s of kicked) {
      const k = nameKey(s.identifier.type, s.cardName)
      if (!groups.has(k)) groups.set(k, { type: s.identifier.type, name: s.cardName })
    }
    const work = [...groups.values()]
    setOptionsProgress({ loaded: 0, total: work.length })
    void runWithLimit(work, 4, async g => {
      try { await expandByName(g.type, g.name) } catch (e) { setErrors(es => [...es, e as Error]) }
      setOptionsProgress(p => p ? { loaded: p.loaded + 1, total: p.total } : p)
    }).then(() => setOptionsProgress(null))
  }, [apiBase, updateSlot, expandByName, proxyOption])

  const cycleOption = useCallback(async (slotId: string, dir: "next" | "prev") => {
    const slot = [...list.mainboard, ...list.tokens].find(s => s.id === slotId)
    if (!slot) return
    try { await expandByName(slot.identifier.type, slot.cardName) } catch { return }
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
  }, [list, expandByName])

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

  useEffect(() => {
    if (imageProgress && optionsProgress === null && imageProgress.loaded >= imageProgress.total) {
      const t = setTimeout(() => setImageProgress(null), 600)
      return () => clearTimeout(t)
    }
    return undefined
  }, [imageProgress, optionsProgress])

  const value: PickerState = {
    apiBase, list, parseList, getSlot, cycleOption, selectOption, flipSlot,
    uploadCustom, download, selections, loading, optionsProgress, imageProgress, errors,
  }

  return <PickerContext.Provider value={value}>{children}</PickerContext.Provider>
}

export function usePickerContext(): PickerState {
  const ctx = useContext(PickerContext)
  if (!ctx) throw new Error("useCardPicker must be used within <CardPickerProvider>")
  return ctx
}

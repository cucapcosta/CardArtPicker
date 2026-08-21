"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { CardIdentifier, CardOption, CardType, ParsedList, Selections, Slot, SourceResult } from "../types.js"

type ListState = { mainboard: Slot[]; tokens: Slot[] }
type Progress = { loaded: number; total: number }

const PAGE_SIZE = 100

export type PickerState = {
  apiBase: string
  list: ListState
  parseList: (text: string) => Promise<void>
  getSlot: (slotId: string) => Slot | undefined
  cycleOption: (slotId: string, dir: "next" | "prev") => Promise<void>
  selectOption: (slotId: string, optionId: string) => void
  flipSlot: (slotId: string) => void
  loadMoreOptions: (slotId: string) => Promise<void>
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
const pageKey = (type: CardType, name: string, page: number) => `${nameKey(type, name)}:${page}`

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

export function CardPickerProvider({ children, apiBase = "/api/cardartpicker", eagerLoad = false }: { children: ReactNode; apiBase?: string; eagerLoad?: boolean | undefined }) {
  const [list, setList] = useState<ListState>({ mainboard: [], tokens: [] })
  const [errors, setErrors] = useState<Error[]>([])
  const [loading, setLoading] = useState(false)
  const [optionsProgress, setOptionsProgress] = useState<Progress | null>(null)
  const [imageProgress, setImageProgress] = useState<Progress | null>(null)
  const expandPromises = useRef<Map<string, Promise<void>>>(new Map())
  // Pages fetched per card (keyed by nameKey). The next page to request is this counter,
  // NOT options.length / PAGE_SIZE: the server offset applies per source, while
  // options.length merges every source, so deriving it from length skips pages
  // whenever more than one source is configured.
  const loadedPages = useRef<Map<string, number>>(new Map())
  const warmedUrls = useRef<Set<string>>(new Set())
  const stateRef = useRef<ListState>({ mainboard: [], tokens: [] })
  // Sync during render (idempotent) so children's effects in the same commit see the
  // current list — an effect-based sync runs after child effects and hands them stale state.
  stateRef.current = list

  const proxyOption = useCallback((opt: CardOption): CardOption => opt, [])

  const updateSlot = useCallback((id: string, patch: Partial<Slot>) => {
    setList(prev => {
      const mapper = (s: Slot) => s.id === id ? { ...s, ...patch } : s
      return { mainboard: prev.mainboard.map(mapper), tokens: prev.tokens.map(mapper) }
    })
  }, [])

  const expandPage = useCallback((type: CardType, name: string, page: number): Promise<void> => {
    const key = pageKey(type, name, page)
    const inflight = expandPromises.current.get(key)
    if (inflight) return inflight
    const promise = (async () => {
      const offset = page * PAGE_SIZE
      const params = new URLSearchParams({ name, type, offset: String(offset), limit: String(PAGE_SIZE) })
      const results = await getJson<SourceResult[]>(`${apiBase}/options?${params}`)
      const newOptionsRaw = results.flatMap(r => r.ok ? r.options : [])
      const newOptions = newOptionsRaw.map(proxyOption)
      const sourceErrors = results.flatMap(r => r.ok ? [] : [{ source: r.source, message: r.error.message }])
      const total = results.reduce((sum, r) => sum + (r.ok ? r.total : 0), 0)
      const hasMore = results.some(r => r.ok && r.hasMore)

      const nk = nameKey(type, name)
      loadedPages.current.set(nk, Math.max(loadedPages.current.get(nk) ?? 0, page + 1))

      setList(prev => {
        const mapper = (s: Slot): Slot => {
          if (s.identifier.type !== type || s.cardName.toLowerCase() !== name.toLowerCase()) return s
          // Page 0 replaces the provisional default-only list, but the selected option
          // (e.g. a batched default print beyond the first page) must survive the swap.
          const kept = page === 0
            ? s.options.filter(o => o.id === s.selectedOptionId && !newOptions.some(n => n.id === o.id))
            : s.options
          const merged = [...kept, ...newOptions]
          const seen = new Set<string>()
          const deduped = merged.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true })
          const status: Slot["status"] =
            deduped.length === 0 ? "not-found" : sourceErrors.length > 0 ? "partial" : "ready"
          return {
            ...s,
            options: deduped,
            selectedOptionId: s.selectedOptionId ?? deduped[0]?.id ?? null,
            totalOptions: total,
            hasMoreOptions: hasMore,
            status,
            sourceErrors,
          }
        }
        return { mainboard: prev.mainboard.map(mapper), tokens: prev.tokens.map(mapper) }
      })

      const thumbs = newOptions
        .slice(0, 12)
        .map(o => o.thumbnailUrl ?? o.imageUrl)
        .filter((u): u is string => Boolean(u) && !warmedUrls.current.has(u))
      if (thumbs.length > 0) {
        for (const u of thumbs) warmedUrls.current.add(u)
        setImageProgress(p => ({ loaded: p?.loaded ?? 0, total: (p?.total ?? 0) + thumbs.length }))
        void runWithLimit(thumbs, 4, async u => {
          await new Promise<void>(resolve => {
            const img = new Image()
            const done = () => resolve()
            img.onload = done
            img.onerror = done
            img.src = u
          })
          setImageProgress(p => p ? { loaded: p.loaded + 1, total: p.total } : p)
        })
      }
    })().catch(e => {
      expandPromises.current.delete(key)
      throw e
    })
    expandPromises.current.set(key, promise)
    return promise
  }, [apiBase, proxyOption])

  const parseList = useCallback(async (text: string) => {
    setLoading(true)
    setOptionsProgress(null)
    setImageProgress(null)
    expandPromises.current.clear()
    loadedPages.current.clear()
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
              totalOptions: 0, hasMoreOptions: false,
            }
          }))
      const mainboard = build(parsed.mainboard, "mainboard")
      const tokens = build(parsed.tokens, "tokens")
      setList({ mainboard, tokens })

      const allSlots = [...mainboard, ...tokens]
      kicked = allSlots
      const unique = new Map<string, { name: string; type: CardType; setHint?: string }>()
      for (const s of allSlots) {
        const k = nameKey(s.identifier.type, s.cardName)
        if (!unique.has(k)) {
          const { setHint } = s.identifier
          unique.set(k, { name: s.cardName, type: s.identifier.type, ...(setHint ? { setHint } : {}) })
        }
      }
      // Defaults are requested in chunks and applied as each chunk resolves, so early
      // cards render while slow ones (source fallbacks, retries) are still in flight —
      // one big request kept the whole grid on "loading" until the slowest card finished.
      const cards = [...unique.values()]
      const DEFAULTS_CHUNK = 60
      const chunks: (typeof cards)[] = []
      for (let i = 0; i < cards.length; i += DEFAULTS_CHUNK) chunks.push(cards.slice(i, i + DEFAULTS_CHUNK))
      let defaultsFailed = false
      await runWithLimit(chunks, 3, async chunk => {
        try {
          const defaults = await getJson<Record<string, CardOption | null>>(`${apiBase}/defaults`, {
            method: "POST",
            body: JSON.stringify({ cards: chunk }),
            headers: { "Content-Type": "application/json" },
          })
          setList(prev => {
            const mapper = (s: Slot): Slot => {
              const raw = defaults[nameKey(s.identifier.type, s.cardName)]
              if (raw === undefined) return s
              if (raw === null) return { ...s, status: "not-found" }
              const opt = proxyOption(raw)
              return { ...s, options: [opt], selectedOptionId: opt.id, status: "ready", totalOptions: 1, hasMoreOptions: true }
            }
            return { mainboard: prev.mainboard.map(mapper), tokens: prev.tokens.map(mapper) }
          })
        } catch (e) {
          defaultsFailed = true
          setErrors(es => [...es, e as Error])
        }
      })
      if (defaultsFailed) {
        setList(prev => {
          const mapper = (s: Slot): Slot => s.status === "loading" ? { ...s, status: "not-found" } : s
          return { mainboard: prev.mainboard.map(mapper), tokens: prev.tokens.map(mapper) }
        })
      }
    } catch (e) {
      setErrors(es => [...es, e as Error])
      setList(prev => {
        const mapper = (s: Slot): Slot => s.status === "loading" ? { ...s, status: "not-found" } : s
        return { mainboard: prev.mainboard.map(mapper), tokens: prev.tokens.map(mapper) }
      })
    } finally {
      setLoading(false)
    }

    if (!eagerLoad || kicked.length === 0) return
    const groups = new Map<string, { type: CardType; name: string }>()
    for (const s of kicked) {
      const k = nameKey(s.identifier.type, s.cardName)
      if (!groups.has(k)) groups.set(k, { type: s.identifier.type, name: s.cardName })
    }
    const work = [...groups.values()]
    setOptionsProgress({ loaded: 0, total: work.length })
    void runWithLimit(work, 4, async g => {
      try { await expandPage(g.type, g.name, 0) } catch (e) { setErrors(es => [...es, e as Error]) }
      setOptionsProgress(p => p ? { loaded: p.loaded + 1, total: p.total } : p)
    }).then(() => setOptionsProgress(null))
  }, [apiBase, expandPage, proxyOption, eagerLoad])

  const cycleOption = useCallback(async (slotId: string, dir: "next" | "prev") => {
    const ref = stateRef.current
    const slot = [...ref.mainboard, ...ref.tokens].find(s => s.id === slotId)
    if (!slot) return
    try { await expandPage(slot.identifier.type, slot.cardName, 0) } catch { return }

    const after = stateRef.current
    const cur = [...after.mainboard, ...after.tokens].find(s => s.id === slotId) ?? slot
    const i = cur.options.findIndex(o => o.id === cur.selectedOptionId)
    const tentativeNext = dir === "next" ? i + 1 : i - 1
    // totalOptions > options.length distinguishes "server really has more" from the
    // unexpanded placeholder (total 1, hasMore true) — don't prefetch off the placeholder.
    if (dir === "next" && tentativeNext >= cur.options.length && cur.hasMoreOptions && cur.totalOptions > cur.options.length) {
      const nextPage = loadedPages.current.get(nameKey(cur.identifier.type, cur.cardName)) ?? 0
      try { await expandPage(cur.identifier.type, cur.cardName, nextPage) } catch {}
    }

    setList(prev => {
      const mapper = (s: Slot): Slot => {
        if (s.id !== slotId || s.options.length === 0) return s
        const idx = s.options.findIndex(o => o.id === s.selectedOptionId)
        const nextIdx = dir === "next" ? (idx + 1) % s.options.length : (idx - 1 + s.options.length) % s.options.length
        const nextOpt = s.options[nextIdx]
        if (!nextOpt) return s
        return { ...s, selectedOptionId: nextOpt.id }
      }
      return { mainboard: prev.mainboard.map(mapper), tokens: prev.tokens.map(mapper) }
    })
  }, [expandPage])

  const loadMoreOptions = useCallback(async (slotId: string) => {
    const slot = [...stateRef.current.mainboard, ...stateRef.current.tokens].find(s => s.id === slotId)
    if (!slot || !slot.hasMoreOptions) return
    const nextPage = loadedPages.current.get(nameKey(slot.identifier.type, slot.cardName)) ?? 0
    try { await expandPage(slot.identifier.type, slot.cardName, nextPage) }
    catch (e) { setErrors(es => [...es, e as Error]) }
  }, [expandPage])

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
    loadMoreOptions, uploadCustom, download, selections, loading, optionsProgress, imageProgress, errors,
  }

  return <PickerContext.Provider value={value}>{children}</PickerContext.Provider>
}

export function usePickerContext(): PickerState {
  const ctx = useContext(PickerContext)
  if (!ctx) throw new Error("useCardPicker must be used within <CardPickerProvider>")
  return ctx
}

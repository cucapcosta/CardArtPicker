import type { CardIdentifier, CardOption, Source, SourcePage, SourcePageOptions } from "../types.js"
import { defineSource } from "./index.js"
import { withRetry } from "../retry.js"

type MpcSource = { pk: number; key: string; name: string; description: string; sourceType: string; externalLink: string }
type SearchResponse = { results: Record<string, Record<string, string[]>> }
type CardsResponse = {
  results: Record<string, {
    identifier: string; name: string; priority: number; source: number
    source_name: string; source_verbose: string; dpi: number; language: string; tags: string[]
  }>
}

export type MpcFillOptions = {
  baseUrl?: string
  sourceFilter?: number[]
}

const IDS_TTL_MS = 60 * 60 * 1000
const IDS_MAX = 200

export function createMpcFill(opts: MpcFillOptions = {}): Source {
  const baseUrl = opts.baseUrl ?? "https://mpcfill.com"
  let sourcesCache: MpcSource[] | null = null

  type IdsEntry = { ids: string[]; expiresAt: number }
  const idsCache = new Map<string, IdsEntry>()
  const idsInflight = new Map<string, Promise<string[]>>()

  function evictIds() {
    while (idsCache.size > IDS_MAX) {
      const first = idsCache.keys().next().value
      if (first === undefined) break
      idsCache.delete(first)
    }
  }

  function idsKey(id: CardIdentifier): string {
    return `${id.type}:${id.name.toLowerCase()}`
  }

  async function loadSources(): Promise<MpcSource[]> {
    if (sourcesCache) return sourcesCache
    const res = await fetch(`${baseUrl}/2/sources/`, { headers: { Accept: "application/json" } })
    if (!res.ok) throw new Error(`MPC Fill /sources/ ${res.status}`)
    const body = (await res.json()) as { results: Record<string, MpcSource> }
    sourcesCache = Object.values(body.results)
    return sourcesCache
  }

  async function search(id: CardIdentifier, sourcePKs: number[]): Promise<string[]> {
    const res = await fetch(`${baseUrl}/2/editorSearch/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchSettings: {
          searchTypeSettings: { fuzzySearch: false, filterCardbacks: false },
          sourceSettings: { sources: sourcePKs.map(pk => [pk, true]) },
          filterSettings: { minimumDPI: 0, maximumDPI: 1500, maximumSize: 30, languages: [], includesTags: [], excludesTags: [] },
        },
        queries: [{ query: id.name.toLowerCase(), cardType: id.type === "token" ? "TOKEN" : "CARD" }],
      }),
    })
    if (!res.ok) throw new Error(`MPC Fill /editorSearch/ ${res.status}: ${await res.text()}`)
    const body = (await res.json()) as SearchResponse
    const byType = body.results[id.name.toLowerCase()] ?? {}
    const typeKey = id.type === "token" ? "TOKEN" : "CARD"
    return byType[typeKey] ?? []
  }

  async function getIds(id: CardIdentifier): Promise<string[]> {
    const k = idsKey(id)
    const hit = idsCache.get(k)
    const now = Date.now()
    if (hit && hit.expiresAt > now) {
      idsCache.delete(k); idsCache.set(k, hit)
      return hit.ids
    }
    const existing = idsInflight.get(k)
    if (existing) return existing
    const promise = (async () => {
      try {
        const ids = await withRetry(async () => {
          const allSources = await loadSources()
          const pks = opts.sourceFilter ?? allSources.map(s => s.pk)
          return search(id, pks)
        }, { attempts: 3, baseDelayMs: 300 })
        idsCache.set(k, { ids, expiresAt: Date.now() + IDS_TTL_MS })
        evictIds()
        return ids
      } finally {
        idsInflight.delete(k)
      }
    })()
    idsInflight.set(k, promise)
    return promise
  }

  const HYDRATE_BATCH = 1000

  async function hydrateBatch(ids: string[]): Promise<CardsResponse["results"]> {
    const res = await fetch(`${baseUrl}/2/cards/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardIdentifiers: ids }),
    })
    if (!res.ok) throw new Error(`MPC Fill /cards/ ${res.status}: ${await res.text()}`)
    const body = (await res.json()) as CardsResponse
    return body.results
  }

  async function hydrate(ids: string[]): Promise<CardOption[]> {
    if (ids.length === 0) return []
    const batches: string[][] = []
    for (let i = 0; i < ids.length; i += HYDRATE_BATCH) batches.push(ids.slice(i, i + HYDRATE_BATCH))
    const results = await Promise.all(batches.map(hydrateBatch))
    const merged: CardsResponse["results"] = Object.assign({}, ...results)
    return ids.flatMap(id => {
      const c = merged[id]
      if (!c) return []
      return [{
        id: `mpcfill:${c.identifier}`,
        sourceName: "MPC Fill",
        cardName: c.name,
        imageUrl: `https://drive.google.com/thumbnail?id=${c.identifier}&sz=w1600`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${c.identifier}&sz=w400`,
        meta: { dpi: c.dpi, language: c.language, tags: c.tags },
      }]
    })
  }

  return defineSource({
    name: "MPC Fill",
    async getOptions(id: CardIdentifier, pageOpts: SourcePageOptions = {}): Promise<SourcePage> {
      const ids = await getIds(id)
      const offset = Math.max(0, pageOpts.offset ?? 0)
      const limit = Math.max(1, pageOpts.limit ?? ids.length)
      const slice = ids.slice(offset, offset + limit)
      const options = await withRetry(() => hydrate(slice), { attempts: 3, baseDelayMs: 300 })
      return { options, total: ids.length, hasMore: offset + slice.length < ids.length }
    },
  })
}

export const mpcFill: Source = createMpcFill()

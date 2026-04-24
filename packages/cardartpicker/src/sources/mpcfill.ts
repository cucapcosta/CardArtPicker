import type { CardIdentifier, CardOption, Source } from "../types.js"
import { defineSource } from "./index.js"

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

export function createMpcFill(opts: MpcFillOptions = {}): Source {
  const baseUrl = opts.baseUrl ?? "https://mpcfill.com"
  let sourcesCache: MpcSource[] | null = null

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
          sourceSettings: { sources: sourcePKs },
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

  async function hydrate(ids: string[]): Promise<CardOption[]> {
    if (ids.length === 0) return []
    const res = await fetch(`${baseUrl}/2/cards/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardIdentifiers: ids }),
    })
    if (!res.ok) throw new Error(`MPC Fill /cards/ ${res.status}`)
    const body = (await res.json()) as CardsResponse
    return ids.flatMap(id => {
      const c = body.results[id]
      if (!c) return []
      return [{
        id: `mpcfill:${c.identifier}`,
        sourceName: "MPC Fill",
        cardName: c.name,
        imageUrl: `${baseUrl}/2/image/${c.identifier}/`,
        meta: { dpi: c.dpi, language: c.language, tags: c.tags },
      }]
    })
  }

  return defineSource({
    name: "MPC Fill",
    async getOptions(id) {
      const allSources = await loadSources()
      const pks = opts.sourceFilter ?? allSources.map(s => s.pk)
      const ids = await search(id, pks)
      return hydrate(ids)
    },
  })
}

export const mpcFill: Source = createMpcFill()

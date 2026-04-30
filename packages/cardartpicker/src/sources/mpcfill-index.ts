import type { CardIdentifier, CardOption, Source, SourcePage, SourcePageOptions } from "../types.js"
import { defineSource } from "./index.js"

export type MpcFillIndexEntry = {
  i: string
  n: string
  s?: number
  sn?: string
  d?: number
  l?: string
  t?: string[]
}

export type MpcFillIndexFile = {
  v: string
  sources?: Record<string, { name?: string; verbose?: string }>
  card?: Record<string, MpcFillIndexEntry[]>
  token?: Record<string, MpcFillIndexEntry[]>
}

export type MpcFillIndexOptions = {
  indexUrl?: string
  index?: MpcFillIndexFile
  sourceFilter?: number[]
  fetchInit?: RequestInit
  /** Auto-poll the indexUrl every N ms with If-Modified-Since. 0/undefined = disabled. */
  refreshMs?: number
  /** Optional hook invoked when the cache is replaced with a newer index. */
  onRefresh?: (info: { lastModified: string | null; bytes: number }) => void
}

export type MpcFillIndexSource = Source & {
  /** Force a refetch. Returns true if cache was replaced with a newer body. */
  refresh: () => Promise<boolean>
  /** Stop the refresh timer (if refreshMs was set). */
  dispose: () => void
}

function entryToOption(e: MpcFillIndexEntry, fallbackName: string): CardOption {
  const meta: CardOption["meta"] = {}
  if (e.d !== undefined) meta.dpi = e.d
  if (e.l) meta.language = e.l
  if (e.t && e.t.length) meta.tags = e.t
  return {
    id: `mpcfill:${e.i}`,
    sourceName: "MPC Fill",
    cardName: e.n || fallbackName,
    imageUrl: `https://drive.google.com/thumbnail?id=${e.i}&sz=w1600`,
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${e.i}&sz=w400`,
    meta,
  }
}

function lowerBucket(m: Record<string, MpcFillIndexEntry[]> | undefined): Record<string, MpcFillIndexEntry[]> | undefined {
  if (!m) return m
  const out: Record<string, MpcFillIndexEntry[]> = {}
  for (const k of Object.keys(m)) {
    const lk = k.toLowerCase()
    const cur = out[lk]
    const next = m[k]!
    out[lk] = cur ? cur.concat(next) : next
  }
  return out
}

function normalizeBuckets(file: MpcFillIndexFile): MpcFillIndexFile {
  const out: MpcFillIndexFile = { v: file.v }
  if (file.sources) out.sources = file.sources
  const card = lowerBucket(file.card)
  if (card) out.card = card
  const token = lowerBucket(file.token)
  if (token) out.token = token
  return out
}

export function createMpcFillIndex(opts: MpcFillIndexOptions): MpcFillIndexSource {
  let cached: MpcFillIndexFile | null = opts.index ? normalizeBuckets(opts.index) : null
  let lastModified: string | null = null
  let inflight: Promise<MpcFillIndexFile> | null = null
  let refreshInflight: Promise<boolean> | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  async function fetchAndApply(): Promise<{ replaced: boolean; body?: MpcFillIndexFile; bytes?: number }> {
    if (!opts.indexUrl) throw new Error("mpcFillIndex: provide opts.index or opts.indexUrl")
    const headers = new Headers(opts.fetchInit?.headers)
    if (lastModified) headers.set("If-Modified-Since", lastModified)
    const res = await fetch(opts.indexUrl, { ...opts.fetchInit, headers })
    if (res.status === 304) return { replaced: false }
    if (!res.ok) throw new Error(`mpcFillIndex fetch ${res.status}`)
    const text = await res.text()
    const body = normalizeBuckets(JSON.parse(text) as MpcFillIndexFile)
    cached = body
    lastModified = res.headers.get("Last-Modified")
    return { replaced: true, body, bytes: text.length }
  }

  async function loadIndex(): Promise<MpcFillIndexFile> {
    if (cached) return cached
    if (inflight) return inflight
    inflight = (async () => {
      const r = await fetchAndApply()
      return r.body ?? cached!
    })()
    try { return await inflight } finally { inflight = null }
  }

  async function refresh(): Promise<boolean> {
    if (!opts.indexUrl) return false
    if (refreshInflight) return refreshInflight
    refreshInflight = (async () => {
      try {
        const r = await fetchAndApply()
        if (r.replaced) opts.onRefresh?.({ lastModified, bytes: r.bytes ?? 0 })
        return r.replaced
      } finally {
        refreshInflight = null
      }
    })()
    return refreshInflight
  }

  if (opts.refreshMs && opts.refreshMs > 0 && opts.indexUrl) {
    timer = setInterval(() => { void refresh().catch(() => {}) }, opts.refreshMs)
    if (typeof timer === "object" && timer && "unref" in timer) (timer as { unref: () => void }).unref()
  }

  const filterPks = opts.sourceFilter
  const filterFn = filterPks
    ? (e: MpcFillIndexEntry) => e.s === undefined || filterPks.includes(e.s)
    : null

  const base = defineSource({
    name: "MPC Fill",
    async getOptions(id: CardIdentifier, page: SourcePageOptions = {}): Promise<SourcePage> {
      const idx = await loadIndex()
      const map = id.type === "token" ? idx.token : idx.card
      const all = map?.[id.name.toLowerCase()] ?? []
      const filtered = filterFn ? all.filter(filterFn) : all
      const offset = Math.max(0, page.offset ?? 0)
      const limit = Math.max(1, page.limit ?? (filtered.length || 1))
      const slice = filtered.slice(offset, offset + limit)
      const options = slice.map(e => entryToOption(e, id.name))
      return { options, total: filtered.length, hasMore: offset + slice.length < filtered.length }
    },
  })

  return Object.assign(base, {
    refresh,
    dispose() { if (timer) { clearInterval(timer); timer = null } },
  })
}

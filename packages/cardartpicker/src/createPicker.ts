import pLimit from "p-limit"
import type {
  CacheAdapter, CardIdentifier, CardOption, CardType, Logger, ParsedList,
  Picker, PickerConfig, Selection, Source, SourcePageOptions, SourceResult,
} from "./types.js"
import { parseDeckList } from "./parser/decklist.js"
import { createMemoryCache } from "./cache.js"

const defaultLogger: Logger = (level, event, ctx) => {
  const prefix = "[cardartpicker]"
  if (level === "error") console.error(prefix, event, ctx)
  else if (level === "warn") console.warn(prefix, event, ctx)
  else console.log(prefix, event, ctx)
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "timeout" })), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

export function createPicker(config: PickerConfig): Picker {
  const resolved = {
    cacheTTL: config.cacheTTL ?? 3600,
    sourceTimeoutMs: config.sourceTimeoutMs ?? 10_000,
    parserStrict: config.parserStrict ?? false,
    optionsPageSize: config.optionsPageSize ?? 100,
    ...config,
  }
  const logger = config.logger ?? defaultLogger
  const cache: CacheAdapter = config.cacheBackend ?? createMemoryCache<unknown>({ defaultTtlSeconds: resolved.cacheTTL })

  const NEGATIVE_TTL_SECONDS = 30

  async function runSource(src: Source, id: CardIdentifier, pageOpts: SourcePageOptions): Promise<SourceResult> {
    try {
      const page = await withTimeout(src.getOptions(id, pageOpts), resolved.sourceTimeoutMs)
      return { ok: true, source: src.name, options: page.options, total: page.total, hasMore: page.hasMore }
    } catch (e) {
      const err = e as { code?: string; message?: string }
      const code = err.code ?? "error"
      const message = err.message ?? String(e)
      logger("warn", "source.failure", { source: src.name, code, message })
      return { ok: false, source: src.name, error: { code, message } }
    }
  }

  const fullKey = (src: string, id: CardIdentifier) => `search:${src}:${id.type}:${id.name.toLowerCase()}`
  const pageKey = (src: string, id: CardIdentifier, offset: number, limit: number) =>
    `${fullKey(src, id)}:${offset}:${limit}`

  const inflight = new Map<string, Promise<SourceResult>>()

  async function getSourcePage(src: Source, id: CardIdentifier, offset: number, limit: number): Promise<SourceResult> {
    const full = await cache.get<SourceResult>(fullKey(src.name, id))
    if (full) {
      if (!full.ok) return full
      const slice = full.options.slice(offset, offset + limit)
      return { ok: true, source: src.name, options: slice, total: full.total, hasMore: offset + slice.length < full.total }
    }
    const key = pageKey(src.name, id, offset, limit)
    const cached = await cache.get<SourceResult>(key)
    if (cached) return cached
    const existing = inflight.get(key)
    if (existing) return existing
    const promise = (async () => {
      try {
        const result = await runSource(src, id, { offset, limit })
        if (!result.ok) await cache.set(fullKey(src.name, id), result, NEGATIVE_TTL_SECONDS)
        else if (offset === 0 && !result.hasMore) await cache.set(fullKey(src.name, id), result, resolved.cacheTTL)
        else await cache.set(key, result, resolved.cacheTTL)
        return result
      } finally {
        inflight.delete(key)
      }
    })()
    inflight.set(key, promise)
    return promise
  }

  async function searchCard(id: CardIdentifier, opts: SourcePageOptions = {}): Promise<SourceResult[]> {
    const offset = Math.max(0, opts.offset ?? 0)
    const limit = Math.max(1, opts.limit ?? resolved.optionsPageSize)
    return Promise.all(config.sources.map(s => getSourcePage(s, id, offset, limit)))
  }

  const defaultKey = (id: CardIdentifier) => `${id.type}:${id.name.toLowerCase()}`

  async function getDefaultPrints(ids: CardIdentifier[]): Promise<Record<string, CardOption | null>> {
    const result: Record<string, CardOption | null> = {}
    const pending = new Map<string, CardIdentifier>()
    for (const id of ids) {
      const k = defaultKey(id)
      if (k in result || pending.has(k)) continue
      const cached = await cache.get<CardOption | null>(`default:${k}`)
      if (cached !== undefined) result[k] = cached
      else pending.set(k, id)
    }
    for (const src of config.sources) {
      if (pending.size === 0) break
      const batch = [...pending.values()]
      let hits: Map<string, CardOption>
      if (src.getDefaults) {
        try {
          const batchTimeout = resolved.sourceTimeoutMs * Math.max(1, Math.ceil(batch.length / 75))
          hits = await withTimeout(src.getDefaults(batch), batchTimeout)
        } catch (e) {
          const err = e as { message?: string }
          logger("warn", "source.defaults.failure", { source: src.name, message: err.message ?? String(e) })
          hits = new Map()
        }
      } else {
        hits = new Map()
        const limit = pLimit(6)
        await Promise.all(batch.map(id => limit(async () => {
          const r = await getSourcePage(src, id, 0, 1)
          const first = r.ok ? r.options[0] : undefined
          if (first) hits.set(defaultKey(id), first)
        })))
      }
      for (const [k, hit] of hits) {
        if (!pending.has(k)) continue
        result[k] = hit
        pending.delete(k)
        await cache.set(`default:${k}`, hit, resolved.cacheTTL)
      }
    }
    for (const k of pending.keys()) {
      result[k] = null
      await cache.set(`default:${k}`, null, NEGATIVE_TTL_SECONDS)
    }
    return result
  }

  async function getDefaultPrint(name: string, type: CardType = "card"): Promise<CardOption | null> {
    const map = await getDefaultPrints([{ name, type }])
    return map[`${type}:${name.toLowerCase()}`] ?? null
  }

  function parseList(text: string): ParsedList {
    return parseDeckList(text, { strict: resolved.parserStrict })
  }

  async function buildZip(_selections: Selection[]): Promise<Blob> {
    throw new Error("buildZip not available in this runtime — import from 'cardartpicker/server'")
  }

  async function clearCache(): Promise<void> {
    inflight.clear()
    if (cache.clear) await cache.clear()
  }

  return { config: resolved, searchCard, getDefaultPrint, getDefaultPrints, parseList, buildZip, clearCache }
}

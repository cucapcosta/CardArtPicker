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
  const cache: CacheAdapter = config.cacheBackend ?? createMemoryCache<SourceResult[]>({ defaultTtlSeconds: resolved.cacheTTL })

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

  const inflight = new Map<string, Promise<SourceResult[]>>()

  async function searchCard(id: CardIdentifier, opts: SourcePageOptions = {}): Promise<SourceResult[]> {
    const offset = Math.max(0, opts.offset ?? 0)
    const limit = Math.max(1, opts.limit ?? resolved.optionsPageSize)
    const key = `search:${id.type}:${id.name.toLowerCase()}:${offset}:${limit}`
    const cached = await cache.get<SourceResult[]>(key)
    if (cached) return cached
    const existing = inflight.get(key)
    if (existing) return existing
    const promise = (async () => {
      try {
        const results = await Promise.all(config.sources.map(s => runSource(s, id, { offset, limit })))
        const allOk = results.every(r => r.ok)
        if (allOk) await cache.set(key, results, resolved.cacheTTL)
        return results
      } finally {
        inflight.delete(key)
      }
    })()
    inflight.set(key, promise)
    return promise
  }

  async function getDefaultPrint(name: string, type: CardType = "card"): Promise<CardOption | null> {
    const results = await searchCard({ name, type }, { offset: 0, limit: 1 })
    for (const r of results) {
      if (r.ok && r.options.length > 0) {
        const first = r.options[0]
        if (first) return first
      }
    }
    return null
  }

  function parseList(text: string): ParsedList {
    return parseDeckList(text, { strict: resolved.parserStrict })
  }

  async function buildZip(_selections: Selection[]): Promise<Blob> {
    throw new Error("buildZip not available in this runtime — import from 'cardartpicker/server'")
  }

  return { config: resolved, searchCard, getDefaultPrint, parseList, buildZip }
}

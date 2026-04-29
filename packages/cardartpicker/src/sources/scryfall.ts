import pLimit from "p-limit"
import type { CardIdentifier, CardOption, Source, SourcePage, SourcePageOptions } from "../types.js"
import { defineSource } from "./index.js"
import { withRetry } from "../retry.js"

const scryfallLimit = pLimit(3)

type ScryfallCard = {
  id: string
  name: string
  set?: string
  collector_number?: string
  artist?: string
  lang?: string
  image_uris?: { png?: string; small?: string; normal?: string }
  card_faces?: Array<{ name: string; image_uris?: { png?: string; small?: string } }>
}

function mapCard(card: ScryfallCard): CardOption {
  const front =
    card.card_faces?.[0]?.image_uris?.png ??
    card.image_uris?.png ??
    card.image_uris?.normal ??
    ""
  const back = card.card_faces?.[1]?.image_uris?.png
  const thumb = card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small
  return {
    id: `scryfall:${card.id}`,
    sourceName: "Scryfall",
    cardName: card.name,
    imageUrl: front,
    ...(thumb ? { thumbnailUrl: thumb } : {}),
    ...(back ? { backImageUrl: back } : {}),
    meta: {
      ...(card.set ? { setCode: card.set.toUpperCase() } : {}),
      ...(card.collector_number ? { collectorNumber: card.collector_number } : {}),
      ...(card.artist ? { artist: card.artist } : {}),
      ...(card.lang ? { language: card.lang } : {}),
    },
  }
}

const UA = "cardartpicker/0.1 (+https://github.com/cucapcosta/CardArtPicker)"

class ScryfallError extends Error {
  constructor(public status: number, message: string, public retryAfterMs?: number) {
    super(message)
  }
}

async function fetchScryfallOnce(id: CardIdentifier): Promise<CardOption[]> {
  const exact = `!"${id.name.replace(/"/g, "")}"`
  const q = id.type === "token" ? `${exact} layout:token` : exact
  const url = `https://api.scryfall.com/cards/search?unique=prints&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } })
  if (!res.ok) {
    if (res.status === 404) return []
    const ra = Number(res.headers.get("Retry-After"))
    const retryAfterMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : undefined
    throw new ScryfallError(res.status, `Scryfall ${res.status}: ${await res.text()}`, retryAfterMs)
  }
  const body = (await res.json()) as { data?: ScryfallCard[] }
  const mapped = (body.data ?? []).map(mapCard)
  if (id.setHint) {
    const hint = id.setHint.toUpperCase()
    mapped.sort((a, b) => (b.meta.setCode === hint ? 1 : 0) - (a.meta.setCode === hint ? 1 : 0))
  }
  return mapped
}

async function fetchScryfall(id: CardIdentifier): Promise<CardOption[]> {
  return withRetry(async () => {
    try {
      return await fetchScryfallOnce(id)
    } catch (e) {
      if (e instanceof ScryfallError && e.retryAfterMs) {
        await new Promise(r => setTimeout(r, e.retryAfterMs))
      }
      throw e
    }
  }, {
    attempts: 4,
    baseDelayMs: 250,
    shouldRetry: e => {
      if (!(e instanceof ScryfallError)) return true
      return e.status === 429 || e.status >= 500
    },
  })
}

type CacheEntry = { value: CardOption[]; expiresAt: number }
const FULL_TTL_MS = 60 * 60 * 1000
const FULL_MAX = 200
const fullCache = new Map<string, CacheEntry>()
const fullInflight = new Map<string, Promise<CardOption[]>>()

function evictFull() {
  while (fullCache.size > FULL_MAX) {
    const first = fullCache.keys().next().value
    if (first === undefined) break
    fullCache.delete(first)
  }
}

function cacheKey(id: CardIdentifier): string {
  return `${id.type}:${id.name.toLowerCase()}:${(id.setHint ?? "").toLowerCase()}`
}

async function getFullList(id: CardIdentifier): Promise<CardOption[]> {
  const k = cacheKey(id)
  const hit = fullCache.get(k)
  const now = Date.now()
  if (hit && hit.expiresAt > now) {
    fullCache.delete(k); fullCache.set(k, hit)
    return hit.value
  }
  const existing = fullInflight.get(k)
  if (existing) return existing
  const promise = (async () => {
    try {
      const value = await scryfallLimit(() => fetchScryfall(id))
      fullCache.set(k, { value, expiresAt: Date.now() + FULL_TTL_MS })
      evictFull()
      return value
    } finally {
      fullInflight.delete(k)
    }
  })()
  fullInflight.set(k, promise)
  return promise
}

export const scryfall: Source = defineSource({
  name: "Scryfall",
  async getOptions(id: CardIdentifier, opts: SourcePageOptions = {}): Promise<SourcePage> {
    const all = await getFullList(id)
    const offset = Math.max(0, opts.offset ?? 0)
    const limit = Math.max(1, opts.limit ?? all.length)
    const slice = all.slice(offset, offset + limit)
    return { options: slice, total: all.length, hasMore: offset + slice.length < all.length }
  },
})

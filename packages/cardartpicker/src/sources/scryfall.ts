import pLimit from "p-limit"
import type { CardIdentifier, CardOption, Source } from "../types.js"
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

export const scryfall: Source = defineSource({
  name: "Scryfall",
  getOptions: id => scryfallLimit(() => fetchScryfall(id)),
})

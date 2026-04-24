import type { CardIdentifier, CardOption, Source } from "../types.js"
import { defineSource } from "./index.js"

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

async function fetchScryfall(id: CardIdentifier): Promise<CardOption[]> {
  const q = `!"${id.name.replace(/"/g, "")}"`
  const url = `https://api.scryfall.com/cards/search?unique=prints&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { Accept: "application/json" } })
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Scryfall ${res.status}: ${await res.text()}`)
  }
  const body = (await res.json()) as { data?: ScryfallCard[] }
  const mapped = (body.data ?? []).map(mapCard)
  if (id.setHint) {
    const hint = id.setHint.toUpperCase()
    mapped.sort((a, b) => (b.meta.setCode === hint ? 1 : 0) - (a.meta.setCode === hint ? 1 : 0))
  }
  return mapped
}

export const scryfall: Source = defineSource({
  name: "Scryfall",
  getOptions: fetchScryfall,
})

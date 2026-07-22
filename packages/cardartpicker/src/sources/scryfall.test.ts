import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import { scryfall } from "./scryfall.js"
import solRing from "../../test/fixtures/scryfall-sol-ring.json" with { type: "json" }
import arlinn from "../../test/fixtures/scryfall-arlinn-dfc.json" with { type: "json" }

const collectionCalls: Array<{ identifiers: Array<{ name: string }> }> = []

const server = setupServer(
  http.get("https://api.scryfall.com/cards/search", ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get("q") ?? ""
    if (q.includes("Sol Ring")) return HttpResponse.json(solRing)
    if (q.includes("Arlinn")) return HttpResponse.json(arlinn)
    return HttpResponse.json({ data: [] })
  }),
  http.post("https://api.scryfall.com/cards/collection", async ({ request }) => {
    const body = (await request.json()) as { identifiers: Array<{ name: string }> }
    collectionCalls.push(body)
    const data = body.identifiers
      .filter(i => !i.name.toLowerCase().startsWith("missing"))
      .map((i, idx) => ({
        id: `coll-${i.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${idx}`,
        name: i.name,
        set: "c21",
        collector_number: String(idx),
        image_uris: { png: `https://cards.scryfall.io/png/${idx}.png`, small: `https://cards.scryfall.io/small/${idx}.png` },
      }))
    const not_found = body.identifiers.filter(i => i.name.toLowerCase().startsWith("missing"))
    return HttpResponse.json({ data, not_found })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  collectionCalls.length = 0
})
afterAll(() => server.close())

describe("scryfall source", () => {
  it("returns multiple prints as CardOptions", async () => {
    const { options, total, hasMore } = await scryfall.getOptions({ name: "Sol Ring sr-1", type: "card" })
    expect(options).toHaveLength(2)
    expect(total).toBe(2)
    expect(hasMore).toBe(false)
    expect(options[0]).toMatchObject({
      sourceName: "Scryfall",
      cardName: "Sol Ring",
      imageUrl: "https://cards.scryfall.io/png/front/a/b/abc-123.png",
      meta: { setCode: "C21", collectorNumber: "472", artist: "Mark Tedin" },
    })
    expect(options[0]!.id).toBe("scryfall:abc-123")
  })

  it("maps DFC faces into back image", async () => {
    const { options } = await scryfall.getOptions({ name: "Arlinn, the Pack's Hope // Arlinn, the Moon's Fury", type: "card" })
    expect(options).toHaveLength(1)
    expect(options[0]!.imageUrl).toBe("https://cards.scryfall.io/png/front/a/r/arl-001-a.png")
    expect(options[0]!.backImageUrl).toBe("https://cards.scryfall.io/png/back/a/r/arl-001-b.png")
  })

  it("returns [] when Scryfall has no matches", async () => {
    const { options, total, hasMore } = await scryfall.getOptions({ name: "Nonexistent", type: "card" })
    expect(options).toEqual([])
    expect(total).toBe(0)
    expect(hasMore).toBe(false)
  })

  it("boosts print matching setHint to the front of the list", async () => {
    const { options } = await scryfall.getOptions({ name: "Sol Ring lea-test", setHint: "LEA", type: "card" })
    expect(options[0]!.meta.setCode).toBe("LEA")
  })

  it("adds layout:token filter for token queries", async () => {
    let capturedQuery: string | null = null
    server.use(http.get("https://api.scryfall.com/cards/search", ({ request }) => {
      capturedQuery = new URL(request.url).searchParams.get("q")
      return HttpResponse.json({ data: [] })
    }))
    await scryfall.getOptions({ name: "Treasure", type: "token" })
    expect(capturedQuery).toContain("layout:token")
  })

  it("paginates results via offset/limit", async () => {
    const first = await scryfall.getOptions({ name: "Sol Ring page-test", type: "card" }, { offset: 0, limit: 1 })
    expect(first.options).toHaveLength(1)
    expect(first.total).toBe(2)
    expect(first.hasMore).toBe(true)
    const second = await scryfall.getOptions({ name: "Sol Ring page-test", type: "card" }, { offset: 1, limit: 1 })
    expect(second.options).toHaveLength(1)
    expect(second.hasMore).toBe(false)
  })
})

describe("scryfall getDefaults", () => {
  it("resolves plain cards via /cards/collection and marks misses absent", async () => {
    const hits = await scryfall.getDefaults!([
      { name: "Sol Ring gd-1", type: "card" },
      { name: "Missing Card gd-1", type: "card" },
    ])
    expect(collectionCalls).toHaveLength(1)
    expect(hits.get("card:sol ring gd-1")?.sourceName).toBe("Scryfall")
    expect(hits.has("card:missing card gd-1")).toBe(false)
  })

  it("chunks batches of more than 75 identifiers", async () => {
    const ids = Array.from({ length: 76 }, (_, i) => ({ name: `Bulk Card gd-${i}`, type: "card" as const }))
    const hits = await scryfall.getDefaults!(ids)
    expect(collectionCalls).toHaveLength(2)
    expect(collectionCalls[0]!.identifiers).toHaveLength(75)
    expect(collectionCalls[1]!.identifiers).toHaveLength(1)
    expect(hits.size).toBe(76)
  })

  it("routes tokens through the search path, not collection", async () => {
    let searchHit = false
    server.use(http.get("https://api.scryfall.com/cards/search", () => {
      searchHit = true
      return HttpResponse.json(solRing)
    }))
    const hits = await scryfall.getDefaults!([{ name: "Treasure gd-1", type: "token" }])
    expect(collectionCalls).toHaveLength(0)
    expect(searchHit).toBe(true)
    expect(hits.get("token:treasure gd-1")).toBeDefined()
  })

  it("matches DFC responses whose full name extends the requested front face", async () => {
    server.use(http.post("https://api.scryfall.com/cards/collection", () =>
      HttpResponse.json({
        data: [{
          id: "dfc-1",
          name: "Arlinn, the Pack's Hope gd // Arlinn, the Moon's Fury gd",
          image_uris: { png: "https://cards.scryfall.io/png/dfc.png" },
        }],
        not_found: [],
      })))
    const hits = await scryfall.getDefaults!([{ name: "Arlinn, the Pack's Hope gd", type: "card" }])
    expect(hits.get("card:arlinn, the pack's hope gd")).toBeDefined()
  })
})

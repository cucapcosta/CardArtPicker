import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import { scryfall } from "./scryfall.js"
import solRing from "../../test/fixtures/scryfall-sol-ring.json" with { type: "json" }
import arlinn from "../../test/fixtures/scryfall-arlinn-dfc.json" with { type: "json" }

const server = setupServer(
  http.get("https://api.scryfall.com/cards/search", ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get("q") ?? ""
    if (q.includes("Sol Ring")) return HttpResponse.json(solRing)
    if (q.includes("Arlinn")) return HttpResponse.json(arlinn)
    return HttpResponse.json({ data: [] })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
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

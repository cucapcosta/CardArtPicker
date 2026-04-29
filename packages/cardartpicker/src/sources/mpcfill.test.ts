import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import { createMpcFill } from "./mpcfill.js"
import sources from "../../test/fixtures/mpcfill-sources.json" with { type: "json" }
import search from "../../test/fixtures/mpcfill-search.json" with { type: "json" }
import cards from "../../test/fixtures/mpcfill-cards.json" with { type: "json" }

const server = setupServer(
  http.get("https://mpcfill.com/2/sources/", () => HttpResponse.json(sources)),
  http.post("https://mpcfill.com/2/editorSearch/", () => HttpResponse.json(search)),
  http.post("https://mpcfill.com/2/cards/", () => HttpResponse.json(cards))
)

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("mpcFill source", () => {
  it("fetches sources, searches, hydrates card data", async () => {
    const src = createMpcFill()
    const { options, total, hasMore } = await src.getOptions({ name: "Sol Ring", type: "card" })
    expect(options).toHaveLength(2)
    expect(total).toBe(2)
    expect(hasMore).toBe(false)
    expect(options[0]).toMatchObject({
      sourceName: "MPC Fill",
      cardName: "Sol Ring",
      meta: { dpi: 800, language: "EN", tags: [] },
    })
    expect(options[0]!.id).toBe("mpcfill:id-aaa")
    expect(options[0]!.imageUrl).toBe("https://drive.google.com/thumbnail?id=id-aaa&sz=w1600")
    expect(options[0]!.thumbnailUrl).toBe("https://drive.google.com/thumbnail?id=id-aaa&sz=w400")
  })

  it("returns empty when search has zero hits", async () => {
    server.use(http.post("https://mpcfill.com/2/editorSearch/", () =>
      HttpResponse.json({ results: { "unknown card": { CARD: [] } } })))
    const { options, total } = await createMpcFill().getOptions({ name: "Unknown Card", type: "card" })
    expect(options).toEqual([])
    expect(total).toBe(0)
  })

  it("paginates: ID list cached, hydrate sliced", async () => {
    const src = createMpcFill()
    const first = await src.getOptions({ name: "Sol Ring", type: "card" }, { offset: 0, limit: 1 })
    expect(first.options).toHaveLength(1)
    expect(first.total).toBe(2)
    expect(first.hasMore).toBe(true)
    const second = await src.getOptions({ name: "Sol Ring", type: "card" }, { offset: 1, limit: 1 })
    expect(second.options).toHaveLength(1)
    expect(second.hasMore).toBe(false)
  })

  it("propagates search 500 as thrown error", async () => {
    server.use(http.post("https://mpcfill.com/2/editorSearch/", () =>
      HttpResponse.text("boom", { status: 500 })))
    await expect(createMpcFill().getOptions({ name: "Sol Ring", type: "card" })).rejects.toThrow(/500/)
  })

  it("passes TOKEN cardType through", async () => {
    let capturedBody: unknown
    server.use(http.post("https://mpcfill.com/2/editorSearch/", async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({ results: { treasure: { TOKEN: [] } } })
    }))
    await createMpcFill().getOptions({ name: "Treasure", type: "token" })
    expect(capturedBody).toMatchObject({ queries: [{ cardType: "TOKEN" }] })
  })

  it("formats sources as [[pk, true], ...] tuples", async () => {
    let capturedBody: { searchSettings: { sourceSettings: { sources: unknown[] } } } | undefined
    server.use(http.post("https://mpcfill.com/2/editorSearch/", async ({ request }) => {
      capturedBody = await request.json() as never
      return HttpResponse.json({ results: { "sol ring": { CARD: [] } } })
    }))
    await createMpcFill().getOptions({ name: "Sol Ring", type: "card" })
    expect(capturedBody?.searchSettings.sourceSettings.sources).toEqual([[1, true], [2, true]])
  })
})

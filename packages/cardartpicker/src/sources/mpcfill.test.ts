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
    const opts = await src.getOptions({ name: "Sol Ring", type: "card" })
    expect(opts).toHaveLength(2)
    expect(opts[0]).toMatchObject({
      sourceName: "MPC Fill",
      cardName: "Sol Ring",
      meta: { dpi: 800, language: "EN", tags: [] },
    })
    expect(opts[0].id).toBe("mpcfill:id-aaa")
    expect(opts[0].imageUrl).toContain("id-aaa")
  })

  it("returns empty when search has zero hits", async () => {
    server.use(http.post("https://mpcfill.com/2/editorSearch/", () =>
      HttpResponse.json({ results: { "unknown card": { CARD: [] } } })))
    const opts = await createMpcFill().getOptions({ name: "Unknown Card", type: "card" })
    expect(opts).toEqual([])
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

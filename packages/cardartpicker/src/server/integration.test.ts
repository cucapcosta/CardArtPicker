import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import { createHandlers } from "./index.js"
import { createPicker } from "../createPicker.js"
import { scryfall } from "../sources/scryfall.js"
import solRing from "../../test/fixtures/scryfall-sol-ring.json" with { type: "json" }

const server = setupServer(
  http.get("https://api.scryfall.com/cards/search", () => HttpResponse.json(solRing))
)
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("end-to-end handler + Scryfall source", () => {
  const picker = createPicker({ sources: [scryfall] })
  const { GET, POST } = createHandlers(picker)

  it("parse → default → options round-trip", async () => {
    const parseRes = await POST(new Request("http://t/api/cardartpicker/parse", {
      method: "POST", body: JSON.stringify({ text: "1 Sol Ring" }),
      headers: { "Content-Type": "application/json" },
    }))
    const parsed = await parseRes.json()
    expect(parsed.mainboard).toHaveLength(1)

    const defaultRes = await GET(new Request("http://t/api/cardartpicker/default?name=Sol+Ring&type=card"))
    const def = await defaultRes.json()
    expect(def.id).toMatch(/^scryfall:/)

    const optionsRes = await GET(new Request("http://t/api/cardartpicker/options?name=Sol+Ring&type=card"))
    const opts = await optionsRes.json()
    expect(opts[0].ok).toBe(true)
  })
})

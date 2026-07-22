import { describe, expect, it, vi } from "vitest"
import { createHandlers } from "./index.js"
import { createPicker } from "../createPicker.js"
import type { Source, CardOption } from "../types.js"

const opt = (id: string): CardOption => ({
  id: `A:${id}`, sourceName: "A", cardName: "Sol Ring",
  imageUrl: `https://x/${id}.png`, meta: {},
})
const makeSource = (name: string, options: CardOption[]): Source => ({
  name, getOptions: vi.fn(async () => ({ options, total: options.length, hasMore: false })),
})
const req = (url: string, init?: RequestInit): Request => new Request(`http://test${url}`, init)

describe("createHandlers", () => {
  const picker = createPicker({ sources: [makeSource("A", [opt("x")])] })
  const { GET, POST } = createHandlers(picker)

  it("GET /default returns first print", async () => {
    const r = await GET(req("/api/cardartpicker/default?name=Sol+Ring&type=card"))
    const body = await r.json()
    expect(r.status).toBe(200)
    expect(body.id).toBe("A:x")
  })

  it("GET /default returns 404 when missing", async () => {
    const p = createPicker({ sources: [makeSource("A", [])] })
    const { GET: g } = createHandlers(p)
    const r = await g(req("/api/cardartpicker/default?name=Missing&type=card"))
    expect(r.status).toBe(404)
  })

  it("GET /options returns all source results", async () => {
    const r = await GET(req("/api/cardartpicker/options?name=Sol+Ring&type=card"))
    const body = await r.json() as Array<{ ok: boolean }>
    expect(r.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].ok).toBe(true)
  })

  it("POST /parse returns parsed deck list", async () => {
    const r = await POST(req("/api/cardartpicker/parse", {
      method: "POST",
      body: JSON.stringify({ text: "1 Sol Ring\nTOKENS:\n2 Treasure" }),
      headers: { "Content-Type": "application/json" },
    }))
    const body = await r.json()
    expect(body.mainboard).toHaveLength(1)
    expect(body.tokens).toHaveLength(1)
  })

  it("GET unknown path returns 404", async () => {
    const r = await GET(req("/api/cardartpicker/nope"))
    expect(r.status).toBe(404)
  })

  it("POST with invalid body returns 400", async () => {
    const r = await POST(req("/api/cardartpicker/parse", {
      method: "POST", body: "not-json",
      headers: { "Content-Type": "application/json" },
    }))
    expect(r.status).toBe(400)
  })

  it("POST /defaults resolves a batch of cards", async () => {
    const selective: Source = {
      name: "A",
      getOptions: vi.fn(async (id) => {
        const options = id.name === "Sol Ring" ? [opt("x")] : []
        return { options, total: options.length, hasMore: false }
      }),
    }
    const p = createPicker({ sources: [selective] })
    const { POST: post } = createHandlers(p)
    const r = await post(req("/api/cardartpicker/defaults", {
      method: "POST",
      body: JSON.stringify({ cards: [{ name: "Sol Ring", type: "card" }, { name: "Nope", type: "card" }] }),
      headers: { "Content-Type": "application/json" },
    }))
    const body = await r.json() as Record<string, { id: string } | null>
    expect(r.status).toBe(200)
    expect(body["card:sol ring"]?.id).toBe("A:x")
    expect(body["card:nope"]).toBeNull()
  })

  it("POST /defaults defaults type to card", async () => {
    const r = await POST(req("/api/cardartpicker/defaults", {
      method: "POST",
      body: JSON.stringify({ cards: [{ name: "Sol Ring" }] }),
      headers: { "Content-Type": "application/json" },
    }))
    const body = await r.json() as Record<string, { id: string } | null>
    expect(body["card:sol ring"]?.id).toBe("A:x")
  })

  it("POST /defaults rejects invalid bodies", async () => {
    const empty = await POST(req("/api/cardartpicker/defaults", {
      method: "POST", body: JSON.stringify({ cards: [] }),
      headers: { "Content-Type": "application/json" },
    }))
    expect(empty.status).toBe(400)
    const notJson = await POST(req("/api/cardartpicker/defaults", {
      method: "POST", body: "nope",
      headers: { "Content-Type": "application/json" },
    }))
    expect(notJson.status).toBe(400)
  })

  it("cacheable GET responses carry Cache-Control", async () => {
    const d = await GET(req("/api/cardartpicker/default?name=Sol+Ring&type=card"))
    expect(d.headers.get("Cache-Control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400")
    const o = await GET(req("/api/cardartpicker/options?name=Sol+Ring&type=card"))
    expect(o.headers.get("Cache-Control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400")
  })

  it("GET /options omits Cache-Control when a source result is partial-failure", async () => {
    const failing: Source = {
      name: "B",
      getOptions: vi.fn(async () => { throw new Error("boom") }),
    }
    const p = createPicker({ sources: [makeSource("A", [opt("x")]), failing] })
    const { GET: g } = createHandlers(p)
    const r = await g(req("/api/cardartpicker/options?name=Sol+Ring&type=card"))
    const body = await r.json() as Array<{ ok: boolean }>
    expect(r.status).toBe(200)
    expect(body.some(x => !x.ok)).toBe(true)
    expect(r.headers.get("Cache-Control")).toBeNull()
  })
})

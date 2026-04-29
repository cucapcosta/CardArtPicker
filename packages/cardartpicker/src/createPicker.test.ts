import { describe, expect, it, vi } from "vitest"
import { createPicker } from "./createPicker.js"
import type { Source, CardOption } from "./types.js"

const makeSource = (name: string, opts: CardOption[] | Error): Source => ({
  name,
  getOptions: vi.fn(async () => {
    if (opts instanceof Error) throw opts
    return { options: opts, total: opts.length, hasMore: false }
  }),
})

const opt = (id: string, source: string): CardOption => ({
  id: `${source}:${id}`, sourceName: source, cardName: "Sol Ring",
  imageUrl: `https://example.com/${id}.png`, meta: {},
})

describe("createPicker", () => {
  it("runs all sources in parallel and aggregates", async () => {
    const a = makeSource("A", [opt("1", "A")])
    const b = makeSource("B", [opt("2", "B"), opt("3", "B")])
    const picker = createPicker({ sources: [a, b] })
    const results = await picker.searchCard({ name: "Sol Ring", type: "card" })
    expect(results).toHaveLength(2)
    const optionCount = results.flatMap(r => r.ok ? r.options : []).length
    expect(optionCount).toBe(3)
  })

  it("returns ok:false for failing source but keeps others", async () => {
    const a = makeSource("A", new Error("boom"))
    const b = makeSource("B", [opt("x", "B")])
    const picker = createPicker({ sources: [a, b] })
    const results = await picker.searchCard({ name: "Sol Ring", type: "card" })
    const aR = results.find(r => r.source === "A")
    const bR = results.find(r => r.source === "B")
    expect(aR?.ok).toBe(false)
    expect(bR?.ok).toBe(true)
  })

  it("enforces source timeout", async () => {
    const slow: Source = { name: "Slow", getOptions: () => new Promise(() => {}) }
    const picker = createPicker({ sources: [slow], sourceTimeoutMs: 20 })
    const results = await picker.searchCard({ name: "X", type: "card" })
    expect(results[0].ok).toBe(false)
    if (!results[0].ok) expect(results[0].error.code).toBe("timeout")
  })

  it("caches results by name+type across calls", async () => {
    const s = makeSource("A", [opt("1", "A")])
    const picker = createPicker({ sources: [s] })
    await picker.searchCard({ name: "Sol Ring", type: "card" })
    await picker.searchCard({ name: "Sol Ring", type: "card" })
    expect(s.getOptions).toHaveBeenCalledTimes(1)
  })

  it("parseList delegates to parser", () => {
    const picker = createPicker({ sources: [] })
    const r = picker.parseList("1 Sol Ring")
    expect(r.mainboard[0].name).toBe("Sol Ring")
  })

  it("getDefaultPrint returns first ok source's first option", async () => {
    const a = makeSource("A", [])
    const b = makeSource("B", [opt("x", "B")])
    const picker = createPicker({ sources: [a, b] })
    const def = await picker.getDefaultPrint("Sol Ring")
    expect(def?.id).toBe("B:x")
  })

  it("getDefaultPrint returns null when nothing found", async () => {
    const a = makeSource("A", [])
    const picker = createPicker({ sources: [a] })
    expect(await picker.getDefaultPrint("Sol Ring")).toBeNull()
  })
})

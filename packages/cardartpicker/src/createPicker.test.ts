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

  it("caches per source: healthy source is not re-queried when another source fails", async () => {
    const bad = makeSource("Bad", new Error("boom"))
    const good = makeSource("Good", [opt("1", "Good")])
    const picker = createPicker({ sources: [bad, good] })
    await picker.searchCard({ name: "Sol Ring", type: "card" })
    await picker.searchCard({ name: "Sol Ring", type: "card" })
    expect(good.getOptions).toHaveBeenCalledTimes(1)
  })

  it("negative-caches failures: failing source not re-queried within 30s", async () => {
    const bad = makeSource("Bad", new Error("boom"))
    const picker = createPicker({ sources: [bad] })
    await picker.searchCard({ name: "Sol Ring", type: "card" })
    await picker.searchCard({ name: "Sol Ring", type: "card" })
    expect(bad.getOptions).toHaveBeenCalledTimes(1)
  })

  it("negative cache expires after 30s", async () => {
    vi.useFakeTimers()
    try {
      const bad = makeSource("Bad", new Error("boom"))
      const picker = createPicker({ sources: [bad] })
      await picker.searchCard({ name: "Sol Ring", type: "card" })
      vi.setSystemTime(Date.now() + 31_000)
      await picker.searchCard({ name: "Sol Ring", type: "card" })
      expect(bad.getOptions).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it("serves any page shape from a cached complete result set", async () => {
    const options = [opt("1", "A"), opt("2", "A"), opt("3", "A")]
    const s = makeSource("A", options)
    const picker = createPicker({ sources: [s] })
    await picker.searchCard({ name: "Sol Ring", type: "card" })
    const page = await picker.searchCard({ name: "Sol Ring", type: "card" }, { offset: 1, limit: 1 })
    expect(s.getOptions).toHaveBeenCalledTimes(1)
    expect(page[0].ok && page[0].options[0]?.id).toBe("A:2")
    expect(page[0].ok && page[0].hasMore).toBe(true)
  })

  it("negative cache covers all page shapes for the same card", async () => {
    const bad = makeSource("Bad", new Error("boom"))
    const picker = createPicker({ sources: [bad] })
    await picker.searchCard({ name: "Sol Ring", type: "card" })
    await picker.searchCard({ name: "Sol Ring", type: "card" }, { offset: 0, limit: 1 })
    expect(bad.getOptions).toHaveBeenCalledTimes(1)
  })

  it("getDefaultPrint queries sources in order and stops at first hit", async () => {
    const a = makeSource("A", [opt("1", "A")])
    const b = makeSource("B", [opt("2", "B")])
    const picker = createPicker({ sources: [a, b] })
    const def = await picker.getDefaultPrint("Sol Ring")
    expect(def?.id).toBe("A:1")
    expect(b.getOptions).not.toHaveBeenCalled()
  })

  it("getDefaultPrints resolves a batch, falling through to later sources per card", async () => {
    const a: Source = {
      name: "A",
      getOptions: vi.fn(async (id) => {
        const hit = id.name === "Sol Ring" ? [opt("1", "A")] : []
        return { options: hit, total: hit.length, hasMore: false }
      }),
    }
    const b: Source = {
      name: "B",
      getOptions: vi.fn(async (id) => {
        const hit = id.name === "Counterspell" ? [opt("2", "B")] : []
        return { options: hit, total: hit.length, hasMore: false }
      }),
    }
    const picker = createPicker({ sources: [a, b] })
    const map = await picker.getDefaultPrints([
      { name: "Sol Ring", type: "card" },
      { name: "Counterspell", type: "card" },
      { name: "Nonexistent", type: "card" },
    ])
    expect(map["card:sol ring"]?.id).toBe("A:1")
    expect(map["card:counterspell"]?.id).toBe("B:2")
    expect(map["card:nonexistent"]).toBeNull()
    // B only queried for the two cards A missed
    expect(b.getOptions).toHaveBeenCalledTimes(2)
  })

  it("getDefaultPrints uses a source's batch getDefaults when available", async () => {
    const batched: Source = {
      name: "Batched",
      getOptions: vi.fn(async () => ({ options: [], total: 0, hasMore: false })),
      getDefaults: vi.fn(async (ids) => {
        const m = new Map<string, CardOption>()
        for (const id of ids) m.set(`${id.type}:${id.name.toLowerCase()}`, opt(id.name, "Batched"))
        return m
      }),
    }
    const picker = createPicker({ sources: [batched] })
    const map = await picker.getDefaultPrints([
      { name: "Sol Ring", type: "card" },
      { name: "Counterspell", type: "card" },
    ])
    expect(batched.getDefaults).toHaveBeenCalledTimes(1)
    expect(batched.getOptions).not.toHaveBeenCalled()
    expect(map["card:sol ring"]?.id).toBe("Batched:Sol Ring")
  })

  it("getDefaultPrints survives a broken getDefaults and falls through", async () => {
    const broken: Source = {
      name: "Broken",
      getOptions: vi.fn(async () => ({ options: [], total: 0, hasMore: false })),
      getDefaults: vi.fn(async () => { throw new Error("boom") }),
    }
    const b = makeSource("B", [opt("2", "B")])
    const picker = createPicker({ sources: [broken, b] })
    const map = await picker.getDefaultPrints([{ name: "Sol Ring", type: "card" }])
    expect(map["card:sol ring"]?.id).toBe("B:2")
  })

  it("getDefaultPrints caches resolved defaults", async () => {
    const a = makeSource("A", [opt("1", "A")])
    const picker = createPicker({ sources: [a] })
    await picker.getDefaultPrints([{ name: "Sol Ring", type: "card" }])
    await picker.getDefaultPrints([{ name: "Sol Ring", type: "card" }])
    expect(a.getOptions).toHaveBeenCalledTimes(1)
  })
})

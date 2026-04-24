import { describe, expect, it, vi } from "vitest"
import { createMemoryCache } from "./cache.js"

describe("createMemoryCache", () => {
  it("stores and retrieves values", async () => {
    const c = createMemoryCache<number>({ max: 10 })
    await c.set("a", 1)
    expect(await c.get("a")).toBe(1)
  })

  it("returns undefined for missing keys", async () => {
    const c = createMemoryCache()
    expect(await c.get("missing")).toBeUndefined()
  })

  it("expires entries after ttl", async () => {
    vi.useFakeTimers()
    const c = createMemoryCache<number>({ defaultTtlSeconds: 1 })
    await c.set("a", 42)
    vi.advanceTimersByTime(2000)
    expect(await c.get("a")).toBeUndefined()
    vi.useRealTimers()
  })

  it("evicts oldest when max size exceeded", async () => {
    const c = createMemoryCache<string>({ max: 2 })
    await c.set("a", "1")
    await c.set("b", "2")
    await c.set("c", "3")
    expect(await c.get("a")).toBeUndefined()
    expect(await c.get("b")).toBe("2")
    expect(await c.get("c")).toBe("3")
  })
})

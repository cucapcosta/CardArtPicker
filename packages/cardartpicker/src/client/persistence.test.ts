// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { localStorageAdapter, sessionAdapter } from "./persistence.js"
import type { CardOption } from "../types.js"

const opt = (id: string): CardOption => ({
  id, sourceName: "Custom", cardName: "Test", imageUrl: "data:x",
  meta: { userUploaded: true },
})

beforeEach(() => localStorage.clear())

describe("localStorageAdapter", () => {
  it("round-trips options", async () => {
    const a = localStorageAdapter()
    await a.save(opt("1"))
    await a.save(opt("2"))
    const all = await a.loadAll()
    expect(all.map(o => o.id).sort()).toEqual(["1", "2"])
  })

  it("removes options", async () => {
    const a = localStorageAdapter()
    await a.save(opt("1"))
    await a.remove("1")
    expect(await a.loadAll()).toEqual([])
  })

  it("throws typed quota error when over cap", async () => {
    const a = localStorageAdapter({ maxBytes: 10 })
    await expect(a.save({ ...opt("big"), imageUrl: "x".repeat(20) })).rejects.toMatchObject({ code: "quota-exceeded" })
  })
})

describe("sessionAdapter", () => {
  it("holds options in memory", async () => {
    const a = sessionAdapter()
    await a.save(opt("1"))
    expect(await a.loadAll()).toHaveLength(1)
  })

  it("isolates between instances", async () => {
    const a = sessionAdapter()
    const b = sessionAdapter()
    await a.save(opt("1"))
    expect(await b.loadAll()).toEqual([])
  })
})

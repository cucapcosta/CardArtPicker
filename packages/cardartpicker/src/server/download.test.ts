import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import JSZip from "jszip"
import { buildZip } from "./download.js"
import type { CardOption } from "../types.js"

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const server = setupServer(
  http.get("https://images.test/:file", () => HttpResponse.arrayBuffer(PNG.buffer))
)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const opt = (id: string, overrides: Partial<CardOption> = {}): CardOption => ({
  id: `a:${id}`, sourceName: "A",
  cardName: id === "dfc" ? "Arlinn // Moon" : "Sol Ring",
  imageUrl: `https://images.test/${id}.png`, meta: {}, ...overrides,
})

describe("buildZip", () => {
  it("packages one image per unique selection", async () => {
    const selections = [{ slotId: "mainboard-0", optionId: "a:x", quantity: 1 }]
    const resolver = async () => opt("x")
    const blob = await buildZip(selections, resolver)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const names = Object.keys(zip.files)
    expect(names).toHaveLength(1)
    expect(names[0]).toMatch(/sol-ring.*\.png$/)
  })

  it("appends -copyN suffix for quantities > 1", async () => {
    const selections = [{ slotId: "mainboard-0", optionId: "a:x", quantity: 3 }]
    const resolver = async () => opt("x")
    const blob = await buildZip(selections, resolver)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files)).toHaveLength(3)
  })

  it("emits two files per DFC option", async () => {
    const selections = [{ slotId: "mainboard-0", optionId: "a:dfc", quantity: 1 }]
    const resolver = async () => opt("dfc", { backImageUrl: "https://images.test/dfc-back.png" })
    const blob = await buildZip(selections, resolver)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const names = Object.keys(zip.files).sort()
    expect(names).toHaveLength(2)
    expect(names[0]).toMatch(/ 1\.png$/)
    expect(names[1]).toMatch(/ 2\.png$/)
  })

  it("skips images that fail to fetch but keeps building", async () => {
    server.use(http.get("https://images.test/bad.png", () => HttpResponse.text("nope", { status: 500 })))
    const selections = [
      { slotId: "mainboard-0", optionId: "a:x", quantity: 1 },
      { slotId: "mainboard-1", optionId: "a:bad", quantity: 1 },
    ]
    const resolver = async (id: string) => id === "a:x" ? opt("x") : opt("bad")
    const blob = await buildZip(selections, resolver, { attempts: 1 })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files)).toHaveLength(1)
  })
})

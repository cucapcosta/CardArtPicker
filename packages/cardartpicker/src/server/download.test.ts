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

  it("keeps one file per selection when several selections share a card name", async () => {
    // The client sends one quantity-1 selection per copy (e.g. "4 Sol Ring" → 4 slots).
    const selections = Array.from({ length: 4 }, (_, i) => ({ slotId: `mainboard-0-${i}`, optionId: `a:x${i % 2}`, quantity: 1 }))
    const resolver = async (id: string) => opt(id.slice(2))
    const blob = await buildZip(selections, resolver)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files).sort()).toEqual([
      "sol-ring-copy1.png", "sol-ring-copy2.png", "sol-ring-copy3.png", "sol-ring-copy4.png",
    ])
  })

  it("numbers copies across selections mixing quantities and DFCs", async () => {
    const selections = [
      { slotId: "mainboard-0", optionId: "a:dfc", quantity: 2 },
      { slotId: "mainboard-1", optionId: "a:dfc", quantity: 1 },
    ]
    const resolver = async () => opt("dfc", { backImageUrl: "https://images.test/dfc-back.png" })
    const blob = await buildZip(selections, resolver)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files)).toHaveLength(6)
  })

  it("sends a non-generic User-Agent (Scryfall's image CDN 400s Node's default)", async () => {
    server.use(http.get("https://images.test/ua.png", ({ request }) =>
      request.headers.get("user-agent")?.startsWith("cardartpicker/")
        ? HttpResponse.arrayBuffer(PNG.buffer)
        : HttpResponse.json({ rule: "generic_user_agent" }, { status: 400 })))
    const selections = [{ slotId: "mainboard-0", optionId: "a:ua", quantity: 1 }]
    const blob = await buildZip(selections, async () => opt("ua"), { attempts: 1 })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files)).toHaveLength(1)
  })

  it("treats an HTML response as a failure instead of saving it as an image", async () => {
    server.use(http.get("https://images.test/html.png", () => HttpResponse.html("<html>quota</html>")))
    const selections = [{ slotId: "mainboard-0", optionId: "a:html", quantity: 1 }]
    const blob = await buildZip(selections, async () => opt("html"), { attempts: 1 })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files)).toHaveLength(0)
    expect((blob as Blob & { failures: unknown[] }).failures).toHaveLength(1)
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

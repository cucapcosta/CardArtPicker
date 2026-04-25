import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { createUploadHandler } from "./upload.js"
import { createPicker } from "../createPicker.js"

const req = (body: FormData): Request =>
  new Request("http://test/api/cardartpicker/upload", { method: "POST", body })

describe("createUploadHandler", () => {
  const picker = createPicker({ sources: [] })
  const upload = createUploadHandler(picker)

  it("accepts valid PNG and returns CardOption", async () => {
    const bytes = await readFile("./test/fixtures/sample.png")
    const form = new FormData()
    form.set("file", new Blob([bytes], { type: "image/png" }), "sample.png")
    form.set("cardName", "Sol Ring")
    form.set("slotId", "mainboard-0")
    const res = await upload(req(form))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      sourceName: "Custom",
      cardName: "Sol Ring",
      meta: { userUploaded: true },
    })
    expect(body.imageUrl.startsWith("data:image/png;base64,")).toBe(true)
  })

  it("rejects non-image mime types", async () => {
    const form = new FormData()
    form.set("file", new Blob(["hello"], { type: "text/plain" }), "note.txt")
    form.set("cardName", "X"); form.set("slotId", "s")
    const res = await upload(req(form))
    expect(res.status).toBe(400)
  })

  it("rejects files exceeding size cap", async () => {
    const big = new Uint8Array(21 * 1024 * 1024)
    const form = new FormData()
    form.set("file", new Blob([big], { type: "image/png" }), "big.png")
    form.set("cardName", "X"); form.set("slotId", "s")
    const res = await upload(req(form))
    expect(res.status).toBe(413)
  })

  it("returns 400 when file missing", async () => {
    const form = new FormData()
    form.set("cardName", "X"); form.set("slotId", "s")
    const res = await upload(req(form))
    expect(res.status).toBe(400)
  })
})

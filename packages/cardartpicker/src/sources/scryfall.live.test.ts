import { describe, expect, it } from "vitest"
import { scryfall } from "./scryfall.js"

const RUN = process.env.RUN_LIVE_TESTS === "1"
const d = RUN ? describe : describe.skip

d("scryfall (live)", () => {
  it("returns at least one print for Sol Ring", async () => {
    const opts = await scryfall.getOptions({ name: "Sol Ring", type: "card" })
    expect(opts.length).toBeGreaterThan(0)
    expect(opts[0]!.imageUrl).toMatch(/^https:\/\//)
    expect(opts[0]!.meta.setCode).toBeTruthy()
  })

  it("returns DFC back image for Arlinn", async () => {
    const opts = await scryfall.getOptions({ name: "Arlinn, the Pack's Hope // Arlinn, the Moon's Fury", type: "card" })
    expect(opts[0]?.backImageUrl).toMatch(/^https:\/\//)
  })
}, { timeout: 15_000 })

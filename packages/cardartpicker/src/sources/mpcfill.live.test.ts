import { describe, expect, it } from "vitest"
import { createMpcFill } from "./mpcfill.js"

const RUN = process.env.RUN_LIVE_TESTS === "1"
const d = RUN ? describe : describe.skip

d("mpcFill (live)", () => {
  it("returns options for Sol Ring", async () => {
    const src = createMpcFill()
    const opts = await src.getOptions({ name: "Sol Ring", type: "card" })
    expect(opts.length).toBeGreaterThan(0)
    expect(opts[0]!.sourceName).toBe("MPC Fill")
  })
}, { timeout: 20_000 })

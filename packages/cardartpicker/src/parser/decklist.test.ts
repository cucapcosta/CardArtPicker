import { describe, expect, it } from "vitest"
import { parseDeckList } from "./decklist.js"

describe("parseDeckList", () => {
  it("parses plain quantity + name", () => {
    const r = parseDeckList("4 Lightning Bolt")
    expect(r.mainboard).toEqual([{ quantity: 4, name: "Lightning Bolt", type: "card" }])
    expect(r.tokens).toEqual([])
    expect(r.warnings).toEqual([])
  })

  it("accepts 4x syntax", () => {
    const r = parseDeckList("4x Lightning Bolt\n1X Sol Ring")
    expect(r.mainboard.map(l => l.name)).toEqual(["Lightning Bolt", "Sol Ring"])
  })

  it("captures set and collector hints", () => {
    const r = parseDeckList("1 Sol Ring (C21) 472")
    expect(r.mainboard[0]).toMatchObject({
      quantity: 1, name: "Sol Ring", setHint: "C21", collectorHint: "472", type: "card",
    })
  })

  it("treats lines before marker as mainboard", () => {
    const r = parseDeckList("1 Sol Ring\n2 Island")
    expect(r.mainboard).toHaveLength(2)
    expect(r.tokens).toHaveLength(0)
  })

  it("routes tokens after TOKENS: marker", () => {
    const r = parseDeckList("1 Sol Ring\nTOKENS:\n3 Treasure")
    expect(r.mainboard.map(l => l.name)).toEqual(["Sol Ring"])
    expect(r.tokens).toEqual([{ quantity: 3, name: "Treasure", type: "token" }])
  })

  it("accepts TOKENS without colon, case-insensitive", () => {
    const r = parseDeckList("tokens\n1 Treasure")
    expect(r.tokens.map(l => l.name)).toEqual(["Treasure"])
  })

  it("preserves DFC double-slash names", () => {
    const r = parseDeckList("1 Arlinn, the Pack's Hope // Arlinn, the Moon's Fury (MID) 217")
    expect(r.mainboard[0].name).toBe("Arlinn, the Pack's Hope // Arlinn, the Moon's Fury")
    expect(r.mainboard[0].setHint).toBe("MID")
  })

  it("skips blank lines and // # comments", () => {
    const r = parseDeckList("// comment\n\n# another\n1 Sol Ring")
    expect(r.mainboard).toHaveLength(1)
    expect(r.warnings).toHaveLength(0)
  })

  it("records warning for unparseable lines, continues", () => {
    const r = parseDeckList("garbage line\n1 Sol Ring")
    expect(r.mainboard.map(l => l.name)).toEqual(["Sol Ring"])
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toMatchObject({ line: 1, raw: "garbage line" })
  })

  it("throws in strict mode when warnings present", () => {
    expect(() => parseDeckList("garbage", { strict: true })).toThrow(/line 1/i)
  })

  it("ignores trailing whitespace and carriage returns", () => {
    const r = parseDeckList("1 Sol Ring   \r\n2 Island \r\n")
    expect(r.mainboard.map(l => l.name)).toEqual(["Sol Ring", "Island"])
  })
})

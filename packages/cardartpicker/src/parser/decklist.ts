import type { ParsedLine, ParsedList, CardType } from "../types.js"

const LINE_RE = /^(\d+)[xX]?\s+(.+?)(?:\s+\(([A-Za-z0-9]+)\)(?:\s+(\S+))?)?$/
const TOKEN_MARKER_RE = /^tokens:?\s*$/i

type ParseOptions = { strict?: boolean }

export function parseDeckList(input: string, opts: ParseOptions = {}): ParsedList {
  const lines = input.split(/\r?\n/)
  const mainboard: ParsedLine[] = []
  const tokens: ParsedLine[] = []
  const warnings: ParsedList["warnings"] = []
  let section: "mainboard" | "tokens" = "mainboard"

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim()
    if (line === "") return
    if (line.startsWith("//") || line.startsWith("#")) return
    if (TOKEN_MARKER_RE.test(line)) { section = "tokens"; return }

    const match = line.match(LINE_RE)
    if (!match) {
      warnings.push({ line: idx + 1, raw: rawLine, reason: "does not match `N CardName` pattern" })
      return
    }
    const [, qtyStr, name, setHint, collectorHint] = match as unknown as [
      string,
      string,
      string,
      string | undefined,
      string | undefined,
    ]
    const type: CardType = section === "tokens" ? "token" : "card"
    const parsed: ParsedLine = {
      quantity: Number(qtyStr),
      name: name.trim(),
      type,
      ...(setHint ? { setHint } : {}),
      ...(collectorHint ? { collectorHint } : {}),
    }
    if (section === "tokens") tokens.push(parsed)
    else mainboard.push(parsed)
  })

  if (opts.strict && warnings.length > 0) {
    const first = warnings[0]!
    throw new Error(`parseDeckList: unparseable at line ${first.line}: ${first.raw}`)
  }
  return { mainboard, tokens, warnings }
}

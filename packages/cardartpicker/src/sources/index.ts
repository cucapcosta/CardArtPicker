import type { Source } from "../types.js"

export function defineSource(s: Source): Source {
  return s
}

export { scryfall } from "./scryfall.js"
export { mpcFill, createMpcFill } from "./mpcfill.js"

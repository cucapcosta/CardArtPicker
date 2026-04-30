import type { Source } from "../types.js"

export function defineSource(s: Source): Source {
  return s
}

export { scryfall } from "./scryfall.js"
export { mpcFill, createMpcFill } from "./mpcfill.js"
export { createMpcFillIndex } from "./mpcfill-index.js"
export type { MpcFillIndexFile, MpcFillIndexEntry, MpcFillIndexOptions } from "./mpcfill-index.js"

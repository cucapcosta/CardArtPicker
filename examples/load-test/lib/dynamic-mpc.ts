import { readFile, stat } from "node:fs/promises"
import { resolve } from "node:path"
import { createMpcFillIndex } from "cardartpicker/sources"
import type { MpcFillIndexFile } from "cardartpicker/sources"
import type { CardIdentifier, Source, SourcePage, SourcePageOptions } from "cardartpicker"

const FILE_ENV = process.env.MPC_FILL_INDEX_FILE
const FILE_PATH = FILE_ENV
  ? resolve(FILE_ENV)
  : resolve(process.cwd(), "../../scripts/mpcfill-index.json")

const CHECK_THROTTLE_MS = 5_000

let inner: Source | null = null
let mtime = 0
let lastCheck = 0
let inflight: Promise<void> | null = null

async function refresh(): Promise<void> {
  const now = Date.now()
  if (now - lastCheck < CHECK_THROTTLE_MS) return
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const s = await stat(FILE_PATH)
      lastCheck = Date.now()
      if (inner && s.mtimeMs === mtime) return
      const json = JSON.parse(await readFile(FILE_PATH, "utf8")) as MpcFillIndexFile
      inner = createMpcFillIndex({ index: json })
      mtime = s.mtimeMs
      console.log(`[mpc] loaded ${FILE_PATH} (mtime ${new Date(mtime).toISOString()})`)
    } catch (e) {
      lastCheck = Date.now()
      if (!inner) console.warn(`[mpc] index unavailable: ${(e as Error).message}`)
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export const dynamicMpcSource: Source = {
  name: "MPC Fill",
  async getOptions(id: CardIdentifier, opts?: SourcePageOptions): Promise<SourcePage> {
    await refresh()
    if (!inner) return { options: [], total: 0, hasMore: false }
    return inner.getOptions(id, opts)
  },
}

export const indexFilePath = FILE_PATH

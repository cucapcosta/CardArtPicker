import { createPicker } from "cardartpicker"
import { scryfall, mpcFill, defineSource } from "cardartpicker/sources"
import { readdir } from "node:fs/promises"
import { join } from "node:path"

const myProxies = defineSource({
  name: "My Proxies",
  async getOptions({ name }, opts = {}) {
    try {
      const dir = join(process.cwd(), "public", "my-proxies")
      const files = await readdir(dir)
      const all = files
        .filter(f => f.toLowerCase().includes(name.toLowerCase().replace(/[^a-z0-9]+/g, "-")))
        .map(f => ({
          id: `local:${f}`,
          sourceName: "My Proxies",
          cardName: name,
          imageUrl: `/my-proxies/${f}`,
          meta: {},
        }))
      const offset = Math.max(0, opts.offset ?? 0)
      const limit = Math.max(1, opts.limit ?? (all.length || 1))
      const slice = all.slice(offset, offset + limit)
      return { options: slice, total: all.length, hasMore: offset + slice.length < all.length }
    } catch { return { options: [], total: 0, hasMore: false } }
  },
})

export const picker = createPicker({
  sources: [scryfall, mpcFill, myProxies],
  uploadPersistence: "localStorage",
})

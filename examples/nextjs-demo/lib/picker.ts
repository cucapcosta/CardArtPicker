import { createPicker } from "cardartpicker"
import { scryfall, mpcFill, defineSource } from "cardartpicker/sources"
import { readdir } from "node:fs/promises"
import { join } from "node:path"

const myProxies = defineSource({
  name: "My Proxies",
  async getOptions({ name }) {
    try {
      const dir = join(process.cwd(), "public", "my-proxies")
      const files = await readdir(dir)
      return files
        .filter(f => f.toLowerCase().includes(name.toLowerCase().replace(/[^a-z0-9]+/g, "-")))
        .map(f => ({
          id: `local:${f}`,
          sourceName: "My Proxies",
          cardName: name,
          imageUrl: `/my-proxies/${f}`,
          meta: {},
        }))
    } catch { return [] }
  },
})

export const picker = createPicker({
  sources: [scryfall, mpcFill, myProxies],
  uploadPersistence: "localStorage",
})

# Custom source

Sources are how you plug your own catalog into the picker. Anything that can return a list of `CardOption`s for a given card name will work — a public folder, a S3 bucket, a Postgres table, an internal proxy server.

## Signature

```ts
import { defineSource } from "cardartpicker/sources"

const mySource = defineSource({
  name: string,                                            // user-visible label
  async getOptions(id: CardIdentifier): Promise<CardOption[]>,
  async getImage?(optionId: string): Promise<ArrayBuffer>, // optional
})
```

`defineSource` is purely an identity helper for type inference. Returning a plain object that satisfies `Source` is equivalent.

`CardIdentifier` and `CardOption` shapes are documented in [api/sources.md](../api/sources.md).

## Walkthrough: local folder source

The demo includes a source that reads PNGs from `public/my-proxies/` and matches files by card name. Source: `examples/nextjs-demo/lib/picker.ts`.

```ts
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
        .filter(f => f.toLowerCase().includes(
          name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
        ))
        .map(f => ({
          id: `local:${f}`,
          sourceName: "My Proxies",
          cardName: name,
          imageUrl: `/my-proxies/${f}`,
          meta: {},
        }))
    } catch {
      return []
    }
  },
})

export const picker = createPicker({
  sources: [scryfall, mpcFill, myProxies],
})
```

A `lightning-bolt-alt.png` in `public/my-proxies/` will appear in the picker for "Lightning Bolt" alongside Scryfall and MPC Fill options.

## `getImage` override

By default the download route fetches `option.imageUrl` directly. Implement `getImage` when:

- Your URLs need short-lived signed access (S3 with private bucket, GCS, etc.)
- The catalog stores binary blobs in a database
- You need custom headers (`Authorization`, paid API key)

```ts
defineSource({
  name: "S3 Bucket",
  async getOptions({ name }) {
    const rows = await db.query("SELECT id FROM cards WHERE name = $1", [name])
    return rows.map(r => ({
      id: `s3:${r.id}`,
      sourceName: "S3 Bucket",
      cardName: name,
      imageUrl: `/* placeholder — getImage will resolve */`,
      meta: {},
    }))
  },
  async getImage(optionId) {
    const id = optionId.replace(/^s3:/, "")
    const url = await s3.getSignedUrl({ Bucket, Key: id, Expires: 60 })
    const res = await fetch(url)
    return res.arrayBuffer()
  },
})
```

`getImage` is called for the **front face only**. DFC `backImageUrl` always goes through plain fetch — pre-sign it inside `getOptions` if needed.

## Best practices

- **Respect `setHint`.** When the user pastes `1 Sol Ring (C21) 472`, the parser sets `setHint = "C21"`. Sort matching prints to the front of your array. Do not filter — the user can still cycle to others.
- **Sort by relevance.** Best match first; the picker's "default print" path returns `options[0]` and the UI shows it first in the modal.
- **Catch and return `[]`.** A source that throws on a missing card poisons the parallel fetch. Catch upstream errors and return `[]` for "no results".
- **Keep `name` stable and unique.** It is used by the download route to dispatch `getImage` and surfaced in the UI.
- **Use a unique `id` prefix.** Convention: `"sourceslug:opaque-id"`. The picker dedupes on `id` across sources.
- **Set `meta.dpi` if you know it.** The UI's "min DPI" filter (planned) will use it.
- **Set `userUploaded: false`** for catalogues to keep them distinct from user uploads.

## Server-side only

Sources are imported via the picker config which is in turn consumed by `createHandlers()` in the route file. They only ever execute on the server. Do not import `cardartpicker/sources` from a client component — it will pull `node:fs` and other server-only imports into your client bundle.

## See also

- [../api/sources.md](../api/sources.md)
- [../architecture.md](../architecture.md)

# Sources API

Sources are the pluggable adapters that turn a card identifier into a list of `CardOption`s. They run server-side only.

Import from `cardartpicker/sources`.

## `Source` contract

```ts
type Source = {
  name: string
  getOptions(id: CardIdentifier): Promise<CardOption[]>
  getImage?(optionId: string): Promise<ArrayBuffer>   // optional override
}

type CardIdentifier = {
  name: string                  // "Sol Ring"
  setHint?: string              // "C21" — boost priority, do not filter
  collectorHint?: string        // "472"
  type: "card" | "token"
}

type CardOption = {
  id: string                    // unique within source: "scryfall:abc123"
  sourceName: string
  cardName: string
  imageUrl: string              // full-res front
  thumbnailUrl?: string
  backImageUrl?: string         // DFC back if paired
  meta: {
    setCode?: string
    collectorNumber?: string
    artist?: string
    dpi?: number
    language?: string
    tags?: string[]
    userUploaded?: boolean
  }
}
```

`name` must be unique across the picker's source array — it is the user-visible label and is used by `buildZip()` to dispatch `getImage` calls.

`id` must be unique across the entire picker. Convention: `"sourceslug:opaque-id"` (e.g. `"scryfall:abc123"`, `"mpcfill:xyz"`, `"local:filename"`, `"custom:nanoid"`).

## `defineSource(s)`

Identity helper that gives you type inference and a single import to anchor on.

```ts
import { defineSource } from "cardartpicker/sources"

const myProxies = defineSource({
  name: "My Proxies",
  async getOptions({ name }) {
    return [/* ... */]
  },
})
```

## Built-in: `scryfall`

```ts
import { scryfall } from "cardartpicker/sources"
```

Hits `GET /cards/search?unique=prints&q=!"{name}"` with exact-name match.

- DFC handling: maps `card_faces[0].image_uris.png` to `imageUrl`, `card_faces[1].image_uris.png` to `backImageUrl`.
- `setHint` is used to **boost** matching prints to the front of the array, never to filter. Users can still cycle to other prints.
- 404 from Scryfall (unknown card) returns `[]` — not an error. Other non-2xx throws.

Source: `packages/cardartpicker/src/sources/scryfall.ts`.

## Built-in: `mpcFill`

```ts
import { mpcFill, createMpcFill } from "cardartpicker/sources"
```

Two-step fetch:

1. `POST /2/editorSearch/` with full search settings → identifier strings
2. `POST /2/cards/` with those identifiers → full card data

Source list (`/2/sources/`) is loaded once and cached in the source instance.

Pre-built `mpcFill` uses defaults. `createMpcFill({ baseUrl, sourceFilter })` lets you point at a staging instance or restrict to specific source PKs.

Source: `packages/cardartpicker/src/sources/mpcfill.ts`.

## Custom sources

```ts
import { defineSource } from "cardartpicker/sources"
import { readdir } from "node:fs/promises"

const myProxies = defineSource({
  name: "My Proxies",
  async getOptions({ name }) {
    const files = await readdir("./public/my-proxies")
    return files
      .filter(f => f.toLowerCase().includes(name.toLowerCase()))
      .map(f => ({
        id: `local:${f}`,
        sourceName: "My Proxies",
        cardName: name,
        imageUrl: `/my-proxies/${f}`,
        meta: {},
      }))
  },
})
```

See [guides/custom-source.md](../guides/custom-source.md) for a full walkthrough.

## `getImage` optional override

By default, the download route fetches each option's `imageUrl` directly. If your source needs auth headers, signed URLs, or a different format, implement `getImage(optionId)`:

```ts
defineSource({
  name: "S3 Bucket",
  async getOptions(id) { /* ... */ },
  async getImage(optionId) {
    const signedUrl = await s3.signedUrl(optionId)
    const res = await fetch(signedUrl)
    return res.arrayBuffer()
  },
})
```

`getImage` is called by `buildZip()` for the **front face only**. DFC back faces always go through plain `fetch(backImageUrl)` — keep `backImageUrl` as a publicly fetchable URL or pre-sign it inside `getOptions`.

## Progressive fetch implications

`getOptions` is called twice along the user journey:

1. **Default print:** `picker.getDefaultPrint(name)` walks sources in array order and returns the first option from the first source that has any. Put your most authoritative source (Scryfall) first.
2. **Full options:** `picker.searchCard(id)` calls all sources in parallel for the same card. Both calls share the same cache key, so the second call is a cache hit.

If your source is slow, this matters: it will block the default-print fast path if it is first in the array, and the parallel-fetch lazy path will be gated on its slowest source.

## Aggregation

`createPicker` runs sources via `Promise.all([runSource(...)])` where each `runSource` catches errors itself and returns `{ ok: false }`. One source dying does not break others. Results are returned to the client as `SourceResult[]`.

## See also

- [../guides/custom-source.md](../guides/custom-source.md)
- [server.md](./server.md) — route shapes that consume sources
- [../architecture.md](../architecture.md) — partial-failure model

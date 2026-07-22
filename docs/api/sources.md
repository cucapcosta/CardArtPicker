# Sources API

Sources are the pluggable adapters that turn a card identifier into a list of `CardOption`s. They run server-side only.

Import from `cardartpicker/sources`.

## `Source` contract

```ts
type Source = {
  name: string
  getOptions(id: CardIdentifier): Promise<CardOption[]>
  getDefaults?(ids: CardIdentifier[]): Promise<Map<string, CardOption>>   // optional batch
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

## Built-in: `createMpcFillIndex` (pre-built JSON index)

```ts
import { createMpcFillIndex } from "cardartpicker/sources"
import type { MpcFillIndexSource } from "cardartpicker/sources"
```

Reads an MPC Fill index JSON over HTTP and serves matches from memory. O(1) lookups, no per-request fan-out to a volunteer-run upstream.

The hosted reference index lives at **`https://mtg.forjadeguerra.com.br/api/index-json`** and is updated periodically.

```ts
import { createPicker } from "cardartpicker"
import { scryfall, createMpcFillIndex } from "cardartpicker/sources"

const mpc = createMpcFillIndex({
  indexUrl: "https://mtg.forjadeguerra.com.br/api/index-json",
  refreshMs: 60 * 60 * 1000,        // optional, hourly poll
  onRefresh: () => picker.clearCache(),
})

const picker = createPicker({ sources: [scryfall, mpc] })
```

### Options

| Option | Type | Purpose |
|---|---|---|
| `indexUrl` | `string` | URL the source GETs (with `If-Modified-Since` on later polls) |
| `index` | `MpcFillIndexFile` | Pass an in-memory file directly (skips fetch). Mutually exclusive with `indexUrl`. |
| `sourceFilter` | `number[]` | Whitelist of MPC source PKs to keep |
| `fetchInit` | `RequestInit` | Custom headers/agent on the fetch |
| `refreshMs` | `number` | Poll interval. `0`/unset = no auto-refresh. |
| `onRefresh` | `(info) => void` | Fired when a poll returns 200 and the cache was replaced. |

### Returned source

`createMpcFillIndex` returns `MpcFillIndexSource`, which extends `Source` with two extras:

```ts
type MpcFillIndexSource = Source & {
  refresh(): Promise<boolean>   // force a refetch; returns true if cache changed
  dispose(): void               // stop the refresh timer
}
```

Use `refresh()` for manual triggers (e.g. a webhook from your admin), `dispose()` on shutdown.

### Auto-update flow

1. First call → fetches the URL, caches the parsed file in memory, stores `Last-Modified`.
2. Every `refreshMs` → polls with `If-Modified-Since`.
   - **304** → cache untouched, no body transferred.
   - **200** → parse new body, swap inner cache atomically, fire `onRefresh`.
3. Pair `onRefresh` with `picker.clearCache()` so stale page-keyed search results are dropped — otherwise the source is fresh but `picker.searchCard()` keeps serving cached pages until `cacheTTL` expires (default 1h, often configured higher).

### Limitations

- **Lag of up to `refreshMs`** between the index being updated and consumers seeing it. Smaller value = faster propagation, more 304 traffic. Bypass with a manual `source.refresh()`.
- **Without `onRefresh: () => picker.clearCache()`** the source has fresh JSON but the picker still returns previously-cached search results until `cacheTTL` elapses. Always wire both together.
- **Already-rendered browser sessions** keep showing the options they were given on slot mount. Only fresh requests (next slot click, page reload, SSR refetch) see the new index.
- **Memory footprint** — the parsed index lives in memory. Today's MPC Fill index is ~34MB JSON / ~75MB parsed. Per process.
- **`Last-Modified` granularity = 1 second.** Two updates inside the same second won't trigger a 200 on consumers polling between them. Not a real issue at human cadence.
- **No CDN by default.** Requests hit your origin directly. For many consumers, put Cloudflare/etc. in front of the index URL — `Last-Modified` is set, so standard CDN revalidation works.

Source: `packages/cardartpicker/src/sources/mpcfill-index.ts`.

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

## Batch defaults via `getDefaults`

The optional `getDefaults(ids: CardIdentifier[])` method allows a source to resolve multiple card defaults in a single request.

```ts
type Source = {
  getDefaults?(ids: CardIdentifier[]): Promise<Map<string, CardOption>>
}
```

Key format: `` `${type}:${name.toLowerCase()}` `` (e.g. `"card:sol ring"`, `"token:embercleave"`).

- Missing key in the map = no hit; the card is not filtered, just skipped.
- Sources without `getDefaults` fall back to per-card `getOptions` queries with `{ offset: 0, limit: 1 }` for cards earlier sources missed.
- Defaults resolve first-hit in config order: `picker.getDefaultPrints()` walks sources in array order, skipping cards already resolved. Only cards missed by earlier sources reach later ones.

### Scryfall's batching strategy

The built-in Scryfall source partitions requests for efficiency:
- **Plain cards (no `setHint`):** Uses `POST /cards/collection` in 75-card chunks (faster, batch-optimized endpoint).
- **Tokens or `setHint`-ed cards:** Falls back to per-card `GET /cards/search` (required for exact token handling or set boost).

This reduces traffic to tokens and edge cases while batching the common path.

### Custom source example

```ts
const mySource = defineSource({
  name: "My Source",
  async getDefaults(ids) {
    const results = new Map<string, CardOption>()
    for (const id of ids) {
      const key = `${id.type}:${id.name.toLowerCase()}`
      // fetch from your backend...
      if (found) {
        results.set(key, cardOption)
      }
      // if not found, omit the key
    }
    return results
  },
  // getOptions still needed for full search
  async getOptions(id) { /* ... */ },
})
```

## Progressive fetch implications

Multiple endpoints and calls happen along the user journey:

1. **Default prints (fast path):** `POST /defaults` calls `picker.getDefaultPrints(cards)` in one batch per parse. Sources are walked in array order and only cards missed by earlier sources reach later ones. Put your most authoritative source (Scryfall) first.
2. **Full options (lazy path):** `GET /options` calls `picker.searchCard(id)` in parallel when the user cycles or opens the modal. All sources are queried in parallel for this card.

Defaults and options are cached under separate keys (`default:` vs `search:`), so a batch-resolved default does not warm the options cache — a later `GET /options` for that card still fetches `search:` entries upstream. Only the per-card fallback path (no `getDefaults`) warms both, since it calls `getSourcePage` directly.

If your source is slow, this matters: it will block the default-print fast path if it is first in the array, and the parallel-fetch lazy path will be gated on its slowest source. Implement `getDefaults` (or optimize `getOptions`) for large batches.

## Aggregation

`createPicker` runs sources via `Promise.all([runSource(...)])` where each `runSource` catches errors itself and returns `{ ok: false }`. One source dying does not break others. Results are returned to the client as `SourceResult[]`.

## See also

- [../guides/custom-source.md](../guides/custom-source.md)
- [server.md](./server.md) — route shapes that consume sources
- [../architecture.md](../architecture.md) — partial-failure model

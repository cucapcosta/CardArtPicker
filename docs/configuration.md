# Configuration

`createPicker(config)` is the single configuration entry point. The returned `Picker` is passed to `createHandlers()` for route mounting and consulted by `buildZip()` for downloads.

```ts
import { createPicker } from "cardartpicker"
import { scryfall, mpcFill } from "cardartpicker/sources"

export const picker = createPicker({
  sources: [scryfall, mpcFill],
  // everything else has a sane default
})
```

## `PickerConfig` reference

Defined in `packages/cardartpicker/src/types.ts`.

### `sources: Source[]` — required

Array of source adapters, evaluated in order. Order matters in two places:

- **Default print:** `getDefaultPrint()` walks sources first-to-last and returns the first option from the first source that returns any options. Put your most authoritative source first (typically `scryfall`).
- **UI display:** the options modal groups by source in array order.

See [api/sources.md](./api/sources.md) for the `Source` contract.

### `uploadPersistence?: "localStorage" | "session" | UploadAdapter`

Default: **`"localStorage"`** — base64 data URLs in `localStorage`, 5 MB cap, per-device, lost on browser cache clear.

| Value | Behaviour | When to use |
|---|---|---|
| `"localStorage"` (default) | Persists across reloads, per-device | Personal/dev tools, hobby decks |
| `"session"` | In-memory `Map`, cleared on reload | When you don't need persistence |
| `UploadAdapter` | Custom `{save, loadAll, remove}` | Production — store in S3/DB |

See [guides/upload-persistence.md](./guides/upload-persistence.md) for the adapter contract and migration path.

### `cacheTTL?: number`

Default: `3600` (1 hour). Seconds. Controls how long source results are cached server-side.

Lower this for frequently-updated catalogs (e.g. a custom DB-backed source). Raise it for quieter traffic.

### `cacheBackend?: CacheAdapter`

Default: in-memory LRU (`createMemoryCache`) with `max: 500` entries.

```ts
type CacheAdapter = {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<void>
}
```

Provide a Redis or KV-store adapter in production so cache survives across server instances. See [guides/deployment.md](./guides/deployment.md).

### `parserStrict?: boolean`

Default: `false`. When `true`, the deck-list parser throws on the first unparseable line instead of collecting it into `warnings[]`. Use this only when the input is machine-generated and any warning is a bug.

### `sourceTimeoutMs?: number`

Default: `10_000` (10 seconds). Per-source timeout enforced by `withTimeout` in `createPicker`. A timed-out source becomes a `{ ok: false, error: { code: "timeout" } }` `SourceResult` — other sources continue.

Set lower (e.g. `5000`) if you want to fail fast in production.

### `logger?: (level, event, ctx) => void`

Default: `console.log` / `console.warn` / `console.error` with `[cardartpicker]` prefix.

```ts
type Logger = (level: "debug" | "info" | "warn" | "error", event: string, ctx?: unknown) => void
```

Wire to Sentry, pino, or your structured logger. The package emits at least `source.failure` warnings; future events follow the same shape.

### `onDownloadStart?: (selections: Selection[]) => void`

Called server-side at the start of the `POST /download` route. Useful for telemetry — "user X kicked off a 42-image ZIP". Synchronous; do not block.

### `onDownloadComplete?: (zip: Blob) => void`

Called server-side after `buildZip()` returns. Fires before the response is sent.

### `downloadFilename?: (ctx: { selections: Selection[] }) => string`

Default: `"proxies.zip"`. Returns the value used in the `Content-Disposition` header.

```ts
downloadFilename: ({ selections }) =>
  `proxies-${selections.length}-${new Date().toISOString().slice(0, 10)}.zip`
```

## Resolved config

`createPicker` returns `{ config, ... }` with required fields filled in. Read `picker.config.cacheTTL` etc. from your own code if you need to inspect what the picker is actually using.

## See also

- [api/sources.md](./api/sources.md)
- [api/server.md](./api/server.md)
- [guides/deployment.md](./guides/deployment.md)

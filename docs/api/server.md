# Server API

Import from `cardartpicker/server`. This entry point is server-only — never bundled into client code.

## `createHandlers(picker)`

Returns `{ GET, POST }` ready to drop into a Next.js App Router catch-all route.

```ts
// app/api/cardartpicker/[...path]/route.ts
import { createHandlers } from "cardartpicker/server"
import { picker } from "@/lib/picker"

export const { GET, POST } = createHandlers(picker)
```

The handler dispatches by the path segment after `cardartpicker/` in the URL: `/api/cardartpicker/default` → the `default` route, etc.

## Routes

### `GET /default?name=X&type=card|token`

Returns the first option from the first source that has any options for the given card name. `type` defaults to `"card"`.

```
200 → CardOption           (JSON)
400 → { error: "missing name" }
404 → { error: "not-found" }
```

Used by the hook on initial parse to render slots quickly.

### `GET /options?name=X&type=card|token`

Returns the full `SourceResult[]` — every source's outcome, success or failure.

```
200 → SourceResult[]       (JSON)
400 → { error: "missing name" }
```

```ts
type SourceResult =
  | { ok: true; source: string; options: CardOption[] }
  | { ok: false; source: string; error: { code: string; message: string } }
```

Used by the hook lazily when the user cycles arrows or opens the options modal.

### `POST /parse`

Body `{ text: string }` → `ParsedList`.

```
200 → { mainboard, tokens, warnings }   (JSON)
400 → { error: "invalid json" } or zod issues
```

```ts
type ParsedList = {
  mainboard: Array<{ quantity: number } & CardIdentifier>
  tokens: Array<{ quantity: number } & CardIdentifier>
  warnings: Array<{ line: number; raw: string; reason: string }>
}
```

Tolerant by default — unparseable lines go into `warnings[]`, parse continues. Set `parserStrict: true` in `createPicker` config to throw on first warning.

### `POST /download`

Body `{ selections: Selection[], options: Record<string, CardOption> }` → ZIP.

```
200 → application/zip      (Blob, attachment)
400 → { error: "missing selections" }

Headers:
  Content-Type: application/zip
  Content-Disposition: attachment; filename="<configured>"
  X-Failed-Slots: slot-3,slot-7    (only if some images failed)
```

The client passes the option map alongside selections so the server doesn't have to re-resolve options from the cache. Filename is controlled by `downloadFilename` in `PickerConfig` (default `"proxies.zip"`).

DFC handling: if `option.backImageUrl` is set, two files are emitted per slot named `card-name 1.png` and `card-name 2.png`. Quantity > 1 produces `card-name-copy1.png`, `card-name-copy2.png`, etc.

Concurrency `p-limit(8)` with retry on transient failures (`withRetry`, 3 attempts, exponential backoff). Per-image timeout 30s. Failures are collected and reported via the `X-Failed-Slots` header — the ZIP still contains every image that succeeded.

`onDownloadStart` fires before ZIP build, `onDownloadComplete` fires after — both from `PickerConfig`.

### `POST /upload`

`multipart/form-data` with fields `file`, `cardName`, `slotId` → `CardOption`.

```
200 → CardOption                            (JSON, imageUrl is data: URL)
400 → { error: "expected multipart/form-data" }
400 → { error: "missing file" }
400 → { error: "missing cardName or slotId" }
400 → { error: "unsupported mime <type>" }
413 → { error: "file too large (max 20MB)" }
```

Allowed mime types: `image/png`, `image/jpeg`, `image/webp`. Max size 20 MB.

The returned `CardOption` has:
- `id: "custom:<nanoid>"`
- `sourceName: "Custom"`
- `imageUrl`: base64 data URL
- `meta.userUploaded: true`

The client persists this option via the configured `UploadAdapter` (default `localStorage`).

## `createActions(picker)`

Returns server actions (RSC-style) for `searchCard` and `parseList`. Useful when you bypass the route layer and call from a server component.

```ts
import { createActions } from "cardartpicker/server"
import { picker } from "@/lib/picker"

export const { searchCardAction, parseListAction } = createActions(picker)
```

Note: `downloadAction` exists but throws — server actions cannot stream `Blob` cleanly. Use `POST /download` from the client.

## `buildZip(selections, resolver, opts?, picker?)`

Lower-level building block re-exported for advanced cases. Most consumers should use `POST /download`.

```ts
import { buildZip } from "cardartpicker/server"

const zip = await buildZip(
  selections,
  async (optionId) => optionsMap[optionId] ?? null,
  { concurrency: 8, attempts: 3, timeoutMs: 30_000 },
  picker,
)
```

## See also

- [hooks.md](./hooks.md) — client side that consumes these routes
- [sources.md](./sources.md)
- [../configuration.md](../configuration.md)

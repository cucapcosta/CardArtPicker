# CardArtPicker — Design Spec

**Date:** 2026-04-24
**Status:** Design approved, pending implementation plan
**Author:** paulof@pfperiquito.com

## 1. Overview

CardArtPicker is a Next.js package for browsing and selecting Magic: The Gathering card and token proxy art. It aggregates options from multiple sources (Scryfall official prints, MPC Fill community proxies, developer-defined custom sources) behind one unified interface.

**Distribution:** private, shared with friend developers via Git. Monorepo layout with the package plus a local Next.js demo app for live testing.

**Consumers get five layers** they can mix and match:

1. **Sources layer** — pure TypeScript source adapters (`scryfall`, `mpcFill`, `defineSource`)
2. **React hook** — `useCardPicker()` manages list, selections, uploads, downloads
3. **Context provider** — `<CardPickerProvider>` shares picker state across components
4. **Server handlers** — one-line route mount + server actions
5. **Drop-in UI** — `<CardArtPicker />` ships with CSS Modules, themeable via CSS variables

**Architecture pattern:** all external network calls live server-side. Client talks only to dev's own `/api/cardartpicker/*` route to avoid CORS (MPC Fill does not send CORS headers) and keep any future secrets off the browser.

## 2. Goals and non-goals

### Goals

- Drop-in usage — one `createPicker()` config plus one route file and everything works.
- Pluggable sources — devs extend with their own proxy catalogs without forking.
- Progressive fetching — fast initial grid render, lazy expansion per slot.
- Partial failure tolerant — one source down must not break the picker.
- Headless-friendly — package UI is stylable via CSS variables, can also be ignored entirely in favour of the hook.
- Type-safe — full TypeScript types for every layer.

### Non-goals

- Public npm distribution (not right now).
- Print-ready PDF output (skipped — ZIP of PNGs only).
- `.xml` MPC Autofill project files (not target audience).
- Pages Router support (App Router only).
- Sideboard / commander section markers (may be added later).
- Mobile-first UI (desktop focus first; responsive but not optimised).

## 3. Architecture

```
┌─────────────────────────── Next.js app (dev's project) ──────────────────────────┐
│                                                                                    │
│  app/page.tsx                                                                     │
│    <CardArtPicker />  ←── UI component (Layer 5)                                  │
│         ↓ uses                                                                    │
│    useCardPicker()    ←── Hook (Layer 2)                                          │
│         ↓ fetches via                                                             │
│  app/api/cardartpicker/[...path]/route.ts   ←── one-line mount (Layer 4)         │
│    export { GET, POST } from "cardartpicker/server"                               │
│         ↓ reads config                                                            │
│    lib/picker.ts                                                                  │
│    createPicker({ sources: [scryfall, mpcFill, myProxies] })                      │
│         ↓ delegates to                                                            │
│  ──────── package boundary ───────────────────────────────────────────────────    │
│                                                                                    │
│  Sources layer  (Layer 1)                                                         │
│   ├── scryfall        → Scryfall HTTPS JSON                                       │
│   ├── mpcFill         → mpcfill.com /2/* endpoints                                │
│   └── defineSource()  → dev's custom source (folder/DB/S3)                        │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

## 4. Package structure (monorepo)

```
CardArtPicker/
├── package.json               # workspaces root
├── pnpm-workspace.yaml
├── packages/
│   └── cardartpicker/
│       ├── package.json
│       ├── tsup.config.ts     # build → multiple entry points
│       ├── src/
│       │   ├── index.ts              # core types, createPicker()
│       │   ├── sources/
│       │   │   ├── index.ts          # defineSource, re-exports
│       │   │   ├── scryfall.ts
│       │   │   ├── mpcfill.ts
│       │   │   └── types.ts          # Source, Card, CardOption
│       │   ├── parser/
│       │   │   ├── decklist.ts
│       │   │   └── decklist.test.ts
│       │   ├── server/
│       │   │   ├── index.ts          # { GET, POST } route handlers
│       │   │   ├── actions.ts        # server actions
│       │   │   └── download.ts       # ZIP builder
│       │   ├── client/
│       │   │   ├── useCardPicker.ts
│       │   │   ├── CardPickerProvider.tsx
│       │   │   └── index.ts
│       │   └── ui/
│       │       ├── CardArtPicker.tsx
│       │       ├── CardGrid.tsx
│       │       ├── CardSlot.tsx
│       │       ├── ListImporter.tsx
│       │       ├── UploadDialog.tsx
│       │       └── styles/
│       │           ├── CardArtPicker.module.css
│       │           └── theme.css      # CSS vars for override
│       └── AGENTS.md                  # internal contribution rules
├── examples/
│   └── nextjs-demo/
│       ├── package.json
│       ├── app/
│       │   ├── api/cardartpicker/[...path]/route.ts
│       │   ├── page.tsx
│       │   ├── layout.tsx
│       │   └── custom-source/page.tsx
│       └── lib/picker.ts
├── docs/
│   ├── llms.txt
│   ├── llms-full.txt
│   ├── overview.md
│   ├── architecture.md
│   ├── configuration.md
│   ├── api/
│   └── guides/
├── AGENTS.md                  # consumer-repo agent instructions
└── README.md
```

### Entry points (tsup multi-entry)

- `cardartpicker` — core + types, server-safe
- `cardartpicker/server` — route handlers, actions, ZIP builder
- `cardartpicker/client` — hook + context (`"use client"`)
- `cardartpicker/ui` — UI components (`"use client"`)
- `cardartpicker/sources` — built-in source adapters + `defineSource`

Tree-shakable. Server code never pulled into client bundle.

### Tooling

- TypeScript, tsup (build), Vitest (test), pnpm workspaces
- Next.js 15 App Router in demo
- React 19

## 5. Data sources layer

### Types

```ts
export type CardIdentifier = {
  name: string                  // "Sol Ring"
  setHint?: string              // "C21" (from list parser, optional)
  collectorHint?: string        // "472"
  type: "card" | "token"
}

export type CardOption = {
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
  }
}

export type Source = {
  name: string
  getOptions(id: CardIdentifier): Promise<CardOption[]>
  getImage?(optionId: string): Promise<ArrayBuffer>   // optional custom download
}

export function defineSource(s: Source): Source { return s }
```

### Built-in adapters

- **`scryfall.ts`** — `GET /cards/search?q=!"{name}"&unique=prints` → map to `CardOption[]`. DFC handling: sets `backImageUrl` from `card_faces[1].image_uris`. Uses `setHint` to boost priority (not filter). Batch via `POST /cards/collection` for 75 cards per call on initial load.
- **`mpcfill.ts`** — two-step: `POST /2/editorSearch/` → identifiers, then `POST /2/cards/` → full data. Pulls all sources from `GET /2/sources/` on init (cached). Detects DFC pairs via `GET /2/DFCPairs/`. Respects polite rate (no official limit, keep below 5 req/s).

### Custom source example

```ts
// examples/nextjs-demo/lib/picker.ts
import { createPicker, scryfall, mpcFill, defineSource } from "cardartpicker/sources"
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
        meta: {}
      }))
  }
})

export const picker = createPicker({
  sources: [scryfall, mpcFill, myProxies],
  uploadPersistence: "localStorage",
})
```

### Aggregation

`createPicker` runs sources in parallel via `Promise.allSettled`, flattens, dedups by `id`, groups by `cardName`. Source order = display order in UI.

### Caching

Server-side LRU keyed by `name+type`. Default TTL 1 hour. Dev overrides via `{ cacheTTL, cacheBackend }`. Respects Scryfall 50-100ms inter-request delay.

### Progressive fetch strategy

1. **On list import (fast path):** fetch only default print per card from Scryfall via `POST /cards/collection` (75 cards/call). Grid renders immediately; each slot shows 1 option with "1+" badge.
2. **On slot interaction (lazy path):** click slot or hover arrows → fetch remaining sources in parallel for that card; cache client-side. Subsequent interactions instant.
3. **Eager flag:** `<CardArtPicker eagerLoad />` forces full fetch upfront; good for small lists.

## 6. Core API

### Shared types

```ts
type Selections = Record<string, string>   // { [slotId]: optionId }

type Slot = {
  id: string                  // "mainboard-0", "tokens-3"
  section: "mainboard" | "tokens"
  cardName: string
  quantity: number            // from parsed list
  identifier: CardIdentifier
  options: CardOption[]       // fills in as progressive fetch resolves
  selectedOptionId: string | null
  flipped: boolean            // DFC display state (selection unchanged)
  status: "loading" | "ready" | "partial" | "not-found" | "error"
}

type Selection = {             // array form used for server/ZIP building
  slotId: string
  optionId: string
  quantity: number
}

type SourceResult =
  | { ok: true; source: string; options: CardOption[] }
  | { ok: false; source: string; error: { code: string; message: string } }
```

The hook exposes `Selections` (object form) for ergonomic consumer access. Internally the package converts to `Selection[]` (array form) when calling `buildZip` or posting to `/api/cardartpicker/download`.

### Config entry point

```ts
export function createPicker(config: PickerConfig): Picker

type PickerConfig = {
  sources: Source[]
  uploadPersistence?: "localStorage" | "session" | UploadAdapter
  cacheTTL?: number              // default 3600s
  cacheBackend?: CacheAdapter    // default in-memory LRU
  parserStrict?: boolean         // default false (tolerant)
  sourceTimeoutMs?: number       // default 10000
  logger?: (level: string, event: string, ctx: unknown) => void
  onDownloadStart?: (selections: Selection[]) => void
  onDownloadComplete?: (zip: Blob) => void
  downloadFilename?: (ctx: { selections: Selection[] }) => string
}

type Picker = {
  config: PickerConfig
  searchCard(id: CardIdentifier): Promise<SourceResult[]>
  getDefaultPrint(name: string): Promise<CardOption | null>
  buildZip(selections: Selection[]): Promise<Blob>
}
```

### Route handler (one-line mount)

```ts
// app/api/cardartpicker/[...path]/route.ts
import { createHandlers } from "cardartpicker/server"
import { picker } from "@/lib/picker"

export const { GET, POST } = createHandlers(picker)
```

**Mounted routes:**
- `GET /api/cardartpicker/default?name=Sol+Ring&type=card` → `CardOption`
- `GET /api/cardartpicker/options?name=Sol+Ring&type=card` → `SourceResult[]`
- `POST /api/cardartpicker/parse` → `{ mainboard, tokens, warnings }`
- `POST /api/cardartpicker/download` → `application/zip`
- `POST /api/cardartpicker/upload` → echoes uploaded option

### Server actions

```ts
import { searchCardAction, parseListAction, downloadAction } from "cardartpicker/server"
```

### Client hook

```ts
const {
  list,              // { mainboard: Slot[], tokens: Slot[] }
  parseList,         // (text: string) => Promise<void>
  getSlot,           // (slotId) => Slot
  cycleOption,       // (slotId, dir: "next" | "prev") => void
  selectOption,      // (slotId, optionId) => void
  flipSlot,          // (slotId) => void   // DFC front/back view
  uploadCustom,      // (slotId, file) => Promise<void>
  download,          // () => Promise<void>
  selections,        // { [slotId]: optionId }   — saved selection
  onSelectionChange, // (cb) => unsubscribe
  loading,
  errors,
} = useCardPicker()
```

### Context

```tsx
<CardPickerProvider picker={picker}>
  <ListImporter />
  <CardArtPicker />
  <ExportButton />
</CardPickerProvider>
```

### Selection export

```ts
const { selections } = useCardPicker()
// { "slot-1": "scryfall:abc", "slot-2": "mpcfill:xyz", ... }
```

## 7. List parser

### Supported formats

```
1 Sol Ring
4 Lightning Bolt
1x Jace, the Mind Sculptor
1 Sol Ring (C21) 472
1 Arlinn, the Pack's Hope // Arlinn, the Moon's Fury (MID) 217

TOKENS:
1 Goblin Token (GRN) 12
3 Treasure
```

### Rules

- Empty lines → skip
- Leading `//` or `#` → comment, skip
- `TOKENS:` (case-insensitive, colon optional) → section marker; subsequent lines = tokens
- Mainboard is default section (before any marker)
- Line regex: `^(\d+)[xX]?\s+(.+?)(?:\s+\((\w+)\)(?:\s+(\S+))?)?$`
- DFC `Front // Back` names → stored as single `name`, sources resolve
- Unrecognized lines → added to `warnings[]`, import proceeds
- `parserStrict: true` → throws on any warning

### Output

```ts
type ParsedList = {
  mainboard: Array<{ quantity: number } & CardIdentifier>
  tokens: Array<{ quantity: number } & CardIdentifier>
  warnings: Array<{ line: number; raw: string; reason: string }>
}
```

### Slot expansion

Each `{ quantity: 4, name: "Lightning Bolt" }` → 4 grid slots, each with independent selection. Slot id = `"{section}-{index}"`.

## 8. Download + upload flow

### Download

Format: ZIP of PNGs, one per unique card copy. Quantity > 1 produces `card-name-copy1.png`, `card-name-copy2.png`. DFCs produce two files per slot named `card-name 1.png` and `card-name 2.png` so pairing is visually obvious.

**Client:**
```ts
async function download() {
  const res = await fetch("/api/cardartpicker/download", {
    method: "POST",
    body: JSON.stringify({ selections, quantities }),
  })
  const blob = await res.blob()
  saveAs(blob, "proxies.zip")
}
```

**Server** (`server/download.ts`):
1. Resolve each `CardOption` via cache lookup.
2. Custom source `getImage(optionId)` if defined, else `fetch(option.imageUrl)`.
3. DFC → fetch both faces, emit two files.
4. Build ZIP via `jszip`.
5. Stream as `Response(blob, { headers: "application/zip" })`.
6. Concurrency `p-limit(8)`. Retry 3× w/ exponential backoff on 5xx.

### Upload (end-user custom art)

**UI:** `<UploadDialog>` per slot — file input + drag-drop. Accepts `image/png`, `image/jpeg`, `image/webp`. Max 20 MB (config).

**Client:** FormData POST to `/api/cardartpicker/upload`, receives `CardOption`, persists via adapter, adds to slot, auto-selects.

**Server:** multipart parse, mime + size validation, generate `optionId = "custom:{uuid}"`, return `CardOption { sourceName: "Custom", meta: { userUploaded: true } }`. If dev configured `onUpload(file, meta)` callback, call it (for S3/DB persistence); else return data URL.

### Persistence adapter

```ts
type UploadAdapter = {
  save(option: CardOption): Promise<void>
  loadAll(): Promise<CardOption[]>
  remove(id: string): Promise<void>
}
```

**Defaults:**
- `"localStorage"` (default) — client-only, base64 data URLs, 5 MB cap
- `"session"` — in-memory, cleared on reload
- Custom — dev uploads to S3/DB

## 9. UI component

### `<CardArtPicker />` props

```tsx
<CardArtPicker
  initialList?: string
  eagerLoad?: boolean
  columns?: number | "auto"
  slotSize?: "sm" | "md" | "lg"
  onSelectionChange?: (s: Selections) => void
  onDownload?: (zip: Blob) => void
  onError?: (err: Error) => void
  className?: string
  theme?: Partial<ThemeVars>
/>
```

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ [ Import Deck List ]  [ Download (42) ]                          │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  Paste Moxfield list…                              [ Parse ] │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ Mainboard (38)                                                    │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                     │
│ │ img  │ │ img  │ │ img  │ │ img  │ │ img  │                     │
│ │      │ │      │ │      │ │ ⟳    │ │      │                     │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                     │
│  ◀ Sol ▶  ◀Bolt▶  ◀Bolt▶  ◀Bolt▶  ◀Bolt▶                         │
│  Scry 1/12  MPC 3/47  MPC 3/47  Scry 1/12  Scry 1/12             │
│                                                                   │
│ Tokens (4)                                                        │
│ ┌──────┐ ┌──────┐ ...                                             │
└──────────────────────────────────────────────────────────────────┘
```

### Per-slot UI

```
┌──────────────────────┐
│    [card image]      │   ← click → options modal
│         ⟳            │   ← flip (DFC only)
├──────────────────────┤
│  ◀   Sol Ring   ▶   │   ← prev/next + name
│  MPC Fill · 3 / 47  │   ← source · position / total
│  × 2 copies          │   ← count from deck
│  [ upload ]          │
└──────────────────────┘
```

### Interactions

- **Click image** → modal grid of all options, grouped by source
- **Arrows** → cycle within current filter; keyboard `←` `→` on focused slot
- **Flip (⟳)** → toggles to back face; download emits both faces regardless
- **Upload** → file picker; on success, custom option appears, auto-selected
- **Bulk bar** (sticky top): filter by source, min DPI, "reset all to default"

### Empty / loading / error states

- Empty list → centered textarea prompt
- Loading default → skeleton shimmer
- Partial fetch failure → red border + "⚠ options partial" chip, arrows still work
- Card not found (zero options across all sources) → placeholder + "not found — check name" overlay; counted in banner "2 of 42 cards not found"; excluded from download
- Download failed → toast + retry

### Styling

- `CardArtPicker.module.css` — structural
- `theme.css` exposes CSS variables: `--cap-bg`, `--cap-border`, `--cap-accent`, `--cap-slot-radius`, `--cap-font`
- No Tailwind assumption. No CSS-in-JS runtime.

## 10. Error handling

**Principle:** partial failure never kills the picker.

### Error taxonomy

| Layer | Error | User-visible | Recovery |
|---|---|---|---|
| Parser | Malformed line | Warning banner, import proceeds | User fixes list |
| Source | One source 5xx / timeout | Options from others + "⚠ MPC Fill failed" chip on slot | Chip → retry that source |
| Source | ALL sources fail for a card | Placeholder + "no options" overlay | Retry button |
| Default print | Scryfall fails on load | Skeleton persists, background retry 3× backoff | Auto-recover |
| Rate limit | 429 | Honour `Retry-After`, else backoff | Automatic |
| Search | Parsed OK, zero options anywhere | Placeholder + "not found — check name", banner "2 of 42 not found" | User edits list |
| Download | One image fails | ZIP built with successes, header `X-Failed: slot-3,...` | Toast w/ missing list |
| Upload | Too large / wrong type | Inline modal error | Pick different file |
| Upload | localStorage quota exceeded | Toast: "session only, storage full" | Clear uploads or configure S3 |
| Cache | Backend throws | Fall through to network, log warning | Transparent |

### Retry

- Network: 3 retries, exponential backoff (100ms, 400ms, 1200ms), ±20% jitter
- 4xx except 429: no retry
- 429: honour `Retry-After`, else backoff
- 5xx / network error: retry

### Timeouts

- Per-source default 10s (`sourceTimeoutMs` config)
- Download image 30s

### Logging

```ts
createPicker({ logger: (level, event, ctx) => { /* dev plugs in */ } })
```

Default = `console` with `[cardartpicker]` prefix.

## 11. Testing

### Unit (Vitest)

- `parser/decklist.test.ts` — all formats, tokens section, DFCs, comments, malformed, strict mode
- `sources/scryfall.test.ts` — mocked fetch, query building, DFC mapping, set-hint boosting, batch endpoint
- `sources/mpcfill.test.ts` — two-step flow, cardback routing, error fallback
- `server/download.test.ts` — ZIP contents match selections, DFC dual-file naming, duplicate handling
- `server/upload.test.ts` — mime validation, size cap, adapter round-trip

### Integration

- **Route handler** — spin up `createHandlers(picker)` in test Next.js app; verify all 5 routes end-to-end with mocked sources
- **Hook + Provider** — React Testing Library + `msw`; verify progressive load → lazy expand → cycle → select → download

### Contract (gated `RUN_LIVE_TESTS=1`)

- Real Scryfall with known stable cards (Sol Ring, Jace, Arlinn) — validates response shape, nightly CI only
- Real MPC Fill, respects rate limit, small fixture set

### Components

- Vitest + `@testing-library/react` + `jsdom`
- Behaviour-focused, not line coverage

### Coverage target

- 80% lines for parser, sources, server handlers
- UI: behaviour, not line coverage

### Smoke test

Playwright against `pnpm dev` instance of demo app:
1. Paste sample Moxfield list
2. Wait for grid render
3. Cycle one slot
4. Upload fixture PNG
5. Click download → assert ZIP filenames

## 12. Demo app — "ProxyMart"

Themed as a fictional card proxy store. Shop chrome wraps `<CardArtPicker />`; package stays headless. Exercises theme vars + real-world styling.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🃏 ProxyMart          Decks  Sets  About       🛒 42 items     │
├─────────────────────────────────────────────────────────────────┤
│  Build your proxy order                                          │
│  ┌───────────────────────────────────┬──────────────────────┐   │
│  │   <CardArtPicker />                │  Order Summary       │   │
│  │   (themed w/ shop colors)          │  Mainboard     38    │   │
│  │   Slots styled as product tiles   │  Tokens         4    │   │
│  │   - image                          │  Subtotal      $0    │   │
│  │   - card name                      │  Shipping   free*    │   │
│  │   - "from {source}"                │  [  Checkout  ]      │   │
│  │   - ◀ ▶ to change art              │   *demo — triggers   │   │
│  │   - "× 4 in deck"                  │    download          │   │
│  └───────────────────────────────────┴──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Routes

- `/` — main shop with Scryfall + MPC Fill + one custom local-folder source
- `/custom-source` — same shop UI, demonstrates adding a dev source

### Demo-specific pieces

- Header: shop logo, fake nav, cart badge (reads `selections.length` from hook)
- Sticky right sidebar: order summary w/ checkout button (calls `download()`)
- Theme override in `app/layout.tsx` sets CSS vars for dark navy + gold palette
- Product-tile wrapper around each slot via `className` prop — package internals untouched

### Scripts

```json
{
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "test:e2e": "playwright test"
}
```

### Run loop

```
pnpm install
pnpm --filter nextjs-demo dev
# → http://localhost:3000
```

Workspace linking + tsup watch = package edits hot-reload in demo.

## 13. LLM / agent documentation

### `docs/llms.txt` + `docs/llms-full.txt`

Machine-readable index for general LLMs. `llms.txt` = short index pointing at docs. `llms-full.txt` = concatenated full content, single file.

### `AGENTS.md` (repo root + re-exported in package)

Instructions for coding agents (Claude Code, Cursor, Copilot) working in consumer repos.

**Mandatory confirmations with the human:**

- **Upload persistence defaults to `"localStorage"`** — base64 data URLs, 5 MB cap, per-device, lost on cache clear. Before building S3/DB persistence, agent must surface this default to the human and confirm it does not already meet the need.
- **Sources run server-side.** Never call Scryfall or MPC Fill from client code.
- **CORS.** MPC Fill has no CORS headers; client-side direct fetch will fail. Always route through the mounted handler.

**Anti-patterns:**
- Installing Tailwind to style the picker (it ships CSS Modules — use `theme` prop or CSS vars)
- Wrapping every call in try/catch (package handles partial failure)
- Bypassing the hook to call routes directly from components

### `packages/cardartpicker/AGENTS.md` (internal contributions)

- Preserve public API unless major version bump
- New source → add to `sources/`, export, add test
- Never import `ui/` into `server/` — tsup entry boundaries enforce
- `pnpm test` + `pnpm build` before claiming done

### Build step

`scripts/build-llm-docs.ts` concatenates `docs/**/*.md` into `docs/llms-full.txt` on build. Single source of truth.

## 14. Open items for implementation plan

- Package manager lockfile: pnpm
- Build target: ES2022, dual ESM/CJS via tsup
- Peer deps: `react >= 19`, `next >= 15`
- Internal deps: `jszip`, `p-limit`, `nanoid`, `zod` (validate config + request bodies)
- No telemetry, no analytics by default

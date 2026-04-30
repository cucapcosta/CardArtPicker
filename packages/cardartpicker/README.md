# cardartpicker

[![npm](https://img.shields.io/npm/v/cardartpicker.svg)](https://www.npmjs.com/package/cardartpicker)
[![license](https://img.shields.io/npm/l/cardartpicker.svg)](https://github.com/cucapcosta/CardArtPicker/blob/main/LICENSE)

Next.js drop-in for browsing and selecting trading-card proxy art across multiple sources (Scryfall, MPC Fill, custom). The package is a transport — it queries upstream APIs and bundles selected images into a ZIP for personal printing. It does not host card art.

## Install

```bash
pnpm add cardartpicker
# or: npm i cardartpicker / yarn add cardartpicker
```

Peer deps: `react@>=19`, `next@>=15`. Tailwind CSS v4 is required for the bundled UI — see [Styling](#styling).

Add to `next.config.mjs`:

```js
export default { transpilePackages: ["cardartpicker"] }
```

## Quick start

```ts
// lib/picker.ts
import { createPicker } from "cardartpicker"
import { scryfall, mpcFill } from "cardartpicker/sources"
export const picker = createPicker({ sources: [scryfall, mpcFill] })
```

> Prefer `createMpcFillIndex` with our hosted JSON (`https://mtg.forjadeguerra.com.br/api/index-json`) over the live `mpcFill` source — no per-request fetches to mpcfill.com, O(1) in-memory lookups, and auto-refresh via `refreshMs` + `onRefresh: () => picker.clearCache()`. See [docs/api/sources.md](https://github.com/cucapcosta/CardArtPicker/blob/main/docs/api/sources.md#built-in-creatempcfillindex-pre-built-json-index).

```ts
// app/api/cardartpicker/[...path]/route.ts
import { createHandlers } from "cardartpicker/server"
import { picker } from "@/lib/picker"
export const { GET, POST } = createHandlers(picker)
```

```tsx
// app/page.tsx
import { CardArtPicker } from "cardartpicker/ui"
export default () => <CardArtPicker initialList="4 Lightning Bolt" />
```

Full walkthrough: [docs/guides/quickstart.md](https://github.com/cucapcosta/CardArtPicker/blob/main/docs/guides/quickstart.md).

## Styling

The UI uses Tailwind CSS v4 utility classes at runtime — **Tailwind v4 is required** in the consuming app:

```css
/* app/globals.css */
@import "tailwindcss";
@source "../node_modules/cardartpicker/dist";
```

The package also ships `cardartpicker/styles.css` containing the `--cap-*` token defaults and a few helper utilities (loaded automatically by `<CardArtPicker>`). Theme via CSS variables on a wrapper `[data-cap-theme]` element. See [docs/api/ui.md](https://github.com/cucapcosta/CardArtPicker/blob/main/docs/api/ui.md).

> A Tailwind-free, fully-precompiled stylesheet is on the roadmap for v0.2.

## Important defaults

> **`uploadPersistence` defaults to `"localStorage"`** — user uploads are stored as base64 data URLs (5 MB cap, per-device, lost on cache clear). Fine for hobby/personal use. **Switch to a custom `UploadAdapter` (S3/DB) before production.** See [docs/guides/upload-persistence.md](https://github.com/cucapcosta/CardArtPicker/blob/main/docs/guides/upload-persistence.md).

| key | default | notes |
|---|---|---|
| `cacheTTL` | 3600s | server-side LRU |
| `sourceTimeoutMs` | 10_000 | per source |
| `parserStrict` | false | tolerant deck-list parsing |

## Documentation

- [Overview](https://github.com/cucapcosta/CardArtPicker/blob/main/docs/overview.md) — five layers, distribution model
- [Architecture](https://github.com/cucapcosta/CardArtPicker/blob/main/docs/architecture.md)
- [Configuration](https://github.com/cucapcosta/CardArtPicker/blob/main/docs/configuration.md)

API: [Sources](https://github.com/cucapcosta/CardArtPicker/blob/main/docs/api/sources.md) · [Server](https://github.com/cucapcosta/CardArtPicker/blob/main/docs/api/server.md) · [Hooks](https://github.com/cucapcosta/CardArtPicker/blob/main/docs/api/hooks.md) · [UI](https://github.com/cucapcosta/CardArtPicker/blob/main/docs/api/ui.md)

Guides: [Quick start](https://github.com/cucapcosta/CardArtPicker/blob/main/docs/guides/quickstart.md) · [Custom source](https://github.com/cucapcosta/CardArtPicker/blob/main/docs/guides/custom-source.md) · [Upload persistence](https://github.com/cucapcosta/CardArtPicker/blob/main/docs/guides/upload-persistence.md) · [Deployment](https://github.com/cucapcosta/CardArtPicker/blob/main/docs/guides/deployment.md)

## Attribution

Card data and Scryfall-sourced images come from [Scryfall](https://scryfall.com), used per their [API guidelines](https://scryfall.com/docs/api). If you ship a public app using this package, surface a "card data via Scryfall" credit in your UI. The bundled `scryfall` adapter caches results server-side; raise `cacheTTL` to ≥86400 (24h) in production to respect Scryfall's caching policy.

The `mpcFill` adapter queries [MPC Fill](https://mpcfill.com), a third-party community project. Opt in by including it in your `sources` array; omit if you don't want it.

## Personal-use notice

For personal, non-commercial proxy printing only. Trading-card games and individual card illustrations are protected by trademark and copyright held by their publishers and artists. You are responsible for ensuring your use of this tool, the upstream sources, and any printed output complies with applicable law and the rights-holders' terms.

Not affiliated with, endorsed by, or sponsored by Wizards of the Coast LLC, Scryfall LLC, MPC Fill, or any trading-card-game publisher.

## License

MIT — see [LICENSE](https://github.com/cucapcosta/CardArtPicker/blob/main/LICENSE). MIT disclaims all warranty; this README is not legal advice.

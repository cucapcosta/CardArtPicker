# cardartpicker

[![npm](https://img.shields.io/npm/v/cardartpicker.svg)](https://www.npmjs.com/package/cardartpicker)
[![license](https://img.shields.io/npm/l/cardartpicker.svg)](https://github.com/cucapcosta/CardArtPicker/blob/main/LICENSE)

Next.js drop-in for browsing and selecting Magic: The Gathering card and token proxy art across multiple sources (Scryfall, MPC Fill, custom).

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

## Disclaimer

Not affiliated with Wizards of the Coast. Magic: The Gathering, card names, and related marks are trademarks of Wizards of the Coast LLC. This library is a tool for personal proxy printing — verify the terms of any upstream source (Scryfall, MPC Fill) before use.

## License

MIT — see [LICENSE](https://github.com/cucapcosta/CardArtPicker/blob/main/LICENSE).

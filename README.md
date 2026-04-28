# CardArtPicker

Next.js drop-in for browsing and selecting trading-card proxy art across multiple sources (Scryfall, MPC Fill, custom). The package is a transport — it queries upstream APIs and bundles selected images into a ZIP for personal printing. It does not host card art.

## Install

```bash
pnpm add cardartpicker
```

Requires Next.js 15 (App Router), React 19, and Tailwind CSS v4 in the consuming app.

## Quick start

Three files, ten lines. See [docs/guides/quickstart.md](./docs/guides/quickstart.md) for the full walkthrough.

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

Add `transpilePackages: ["cardartpicker"]` to `next.config.mjs`.

## Documentation

- [Overview](./docs/overview.md) — five layers, distribution model
- [Architecture](./docs/architecture.md) — request flow, progressive fetch, CORS rationale
- [Configuration](./docs/configuration.md) — full `PickerConfig` reference

### API

- [Sources](./docs/api/sources.md) — `Source`, `defineSource`, built-in adapters
- [Server](./docs/api/server.md) — `createHandlers`, route shapes
- [Hooks](./docs/api/hooks.md) — `useCardPicker`, `<CardPickerProvider>`
- [UI](./docs/api/ui.md) — `<CardArtPicker>` props, theming

### Guides

- [Quick start](./docs/guides/quickstart.md)
- [Custom source](./docs/guides/custom-source.md)
- [Upload persistence](./docs/guides/upload-persistence.md)
- [Deployment](./docs/guides/deployment.md)

## Important defaults

> **`uploadPersistence` defaults to `"localStorage"`.** End-user image uploads are stored as base64 data URLs in `localStorage` with a 5 MB cap, per-device, lost on browser cache clear. This is appropriate for personal/hobby use. **Switch to a custom `UploadAdapter` (S3/DB) before deploying to production.** See [docs/guides/upload-persistence.md](./docs/guides/upload-persistence.md).

Other defaults worth noting:

- `cacheTTL`: 3600s (1 hour) — server-side LRU
- `sourceTimeoutMs`: 10000 (10s) per source
- `parserStrict`: false — tolerant deck-list parsing

## Demo app

The repo ships with a Next.js demo themed as a fictional card proxy store ("ProxyMart"). It exercises the package end-to-end with Scryfall, MPC Fill, and a local-folder custom source.

```bash
pnpm install
pnpm --filter nextjs-demo dev
# → http://localhost:3000
```

Edits to the package hot-reload in the demo via workspace linking + tsup watch.

## Repo layout

```
CardArtPicker/
├── packages/cardartpicker/    # the library
├── examples/nextjs-demo/      # live demo + integration tests
└── docs/                      # this documentation
```

## Attribution

Card data and Scryfall-sourced images are provided by [Scryfall](https://scryfall.com), used per their [API guidelines](https://scryfall.com/docs/api). If you build something with this package and surface card data publicly, please credit Scryfall in your UI. The bundled `scryfall` adapter caches results server-side (default TTL 1 hour for development; raise to ≥24h for production deployments to respect Scryfall's caching policy).

The `mpcFill` adapter queries [MPC Fill](https://mpcfill.com), a third-party community project for trading-card proxy aggregation. It is opt-in by composition — exclude it from your `sources` array if you do not want it.

## Personal-use notice

This tool is intended for personal, non-commercial proxy printing. Trading-card games (Magic: The Gathering, Pokémon, Yu-Gi-Oh, Lorcana, etc.) and individual card illustrations are protected by trademark and copyright held by their respective publishers and artists. Users are solely responsible for ensuring their use of this tool, the upstream sources, and any printed output complies with applicable law and the terms of those rights-holders.

Not affiliated with, endorsed by, or sponsored by Wizards of the Coast LLC, Scryfall LLC, MPC Fill, or any trading-card-game publisher.

## License

MIT — see [LICENSE](./LICENSE). The MIT license disclaims all warranty; nothing in this repository constitutes legal advice.

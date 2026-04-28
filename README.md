# CardArtPicker

Next.js drop-in for browsing and selecting Magic: The Gathering card and token proxy art across multiple sources (Scryfall, MPC Fill, custom).

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

## Disclaimer

Not affiliated with Wizards of the Coast. Magic: The Gathering, card names, and related marks are trademarks of Wizards of the Coast LLC. Verify the terms of any upstream source (Scryfall, MPC Fill) before use.

## License

MIT — see [LICENSE](./LICENSE).

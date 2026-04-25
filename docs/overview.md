# Overview

CardArtPicker is a Next.js package for browsing and selecting Magic: The Gathering card and token proxy art. It aggregates options from multiple sources (Scryfall, MPC Fill, custom developer-defined sources) behind one unified interface and ships a drop-in React UI.

## Five layers

Consumers can use as little or as much of the package as they need. Each layer is a separate entry point so server code never leaks into client bundles.

| Layer | Entry | Purpose |
|---|---|---|
| 1. Sources | `cardartpicker/sources` | `scryfall`, `mpcFill`, `defineSource()` — pure adapters |
| 2. Hook | `cardartpicker/client` | `useCardPicker()` for list, selections, downloads |
| 3. Context | `cardartpicker/client` | `<CardPickerProvider>` shares hook state |
| 4. Server | `cardartpicker/server` | `createHandlers(picker)` mounts API routes |
| 5. UI | `cardartpicker/ui` | `<CardArtPicker>` themable drop-in component |

Core types and `createPicker()` live in the root `cardartpicker` entry, server-safe.

## Distribution

Private monorepo, shared with collaborators via Git URL. No public npm release. The repo holds:

- `packages/cardartpicker/` — the library
- `examples/nextjs-demo/` — live demo, also used for integration tests
- `docs/` — what you are reading

## Drop-in usage

Three files, ten lines total. See [guides/quickstart.md](./guides/quickstart.md) for the full setup.

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

## See also

- [architecture.md](./architecture.md) — request flow, progressive fetch, CORS rationale
- [configuration.md](./configuration.md) — full `PickerConfig` reference
- [guides/quickstart.md](./guides/quickstart.md) — full setup walkthrough

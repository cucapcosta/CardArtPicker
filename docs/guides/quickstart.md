# Quickstart

Drop-in setup for an existing Next.js 15 (App Router) project with React 19.

## 1. Install

The package is private, distributed via Git URL.

```bash
pnpm add cardartpicker@github:cucapcosta/CardArtPicker
```

## 2. Create the picker

```ts
// lib/picker.ts
import { createPicker } from "cardartpicker"
import { scryfall, mpcFill } from "cardartpicker/sources"

export const picker = createPicker({
  sources: [scryfall, mpcFill],
})
```

Defaults: 1-hour cache, 10-second source timeout, `localStorage` upload persistence (5 MB cap). See [configuration.md](../configuration.md) to tune.

## 3. Mount the API route

```ts
// app/api/cardartpicker/[...path]/route.ts
import { createHandlers } from "cardartpicker/server"
import { picker } from "@/lib/picker"

export const { GET, POST } = createHandlers(picker)
```

This handles `/parse`, `/default`, `/options`, `/upload`, `/download` under `/api/cardartpicker/`.

## 4. Configure transpilation

The package ships dual ESM/CJS but Next.js needs to know about the workspace package.

```js
// next.config.mjs
/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["cardartpicker"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
}
export default nextConfig
```

## 5. Render the UI

```tsx
// app/page.tsx
import { CardArtPicker } from "cardartpicker/ui"

const SAMPLE = `
4 Lightning Bolt
1 Sol Ring (C21) 472
1 Arlinn, the Pack's Hope // Arlinn, the Moon's Fury

TOKENS:
3 Treasure
`.trim()

export default function Home() {
  return (
    <main style={{ padding: "2rem" }}>
      <CardArtPicker initialList={SAMPLE} />
    </main>
  )
}
```

That's it. Run `pnpm dev`, navigate to `/`, and you have a working picker with Scryfall + MPC Fill integrated.

## Next steps

- [custom-source.md](./custom-source.md) — add your own catalog
- [upload-persistence.md](./upload-persistence.md) — change the default storage
- [deployment.md](./deployment.md) — production checklist
- [../api/ui.md](../api/ui.md) — theming and sub-components

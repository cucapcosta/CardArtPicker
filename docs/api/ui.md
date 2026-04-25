# UI API

Import from `cardartpicker/ui`. Carries `"use client"` and ships its own CSS Modules + theme stylesheet.

## `<CardArtPicker>`

Drop-in component. Wraps itself in `<CardPickerProvider>` so you do not need the hook layer separately.

```tsx
import { CardArtPicker } from "cardartpicker/ui"

<CardArtPicker
  initialList="4 Lightning Bolt"
  apiBase="/api/cardartpicker"
/>
```

### Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `initialList` | `string` | — | Pasted into the importer textarea on mount |
| `eagerLoad` | `boolean` | `false` | Reserved — fetch all options up-front (vs progressive) |
| `apiBase` | `string` | `/api/cardartpicker` | Forwarded to the provider |
| `className` | `string` | — | Applied to the outer wrapper |
| `slots.header` | `ReactNode` | — | Rendered above the toolbar |
| `slots.sidebar` | `ReactNode` | — | Rendered to the right (grid becomes 1fr 280px) |
| `slots.footer` | `ReactNode` | — | Rendered below |
| `onSelectionChange` | `(s: Record<string, string>) => void` | — | Fires whenever selections change |
| `onDownload` | `(zip: Blob) => void` | — | Reserved for download lifecycle hook |
| `onError` | `(err: Error) => void` | — | Fires for each error pushed onto the hook's `errors` |

Source: `packages/cardartpicker/src/ui/CardArtPicker.tsx`.

### Composing slots

`slots` is the styling escape hatch. Inject your own header/sidebar/footer; the picker grid stays untouched.

```tsx
<CardArtPicker
  initialList={SAMPLE}
  slots={{
    header: <ShopHeader />,
    sidebar: <OrderSummary />,
    footer: <Footer />,
  }}
/>
```

The demo at `examples/nextjs-demo/app/page.tsx` uses this pattern to wrap the picker in a fictional shop UI.

### Sub-components

If you want to compose your own layout instead of the default, use the pieces directly:

```tsx
import {
  CardPickerProvider,
  useCardPicker,
} from "cardartpicker/client"
import {
  CardGrid,
  CardSlot,
  ListImporter,
  OptionsModal,
} from "cardartpicker/ui"
```

## Theming

Override CSS variables. The package ships `theme.css` which sets defaults at `:root` and a `prefers-color-scheme: dark` block.

```css
/* app/globals.css or any layout-scoped stylesheet */
:root {
  --cap-bg: #0b1220;
  --cap-fg: #f9fafb;
  --cap-muted: #94a3b8;
  --cap-border: #1e293b;
  --cap-accent: #facc15;
  --cap-slot-bg: #111827;
  --cap-slot-radius: 10px;
  --cap-slot-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  --cap-font: "Inter", system-ui, sans-serif;
}
```

### Variable list

From `packages/cardartpicker/src/ui/styles/theme.css`:

| Variable | Default (light) | Use |
|---|---|---|
| `--cap-bg` | `#ffffff` | Picker background |
| `--cap-fg` | `#111827` | Primary text |
| `--cap-muted` | `#6b7280` | Secondary text |
| `--cap-border` | `#e5e7eb` | Slot borders, dividers |
| `--cap-accent` | `#2563eb` | Buttons, focused arrows |
| `--cap-slot-bg` | `#f9fafb` | Per-slot background |
| `--cap-slot-radius` | `6px` | Slot corner radius |
| `--cap-slot-shadow` | `0 1px 2px rgba(0,0,0,.05)` | Slot drop shadow |
| `--cap-font` | `system-ui, …` | Picker font stack |

Dark mode is automatic via `prefers-color-scheme`. Override the dark values in your own stylesheet at higher specificity if you want a different palette.

## Override pattern

To replace the picker UI entirely while keeping the data layer:

1. Mount the route handler ([guides/quickstart.md](../guides/quickstart.md)).
2. Wrap your component tree in `<CardPickerProvider>`.
3. Build your UI from `useCardPicker()` directly — see [hooks.md](./hooks.md).

The `<CardArtPicker>` component is itself a thin wrapper around the hook plus the sub-components — any styling you want to do can be done by composing those instead.

## See also

- [hooks.md](./hooks.md)
- [../guides/quickstart.md](../guides/quickstart.md)
- [../configuration.md](../configuration.md)

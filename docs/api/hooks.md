# Hooks API

Import from `cardartpicker/client`. These are React 19 client modules — they carry `"use client"` and can only be imported from client components.

## `<CardPickerProvider>`

Provides the API base URL to the `useCardPicker` hook. The drop-in `<CardArtPicker>` UI wraps itself in this provider automatically — you only need it directly when using the hook standalone.

```tsx
import { CardPickerProvider } from "cardartpicker/client"

<CardPickerProvider apiBase="/api/cardartpicker">
  <YourComponent />
</CardPickerProvider>
```

Props:

| Prop | Type | Default | Notes |
|---|---|---|---|
| `apiBase` | `string` | `/api/cardartpicker` | Where the route handlers are mounted |
| `children` | `ReactNode` | — | — |

`useCardPicker()` throws `"useCardPicker must be used within <CardPickerProvider>"` if used outside the provider.

## `useCardPicker()`

Returns the picker state and actions. All actions talk to the configured `apiBase` via `fetch`.

```ts
const {
  list,           // { mainboard: Slot[], tokens: Slot[] }
  parseList,      // (text: string) => Promise<void>
  getSlot,        // (slotId: string) => Slot | undefined
  cycleOption,    // (slotId: string, dir: "next" | "prev") => Promise<void>
  selectOption,   // (slotId: string, optionId: string) => void
  flipSlot,       // (slotId: string) => void
  uploadCustom,   // (slotId: string, file: File) => Promise<void>
  download,       // () => Promise<void>
  selections,     // Record<slotId, optionId>
  loading,        // boolean — true during parseList
  errors,         // Error[] — accumulated, not cleared
} = useCardPicker()
```

### `list`

```ts
type ListState = { mainboard: Slot[]; tokens: Slot[] }

type Slot = {
  id: string                      // "mainboard-0-0"
  section: "mainboard" | "tokens"
  cardName: string
  quantity: 1                     // each grid slot = one copy
  identifier: CardIdentifier
  options: CardOption[]           // grows from 1 → many on cycle
  selectedOptionId: string | null
  flipped: boolean                // DFC display state
  status: "loading" | "ready" | "partial" | "not-found" | "error"
  sourceErrors: Array<{ source: string; message: string }>
}
```

Each parsed line of quantity `N` expands into `N` slots, each with `quantity: 1` and an independent selection. This makes "show me 4 different Lightning Bolt arts in my burn deck" trivial.

### `parseList(text)`

Calls `POST /parse` then fires `GET /default` per slot in parallel. Slots flip from `loading` to `ready` (or `not-found`) as defaults arrive.

### `cycleOption(slotId, dir)`

On first call for a slot, fires `GET /options` to expand from 1 option to all sources' options. Subsequent calls cycle the in-memory list without network.

### `selectOption(slotId, optionId)`

Sets the chosen option. Pure state update; no network.

### `flipSlot(slotId)`

Toggles `flipped`. Used by the UI to display DFC back face. Selection is unchanged — download still emits both faces.

### `uploadCustom(slotId, file)`

Posts to `POST /upload`. On success, appends the returned `CardOption` to the slot and selects it. The hook does not currently auto-persist via `UploadAdapter` — that wiring lives in the UI layer.

### `download()`

Builds `selections` from current slot selections, posts to `POST /download`, downloads the resulting blob via an anchor click. Filename comes from the server's `Content-Disposition` header (configured in `PickerConfig.downloadFilename`).

### `selections`

Memoized `Record<slotId, optionId>` of every slot that has a selection. Re-derives whenever `list` changes.

### `errors`

Accumulating array. Errors are pushed but never cleared by the hook itself — UI consumers can clear by component remount, or you can read `errors.length` and surface a banner.

## See also

- [server.md](./server.md) — the routes the hook consumes
- [ui.md](./ui.md) — drop-in UI built on this hook
- [../configuration.md](../configuration.md)

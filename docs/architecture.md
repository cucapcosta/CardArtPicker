# Architecture

## Diagram

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

## Request flow

All external network calls happen server-side. The browser only ever talks to the dev's own `/api/cardartpicker/*` mount.

```
browser                Next.js route handler           upstream sources
   │                          │                              │
   │ POST /parse              │                              │
   ├─────────────────────────►│                              │
   │   { text }               │ picker.parseList(text)       │
   │◄─────────────────────────┤                              │
   │   { mainboard, tokens }  │                              │
   │                          │                              │
   │ GET /default?name=…      │                              │
   ├─────────────────────────►│ picker.getDefaultPrint(name) │
   │                          ├─────────────────────────────►│ Scryfall search
   │◄─────────────────────────┤                              │
   │   CardOption | 404       │                              │
   │                          │                              │
   │ GET /options?name=…      │ picker.searchCard(id)        │
   ├─────────────────────────►├─── all sources in parallel ─►│
   │◄─────────────────────────┤   Promise.allSettled         │
   │   SourceResult[]         │                              │
```

## Progressive fetch

The picker avoids fetching every source for every card up-front. The cost would be O(cards × sources) for what is usually a 40-card paste.

1. **Parse + default print (fast path).** On `parseList()`, the hook builds slots and immediately fires `GET /default` per slot. Each slot renders with one option as soon as Scryfall returns. Implementation: `useCardPicker.parseList` in `packages/cardartpicker/src/client/useCardPicker.ts`.
2. **Cycle / open modal (lazy path).** First time the user cycles arrows or opens the options modal on a slot, the hook fires `GET /options` for that slot only and merges the full `SourceResult[]` into the slot. Implementation: `expandOptions()` guarded by an in-component `Set<string>` so each slot expands at most once per render.
3. **Eager flag.** `<CardArtPicker eagerLoad />` is reserved for the eager path; the default flow is progressive.

Server-side, both `/default` and `/options` go through the same `picker.searchCard()` which is cached by `name+type` (default 1 hour TTL). So the second-and-onward request for the same card is ~free.

## CORS rationale

MPC Fill (`mpcfill.com`) does not send `Access-Control-Allow-Origin`. A browser `fetch` directly against `https://mpcfill.com/2/cards/` fails before the response is read. Scryfall does send permissive CORS, but mixing client and server fetch paths splits the cache and complicates partial-failure handling.

The package therefore enforces one rule: **all source calls are server-side.** Clients only ever talk to the consumer's own Next.js API route. Benefits:

- MPC Fill works without a proxy server the consumer has to host
- Future API keys (custom S3 source, paid endpoints) stay off the browser
- One cache, one retry policy, one logger

This is enforced by package layout: `cardartpicker/server` does the network work and is never imported by `cardartpicker/client` or `cardartpicker/ui`.

## Partial failure

`searchCard()` runs sources in parallel and returns `SourceResult[]` (one entry per source, each `{ ok: true, options }` or `{ ok: false, error }`). The UI flattens successful options and renders red-border chips for failed sources without dropping the slot. See `createPicker` in `packages/cardartpicker/src/createPicker.ts`.

## See also

- [configuration.md](./configuration.md) — cache TTL, timeout, logger
- [api/sources.md](./api/sources.md) — `Source` contract
- [api/server.md](./api/server.md) — route shapes

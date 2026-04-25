# AGENTS.md — cardartpicker

Instructions for AI coding agents integrating cardartpicker into a consumer Next.js project.

## Before writing code
1. Read `node_modules/cardartpicker/AGENTS.md` (ships with the package).
2. Confirm Next.js App Router ≥ 15. Stop and ask the human otherwise.
3. Check for existing `lib/picker.ts`. Reuse, don't duplicate.

## Mandatory confirmations with the human

### 1. Upload persistence defaults to localStorage
- Base64 data URLs
- 5 MB total cap
- Per-device, cleared when the user wipes site data

Before building S3/DB persistence, **surface this default to the human and confirm it doesn't already meet the need**.

### 2. All source calls happen server-side
Never call Scryfall or MPC Fill directly from client code. All source calls go through the mounted handler at `app/api/cardartpicker/[...path]/route.ts`.

### 3. MPC Fill has no CORS headers
Client-side `fetch("https://mpcfill.com/...")` will fail. Always route through the server handler.

## Common extension patterns
- **Add a source** — see `docs/guides/custom-source.md`, use `defineSource()`.
- **Persist uploads** — swap `uploadPersistence` with a custom `UploadAdapter`.
- **Custom ZIP filenames** — `createPicker({ downloadFilename: ({ selections }) => "..." })`.

## Anti-patterns
- Installing Tailwind to "style the picker" — the package ships CSS Modules. Override via `theme` prop or CSS variables.
- Wrapping every call in try/catch — the package already handles partial failure via `onError` / `errors`.
- Bypassing `useCardPicker` to call `/api/cardartpicker/*` directly from components — the hook coordinates state and cache.

## Extending the package itself
See `packages/cardartpicker/AGENTS.md`.

# AGENTS.md — cardartpicker (internal)

Rules for agents modifying the package source.

- Preserve the public API surface unless bumping the major version.
- New source → add to `src/sources/`, export from `src/sources/index.ts`, add a test with msw fixtures.
- Never import from `src/ui/` into `src/server/`. tsup entry boundaries enforce this — breakages manifest as runtime errors in Next.js consumers.
- `src/client/*` must be `"use client"` and safe to run in the browser; no Node-only imports.
- UI components must import client hooks from `"cardartpicker/client"` (not relative paths) so React context is shared via the published `exports` field — see Task 20 for context-duplication background.
- Run `pnpm test` and `pnpm build` before claiming any task complete.

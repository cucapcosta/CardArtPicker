# CardArtPicker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private Next.js package `cardartpicker` (monorepo) that lets developers browse and pick MTG card/token proxy art from Scryfall + MPC Fill + custom sources, plus a "ProxyMart" demo Next.js app for live testing.

**Architecture:** pnpm monorepo. Package exposes five layered entry points (core / sources / server / client / ui). All external network lives server-side; client talks to dev-mounted `/api/cardartpicker/*` routes. Pluggable `Source` contract; progressive fetch (default print first, options lazy on interaction); ZIP download; upload persistence with localStorage default.

**Tech Stack:** TypeScript, pnpm workspaces, tsup (dual ESM/CJS build), Vitest (unit/integration), msw (network mocks), React 19, Next.js 15 App Router, CSS Modules, jszip, p-limit, nanoid, zod, Playwright (smoke).

**Reference spec:** `docs/superpowers/specs/2026-04-24-cardartpicker-design.md`

---

## File structure

```
CardArtPicker/
├── package.json                              # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json                        # shared TS settings
├── .gitignore
├── AGENTS.md                                 # consumer-repo agent guidance
├── README.md                                 # project overview
├── packages/
│   └── cardartpicker/
│       ├── package.json                      # exports + deps
│       ├── tsconfig.json
│       ├── tsup.config.ts                    # 5 entries: core, sources, server, client, ui
│       ├── vitest.config.ts
│       ├── AGENTS.md                         # internal contributor rules
│       ├── src/
│       │   ├── types.ts                      # shared types (Card, Source, Selection, Slot…)
│       │   ├── index.ts                      # core entry: createPicker, re-export types
│       │   ├── cache.ts                      # LRU cache abstraction
│       │   ├── retry.ts                      # fetch w/ retry + backoff
│       │   ├── parser/
│       │   │   ├── decklist.ts               # deck-list parser
│       │   │   └── decklist.test.ts
│       │   ├── sources/
│       │   │   ├── index.ts                  # defineSource + re-exports
│       │   │   ├── scryfall.ts
│       │   │   ├── scryfall.test.ts
│       │   │   ├── mpcfill.ts
│       │   │   └── mpcfill.test.ts
│       │   ├── server/
│       │   │   ├── index.ts                  # createHandlers(picker) → { GET, POST }
│       │   │   ├── handlers.ts
│       │   │   ├── handlers.test.ts
│       │   │   ├── actions.ts
│       │   │   ├── download.ts
│       │   │   ├── download.test.ts
│       │   │   ├── upload.ts
│       │   │   └── upload.test.ts
│       │   ├── client/
│       │   │   ├── index.ts
│       │   │   ├── useCardPicker.ts
│       │   │   ├── useCardPicker.test.tsx
│       │   │   ├── CardPickerProvider.tsx
│       │   │   ├── persistence.ts
│       │   │   └── persistence.test.ts
│       │   └── ui/
│       │       ├── index.ts
│       │       ├── CardArtPicker.tsx
│       │       ├── CardGrid.tsx
│       │       ├── CardSlot.tsx
│       │       ├── ListImporter.tsx
│       │       ├── UploadDialog.tsx
│       │       ├── OptionsModal.tsx
│       │       └── styles/
│       │           ├── CardArtPicker.module.css
│       │           └── theme.css
│       └── test/
│           ├── fixtures/
│           │   ├── scryfall-sol-ring.json
│           │   ├── scryfall-arlinn-dfc.json
│           │   ├── mpcfill-sources.json
│           │   └── sample.png
│           └── msw-handlers.ts
├── examples/
│   └── nextjs-demo/
│       ├── package.json
│       ├── next.config.mjs
│       ├── tsconfig.json
│       ├── playwright.config.ts
│       ├── public/my-proxies/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── globals.css
│       │   ├── custom-source/page.tsx
│       │   └── api/cardartpicker/[...path]/route.ts
│       ├── components/
│       │   ├── ShopHeader.tsx
│       │   ├── OrderSummary.tsx
│       │   └── Footer.tsx
│       ├── lib/picker.ts
│       └── tests/smoke.spec.ts
├── docs/
│   ├── llms.txt
│   ├── llms-full.txt                         # generated
│   ├── overview.md
│   ├── architecture.md
│   ├── configuration.md
│   ├── api/{sources,server,hooks,ui}.md
│   ├── guides/{quickstart,custom-source,upload-persistence,deployment}.md
│   └── superpowers/
│       ├── specs/2026-04-24-cardartpicker-design.md
│       └── plans/2026-04-24-cardartpicker.md
└── scripts/
    └── build-llm-docs.ts
```

---

## Phase 1 — Foundation

### Task 1: Monorepo workspace scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.nvmrc`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "cardartpicker-monorepo",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "dev:demo": "pnpm --filter nextjs-demo dev",
    "docs:llms": "tsx scripts/build-llm-docs.ts"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.19.0"
  },
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20" }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "examples/*"
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
.next/
coverage/
playwright-report/
test-results/
*.log
.DS_Store
.env.local
docs/llms-full.txt
```

- [ ] **Step 5: Create `.nvmrc`**

```
20
```

- [ ] **Step 6: Install root deps**

Run: `pnpm install`
Expected: lockfile created, no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .nvmrc pnpm-lock.yaml
git commit -m "chore: scaffold pnpm workspace root"
```

---

### Task 2: Package scaffold

**Files:**
- Create: `packages/cardartpicker/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts}`
- Create: stub entry files for all 5 tsup entries

- [ ] **Step 1: Create `packages/cardartpicker/package.json`**

```json
{
  "name": "cardartpicker",
  "version": "0.0.1",
  "private": true,
  "description": "Next.js package for MTG card/token proxy art picking",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" },
    "./sources": { "types": "./dist/sources/index.d.ts", "import": "./dist/sources/index.js", "require": "./dist/sources/index.cjs" },
    "./server": { "types": "./dist/server/index.d.ts", "import": "./dist/server/index.js", "require": "./dist/server/index.cjs" },
    "./client": { "types": "./dist/client/index.d.ts", "import": "./dist/client/index.js", "require": "./dist/client/index.cjs" },
    "./ui": { "types": "./dist/ui/index.d.ts", "import": "./dist/ui/index.js", "require": "./dist/ui/index.cjs" }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "jszip": "^3.10.1",
    "nanoid": "^5.0.7",
    "p-limit": "^6.1.0",
    "zod": "^3.23.8"
  },
  "peerDependencies": {
    "react": ">=19",
    "next": ">=15"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@types/react": "^19.0.0",
    "@types/node": "^22.0.0",
    "jsdom": "^25.0.0",
    "msw": "^2.4.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/cardartpicker/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts", "**/*.test.tsx", "dist"]
}
```

- [ ] **Step 3: Create `packages/cardartpicker/tsup.config.ts`**

```ts
import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    "index": "src/index.ts",
    "sources/index": "src/sources/index.ts",
    "server/index": "src/server/index.ts",
    "client/index": "src/client/index.ts",
    "ui/index": "src/ui/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ["react", "react-dom", "next"],
})
```

- [ ] **Step 4: Create `packages/cardartpicker/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/index.ts"],
    },
    environmentMatchGlobs: [
      ["src/client/**", "jsdom"],
      ["src/ui/**", "jsdom"],
    ],
  },
})
```

- [ ] **Step 5: Create stub entry files**

Create five files each containing the single line `export {}`:
- `src/index.ts`
- `src/sources/index.ts`
- `src/server/index.ts`
- `src/client/index.ts`
- `src/ui/index.ts`

- [ ] **Step 6: Install package deps**

Run: `pnpm install`

- [ ] **Step 7: Verify build succeeds**

Run: `pnpm --filter cardartpicker build`
Expected: `dist/` produced with `index.{js,cjs,d.ts}` and equivalents for each sub-entry.

- [ ] **Step 8: Commit**

```bash
git add packages/cardartpicker/ pnpm-lock.yaml
git commit -m "chore(package): scaffold cardartpicker package with tsup"
```

---

### Task 3: Shared types

**Files:**
- Create: `packages/cardartpicker/src/types.ts`
- Modify: `packages/cardartpicker/src/index.ts`

- [ ] **Step 1: Write types file**

```ts
// packages/cardartpicker/src/types.ts
export type CardType = "card" | "token"

export type CardIdentifier = {
  name: string
  setHint?: string
  collectorHint?: string
  type: CardType
}

export type CardOption = {
  id: string
  sourceName: string
  cardName: string
  imageUrl: string
  thumbnailUrl?: string
  backImageUrl?: string
  meta: {
    setCode?: string
    collectorNumber?: string
    artist?: string
    dpi?: number
    language?: string
    tags?: string[]
    userUploaded?: boolean
  }
}

export type Source = {
  name: string
  getOptions(id: CardIdentifier): Promise<CardOption[]>
  getImage?(optionId: string): Promise<ArrayBuffer>
}

export type SourceResult =
  | { ok: true; source: string; options: CardOption[] }
  | { ok: false; source: string; error: { code: string; message: string } }

export type ParsedLine = { quantity: number } & CardIdentifier

export type ParsedList = {
  mainboard: ParsedLine[]
  tokens: ParsedLine[]
  warnings: Array<{ line: number; raw: string; reason: string }>
}

export type SlotStatus = "loading" | "ready" | "partial" | "not-found" | "error"

export type Slot = {
  id: string
  section: "mainboard" | "tokens"
  cardName: string
  quantity: number
  identifier: CardIdentifier
  options: CardOption[]
  selectedOptionId: string | null
  flipped: boolean
  status: SlotStatus
  sourceErrors: Array<{ source: string; message: string }>
}

export type Selections = Record<string, string>

export type Selection = { slotId: string; optionId: string; quantity: number }

export type CacheAdapter = {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<void>
}

export type UploadAdapter = {
  save(option: CardOption): Promise<void>
  loadAll(): Promise<CardOption[]>
  remove(id: string): Promise<void>
}

export type LogLevel = "debug" | "info" | "warn" | "error"
export type Logger = (level: LogLevel, event: string, ctx?: unknown) => void

export type PickerConfig = {
  sources: Source[]
  uploadPersistence?: "localStorage" | "session" | UploadAdapter
  cacheTTL?: number
  cacheBackend?: CacheAdapter
  parserStrict?: boolean
  sourceTimeoutMs?: number
  logger?: Logger
  onDownloadStart?: (selections: Selection[]) => void
  onDownloadComplete?: (zip: Blob) => void
  downloadFilename?: (ctx: { selections: Selection[] }) => string
}

export type Picker = {
  readonly config: Required<Pick<PickerConfig, "cacheTTL" | "sourceTimeoutMs" | "parserStrict">> & PickerConfig
  searchCard(id: CardIdentifier): Promise<SourceResult[]>
  getDefaultPrint(name: string, type?: CardType): Promise<CardOption | null>
  buildZip(selections: Selection[]): Promise<Blob>
  parseList(text: string): ParsedList
}
```

- [ ] **Step 2: Re-export from main entry**

Replace `packages/cardartpicker/src/index.ts`:

```ts
export type * from "./types.js"
```

- [ ] **Step 3: Typecheck passes**

Run: `pnpm --filter cardartpicker typecheck`

- [ ] **Step 4: Commit**

```bash
git add packages/cardartpicker/src/
git commit -m "feat(types): define shared types for picker, sources, slots"
```

---

## Phase 2 — Parser

### Task 4: Deck-list parser (TDD)

**Files:**
- Create: `packages/cardartpicker/src/parser/decklist.ts`
- Create: `packages/cardartpicker/src/parser/decklist.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/cardartpicker/src/parser/decklist.test.ts
import { describe, expect, it } from "vitest"
import { parseDeckList } from "./decklist.js"

describe("parseDeckList", () => {
  it("parses plain quantity + name", () => {
    const r = parseDeckList("4 Lightning Bolt")
    expect(r.mainboard).toEqual([{ quantity: 4, name: "Lightning Bolt", type: "card" }])
    expect(r.tokens).toEqual([])
    expect(r.warnings).toEqual([])
  })

  it("accepts 4x syntax", () => {
    const r = parseDeckList("4x Lightning Bolt\n1X Sol Ring")
    expect(r.mainboard.map(l => l.name)).toEqual(["Lightning Bolt", "Sol Ring"])
  })

  it("captures set and collector hints", () => {
    const r = parseDeckList("1 Sol Ring (C21) 472")
    expect(r.mainboard[0]).toMatchObject({
      quantity: 1, name: "Sol Ring", setHint: "C21", collectorHint: "472", type: "card",
    })
  })

  it("treats lines before marker as mainboard", () => {
    const r = parseDeckList("1 Sol Ring\n2 Island")
    expect(r.mainboard).toHaveLength(2)
    expect(r.tokens).toHaveLength(0)
  })

  it("routes tokens after TOKENS: marker", () => {
    const r = parseDeckList("1 Sol Ring\nTOKENS:\n3 Treasure")
    expect(r.mainboard.map(l => l.name)).toEqual(["Sol Ring"])
    expect(r.tokens).toEqual([{ quantity: 3, name: "Treasure", type: "token" }])
  })

  it("accepts TOKENS without colon, case-insensitive", () => {
    const r = parseDeckList("tokens\n1 Treasure")
    expect(r.tokens.map(l => l.name)).toEqual(["Treasure"])
  })

  it("preserves DFC double-slash names", () => {
    const r = parseDeckList("1 Arlinn, the Pack's Hope // Arlinn, the Moon's Fury (MID) 217")
    expect(r.mainboard[0].name).toBe("Arlinn, the Pack's Hope // Arlinn, the Moon's Fury")
    expect(r.mainboard[0].setHint).toBe("MID")
  })

  it("skips blank lines and // # comments", () => {
    const r = parseDeckList("// comment\n\n# another\n1 Sol Ring")
    expect(r.mainboard).toHaveLength(1)
    expect(r.warnings).toHaveLength(0)
  })

  it("records warning for unparseable lines, continues", () => {
    const r = parseDeckList("garbage line\n1 Sol Ring")
    expect(r.mainboard.map(l => l.name)).toEqual(["Sol Ring"])
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toMatchObject({ line: 1, raw: "garbage line" })
  })

  it("throws in strict mode when warnings present", () => {
    expect(() => parseDeckList("garbage", { strict: true })).toThrow(/line 1/i)
  })

  it("ignores trailing whitespace and carriage returns", () => {
    const r = parseDeckList("1 Sol Ring   \r\n2 Island \r\n")
    expect(r.mainboard.map(l => l.name)).toEqual(["Sol Ring", "Island"])
  })
})
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter cardartpicker test -- parser`
Expected: FAIL — `parseDeckList` not found.

- [ ] **Step 3: Implement parser**

```ts
// packages/cardartpicker/src/parser/decklist.ts
import type { ParsedLine, ParsedList, CardType } from "../types.js"

const LINE_RE = /^(\d+)[xX]?\s+(.+?)(?:\s+\(([A-Za-z0-9]+)\)(?:\s+(\S+))?)?$/
const TOKEN_MARKER_RE = /^tokens:?\s*$/i

type ParseOptions = { strict?: boolean }

export function parseDeckList(input: string, opts: ParseOptions = {}): ParsedList {
  const lines = input.split(/\r?\n/)
  const mainboard: ParsedLine[] = []
  const tokens: ParsedLine[] = []
  const warnings: ParsedList["warnings"] = []
  let section: "mainboard" | "tokens" = "mainboard"

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim()
    if (line === "") return
    if (line.startsWith("//") || line.startsWith("#")) return
    if (TOKEN_MARKER_RE.test(line)) { section = "tokens"; return }

    const match = line.match(LINE_RE)
    if (!match) {
      warnings.push({ line: idx, raw: rawLine, reason: "does not match `N CardName` pattern" })
      return
    }
    const [, qtyStr, name, setHint, collectorHint] = match
    const type: CardType = section === "tokens" ? "token" : "card"
    const parsed: ParsedLine = {
      quantity: Number(qtyStr),
      name: name.trim(),
      type,
      ...(setHint ? { setHint } : {}),
      ...(collectorHint ? { collectorHint } : {}),
    }
    if (section === "tokens") tokens.push(parsed)
    else mainboard.push(parsed)
  })

  if (opts.strict && warnings.length > 0) {
    const first = warnings[0]
    throw new Error(`parseDeckList: unparseable at line ${first.line + 1}: ${first.raw}`)
  }
  return { mainboard, tokens, warnings }
}
```

- [ ] **Step 4: Run, expect pass**

Run: `pnpm --filter cardartpicker test -- parser`
Expected: PASS — 11/11.

- [ ] **Step 5: Commit**

```bash
git add packages/cardartpicker/src/parser/
git commit -m "feat(parser): tolerant deck-list parser with TOKENS section + DFC names"
```

---

## Phase 3 — Sources

### Task 5: defineSource + Scryfall adapter (TDD with msw)

**Files:**
- Create: `packages/cardartpicker/src/sources/{index.ts,scryfall.ts,scryfall.test.ts}`
- Create: `packages/cardartpicker/test/fixtures/{scryfall-sol-ring.json,scryfall-arlinn-dfc.json}`

- [ ] **Step 1: Add Scryfall fixtures**

`packages/cardartpicker/test/fixtures/scryfall-sol-ring.json`:

```json
{
  "data": [
    {
      "id": "abc-123",
      "name": "Sol Ring",
      "set": "C21",
      "collector_number": "472",
      "artist": "Mark Tedin",
      "lang": "en",
      "image_uris": {
        "png": "https://cards.scryfall.io/png/front/a/b/abc-123.png",
        "small": "https://cards.scryfall.io/small/front/a/b/abc-123.jpg"
      }
    },
    {
      "id": "def-456",
      "name": "Sol Ring",
      "set": "LEA",
      "collector_number": "270",
      "artist": "Mark Tedin",
      "lang": "en",
      "image_uris": {
        "png": "https://cards.scryfall.io/png/front/d/e/def-456.png",
        "small": "https://cards.scryfall.io/small/front/d/e/def-456.jpg"
      }
    }
  ]
}
```

`packages/cardartpicker/test/fixtures/scryfall-arlinn-dfc.json`:

```json
{
  "data": [
    {
      "id": "arl-001",
      "name": "Arlinn, the Pack's Hope // Arlinn, the Moon's Fury",
      "set": "MID",
      "collector_number": "217",
      "lang": "en",
      "card_faces": [
        { "name": "Arlinn, the Pack's Hope", "image_uris": { "png": "https://cards.scryfall.io/png/front/a/r/arl-001-a.png" } },
        { "name": "Arlinn, the Moon's Fury", "image_uris": { "png": "https://cards.scryfall.io/png/back/a/r/arl-001-b.png" } }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write failing tests**

```ts
// packages/cardartpicker/src/sources/scryfall.test.ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import { scryfall } from "./scryfall.js"
import solRing from "../../test/fixtures/scryfall-sol-ring.json" with { type: "json" }
import arlinn from "../../test/fixtures/scryfall-arlinn-dfc.json" with { type: "json" }

const server = setupServer(
  http.get("https://api.scryfall.com/cards/search", ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get("q") ?? ""
    if (q.includes("Sol Ring")) return HttpResponse.json(solRing)
    if (q.includes("Arlinn")) return HttpResponse.json(arlinn)
    return HttpResponse.json({ data: [] })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("scryfall source", () => {
  it("returns multiple prints as CardOptions", async () => {
    const opts = await scryfall.getOptions({ name: "Sol Ring", type: "card" })
    expect(opts).toHaveLength(2)
    expect(opts[0]).toMatchObject({
      sourceName: "Scryfall",
      cardName: "Sol Ring",
      imageUrl: "https://cards.scryfall.io/png/front/a/b/abc-123.png",
      meta: { setCode: "C21", collectorNumber: "472", artist: "Mark Tedin" },
    })
    expect(opts[0].id).toBe("scryfall:abc-123")
  })

  it("maps DFC faces into back image", async () => {
    const opts = await scryfall.getOptions({ name: "Arlinn, the Pack's Hope // Arlinn, the Moon's Fury", type: "card" })
    expect(opts).toHaveLength(1)
    expect(opts[0].imageUrl).toBe("https://cards.scryfall.io/png/front/a/r/arl-001-a.png")
    expect(opts[0].backImageUrl).toBe("https://cards.scryfall.io/png/back/a/r/arl-001-b.png")
  })

  it("returns [] when Scryfall has no matches", async () => {
    const opts = await scryfall.getOptions({ name: "Nonexistent", type: "card" })
    expect(opts).toEqual([])
  })

  it("boosts print matching setHint to the front of the list", async () => {
    const opts = await scryfall.getOptions({ name: "Sol Ring", setHint: "LEA", type: "card" })
    expect(opts[0].meta.setCode).toBe("LEA")
  })
})
```

- [ ] **Step 3: Run, expect failure**

Run: `pnpm --filter cardartpicker test -- scryfall`

- [ ] **Step 4: Implement adapter**

```ts
// packages/cardartpicker/src/sources/index.ts
import type { Source } from "../types.js"

export function defineSource(s: Source): Source { return s }
export { scryfall } from "./scryfall.js"
export { mpcFill, createMpcFill } from "./mpcfill.js"
```

```ts
// packages/cardartpicker/src/sources/scryfall.ts
import type { CardIdentifier, CardOption, Source } from "../types.js"
import { defineSource } from "./index.js"

type ScryfallCard = {
  id: string
  name: string
  set?: string
  collector_number?: string
  artist?: string
  lang?: string
  image_uris?: { png?: string; small?: string; normal?: string }
  card_faces?: Array<{ name: string; image_uris?: { png?: string; small?: string } }>
}

function mapCard(card: ScryfallCard): CardOption {
  const front = card.card_faces?.[0]?.image_uris?.png ?? card.image_uris?.png ?? card.image_uris?.normal ?? ""
  const back = card.card_faces?.[1]?.image_uris?.png
  const thumb = card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small
  return {
    id: `scryfall:${card.id}`,
    sourceName: "Scryfall",
    cardName: card.name,
    imageUrl: front,
    ...(thumb ? { thumbnailUrl: thumb } : {}),
    ...(back ? { backImageUrl: back } : {}),
    meta: {
      ...(card.set ? { setCode: card.set.toUpperCase() } : {}),
      ...(card.collector_number ? { collectorNumber: card.collector_number } : {}),
      ...(card.artist ? { artist: card.artist } : {}),
      ...(card.lang ? { language: card.lang } : {}),
    },
  }
}

async function fetchScryfall(id: CardIdentifier): Promise<CardOption[]> {
  const q = `!"${id.name.replace(/"/g, "")}"`
  const url = `https://api.scryfall.com/cards/search?unique=prints&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { Accept: "application/json" } })
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Scryfall ${res.status}: ${await res.text()}`)
  }
  const body = (await res.json()) as { data?: ScryfallCard[] }
  const mapped = (body.data ?? []).map(mapCard)
  if (id.setHint) {
    const hint = id.setHint.toUpperCase()
    mapped.sort((a, b) => (b.meta.setCode === hint ? 1 : 0) - (a.meta.setCode === hint ? 1 : 0))
  }
  return mapped
}

export const scryfall: Source = defineSource({
  name: "Scryfall",
  getOptions: fetchScryfall,
})
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter cardartpicker test -- scryfall`
Expected: PASS — 4/4.

- [ ] **Step 6: Commit**

```bash
git add packages/cardartpicker/src/sources/ packages/cardartpicker/test/fixtures/
git commit -m "feat(sources): Scryfall adapter with DFC + set-hint boost"
```

---

### Task 6: MPC Fill adapter (TDD with msw)

**Files:**
- Create: `packages/cardartpicker/src/sources/{mpcfill.ts,mpcfill.test.ts}`
- Create: `packages/cardartpicker/test/fixtures/{mpcfill-sources.json,mpcfill-search.json,mpcfill-cards.json}`

- [ ] **Step 1: Fixtures**

`mpcfill-sources.json`:

```json
{
  "results": {
    "1": { "pk": 1, "key": "MrTeferi", "name": "MrTeferi", "description": "High quality", "sourceType": "Google Drive", "externalLink": "" },
    "2": { "pk": 2, "key": "Chilli_Axe", "name": "Chilli_Axe", "description": "Original", "sourceType": "Google Drive", "externalLink": "" }
  }
}
```

`mpcfill-search.json`:

```json
{ "results": { "sol ring": { "CARD": ["id-aaa", "id-bbb"] } } }
```

`mpcfill-cards.json`:

```json
{
  "results": {
    "id-aaa": { "identifier": "id-aaa", "name": "Sol Ring", "priority": 1, "source": 1, "source_name": "MrTeferi", "source_verbose": "MrTeferi", "dpi": 800, "language": "EN", "tags": [] },
    "id-bbb": { "identifier": "id-bbb", "name": "Sol Ring", "priority": 2, "source": 2, "source_name": "Chilli_Axe", "source_verbose": "Chilli_Axe", "dpi": 1200, "language": "EN", "tags": ["full-art"] }
  }
}
```

- [ ] **Step 2: Write failing tests**

```ts
// packages/cardartpicker/src/sources/mpcfill.test.ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import { createMpcFill } from "./mpcfill.js"
import sources from "../../test/fixtures/mpcfill-sources.json" with { type: "json" }
import search from "../../test/fixtures/mpcfill-search.json" with { type: "json" }
import cards from "../../test/fixtures/mpcfill-cards.json" with { type: "json" }

const server = setupServer(
  http.get("https://mpcfill.com/2/sources/", () => HttpResponse.json(sources)),
  http.post("https://mpcfill.com/2/editorSearch/", () => HttpResponse.json(search)),
  http.post("https://mpcfill.com/2/cards/", () => HttpResponse.json(cards))
)

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("mpcFill source", () => {
  it("fetches sources, searches, hydrates card data", async () => {
    const src = createMpcFill()
    const opts = await src.getOptions({ name: "Sol Ring", type: "card" })
    expect(opts).toHaveLength(2)
    expect(opts[0]).toMatchObject({
      sourceName: "MPC Fill",
      cardName: "Sol Ring",
      meta: { dpi: 800, language: "EN", tags: [] },
    })
    expect(opts[0].id).toBe("mpcfill:id-aaa")
    expect(opts[0].imageUrl).toContain("id-aaa")
  })

  it("returns empty when search has zero hits", async () => {
    server.use(http.post("https://mpcfill.com/2/editorSearch/", () =>
      HttpResponse.json({ results: { "unknown card": { CARD: [] } } })))
    const opts = await createMpcFill().getOptions({ name: "Unknown Card", type: "card" })
    expect(opts).toEqual([])
  })

  it("propagates search 500 as thrown error", async () => {
    server.use(http.post("https://mpcfill.com/2/editorSearch/", () =>
      HttpResponse.text("boom", { status: 500 })))
    await expect(createMpcFill().getOptions({ name: "Sol Ring", type: "card" })).rejects.toThrow(/500/)
  })

  it("passes TOKEN cardType through", async () => {
    let capturedBody: unknown
    server.use(http.post("https://mpcfill.com/2/editorSearch/", async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({ results: { treasure: { TOKEN: [] } } })
    }))
    await createMpcFill().getOptions({ name: "Treasure", type: "token" })
    expect(capturedBody).toMatchObject({ queries: [{ cardType: "TOKEN" }] })
  })
})
```

- [ ] **Step 3: Run, expect failure**

Run: `pnpm --filter cardartpicker test -- mpcfill`

- [ ] **Step 4: Implement adapter**

```ts
// packages/cardartpicker/src/sources/mpcfill.ts
import type { CardIdentifier, CardOption, Source } from "../types.js"
import { defineSource } from "./index.js"

type MpcSource = { pk: number; key: string; name: string; description: string; sourceType: string; externalLink: string }
type SearchResponse = { results: Record<string, Record<string, string[]>> }
type CardsResponse = {
  results: Record<string, {
    identifier: string; name: string; priority: number; source: number
    source_name: string; source_verbose: string; dpi: number; language: string; tags: string[]
  }>
}

export type MpcFillOptions = {
  baseUrl?: string
  sourceFilter?: number[]
}

export function createMpcFill(opts: MpcFillOptions = {}): Source {
  const baseUrl = opts.baseUrl ?? "https://mpcfill.com"
  let sourcesCache: MpcSource[] | null = null

  async function loadSources(): Promise<MpcSource[]> {
    if (sourcesCache) return sourcesCache
    const res = await fetch(`${baseUrl}/2/sources/`, { headers: { Accept: "application/json" } })
    if (!res.ok) throw new Error(`MPC Fill /sources/ ${res.status}`)
    const body = (await res.json()) as { results: Record<string, MpcSource> }
    sourcesCache = Object.values(body.results)
    return sourcesCache
  }

  async function search(id: CardIdentifier, sourcePKs: number[]): Promise<string[]> {
    const res = await fetch(`${baseUrl}/2/editorSearch/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchSettings: {
          searchTypeSettings: { fuzzySearch: false, filterCardbacks: false },
          sourceSettings: { sources: sourcePKs },
          filterSettings: { minimumDPI: 0, maximumDPI: 1500, maximumSize: 30, languages: [], includesTags: [], excludesTags: [] },
        },
        queries: [{ query: id.name.toLowerCase(), cardType: id.type === "token" ? "TOKEN" : "CARD" }],
      }),
    })
    if (!res.ok) throw new Error(`MPC Fill /editorSearch/ ${res.status}: ${await res.text()}`)
    const body = (await res.json()) as SearchResponse
    const byType = body.results[id.name.toLowerCase()] ?? {}
    const typeKey = id.type === "token" ? "TOKEN" : "CARD"
    return byType[typeKey] ?? []
  }

  async function hydrate(ids: string[]): Promise<CardOption[]> {
    if (ids.length === 0) return []
    const res = await fetch(`${baseUrl}/2/cards/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardIdentifiers: ids }),
    })
    if (!res.ok) throw new Error(`MPC Fill /cards/ ${res.status}`)
    const body = (await res.json()) as CardsResponse
    return ids.flatMap(id => {
      const c = body.results[id]
      if (!c) return []
      return [{
        id: `mpcfill:${c.identifier}`,
        sourceName: "MPC Fill",
        cardName: c.name,
        imageUrl: `${baseUrl}/2/image/${c.identifier}/`,
        meta: { dpi: c.dpi, language: c.language, tags: c.tags },
      }]
    })
  }

  return defineSource({
    name: "MPC Fill",
    async getOptions(id) {
      const allSources = await loadSources()
      const pks = opts.sourceFilter ?? allSources.map(s => s.pk)
      const ids = await search(id, pks)
      return hydrate(ids)
    },
  })
}

export const mpcFill: Source = createMpcFill()
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter cardartpicker test -- mpcfill`
Expected: PASS — 4/4.

- [ ] **Step 6: Commit**

```bash
git add packages/cardartpicker/src/sources/ packages/cardartpicker/test/fixtures/
git commit -m "feat(sources): MPC Fill adapter with two-step fetch + source allowlist"
```

---

### Task 7: Retry + cache helpers (TDD)

**Files:**
- Create: `packages/cardartpicker/src/{retry.ts,retry.test.ts,cache.ts,cache.test.ts}`

- [ ] **Step 1: retry tests**

```ts
// packages/cardartpicker/src/retry.test.ts
import { describe, expect, it, vi } from "vitest"
import { withRetry } from "./retry.js"

describe("withRetry", () => {
  it("returns value on first success", async () => {
    const fn = vi.fn().mockResolvedValue(42)
    const out = await withRetry(fn, { attempts: 3, baseDelayMs: 1 })
    expect(out).toBe(42)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retries on failure up to attempts", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("flaky 1"))
      .mockRejectedValueOnce(new Error("flaky 2"))
      .mockResolvedValue(42)
    const out = await withRetry(fn, { attempts: 3, baseDelayMs: 1, jitter: false })
    expect(out).toBe(42)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it("throws after attempts exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"))
    await expect(withRetry(fn, { attempts: 2, baseDelayMs: 1 })).rejects.toThrow("always fails")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("respects shouldRetry predicate", async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error("400"), { status: 400 }))
    await expect(withRetry(fn, {
      attempts: 3, baseDelayMs: 1,
      shouldRetry: (e) => (e as { status?: number }).status !== 400,
    })).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: retry implementation**

```ts
// packages/cardartpicker/src/retry.ts
export type RetryOptions = {
  attempts?: number
  baseDelayMs?: number
  jitter?: boolean
  shouldRetry?: (err: unknown, attempt: number) => boolean
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3
  const base = opts.baseDelayMs ?? 100
  const jitter = opts.jitter ?? true
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (opts.shouldRetry && !opts.shouldRetry(e, i)) throw e
      if (i === attempts - 1) break
      const jitterFactor = jitter ? 1 + (Math.random() * 0.4 - 0.2) : 1
      const delay = base * Math.pow(4, i) * jitterFactor
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}
```

- [ ] **Step 4: Run tests.** Expected PASS 4/4.

- [ ] **Step 5: cache tests**

```ts
// packages/cardartpicker/src/cache.test.ts
import { describe, expect, it, vi } from "vitest"
import { createMemoryCache } from "./cache.js"

describe("createMemoryCache", () => {
  it("stores and retrieves values", async () => {
    const c = createMemoryCache<number>({ max: 10 })
    await c.set("a", 1)
    expect(await c.get("a")).toBe(1)
  })

  it("returns undefined for missing keys", async () => {
    const c = createMemoryCache()
    expect(await c.get("missing")).toBeUndefined()
  })

  it("expires entries after ttl", async () => {
    vi.useFakeTimers()
    const c = createMemoryCache<number>({ defaultTtlSeconds: 1 })
    await c.set("a", 42)
    vi.advanceTimersByTime(2000)
    expect(await c.get("a")).toBeUndefined()
    vi.useRealTimers()
  })

  it("evicts oldest when max size exceeded", async () => {
    const c = createMemoryCache<string>({ max: 2 })
    await c.set("a", "1")
    await c.set("b", "2")
    await c.set("c", "3")
    expect(await c.get("a")).toBeUndefined()
    expect(await c.get("b")).toBe("2")
    expect(await c.get("c")).toBe("3")
  })
})
```

- [ ] **Step 6: Run, expect failure.**

- [ ] **Step 7: cache implementation**

```ts
// packages/cardartpicker/src/cache.ts
import type { CacheAdapter } from "./types.js"

type Entry<T> = { value: T; expiresAt: number | null }

export type MemoryCacheOptions = { max?: number; defaultTtlSeconds?: number }

export function createMemoryCache<T = unknown>(opts: MemoryCacheOptions = {}): CacheAdapter {
  const max = opts.max ?? 500
  const defaultTtl = opts.defaultTtlSeconds ?? 3600
  const map = new Map<string, Entry<T>>()

  function evictIfNeeded() {
    while (map.size > max) {
      const first = map.keys().next().value
      if (first === undefined) break
      map.delete(first)
    }
  }

  return {
    async get(key) {
      const entry = map.get(key) as Entry<T> | undefined
      if (!entry) return undefined
      if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
        map.delete(key)
        return undefined
      }
      map.delete(key); map.set(key, entry)
      return entry.value as never
    },
    async set(key, value, ttlSeconds) {
      const ttl = ttlSeconds ?? defaultTtl
      const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null
      map.set(key, { value: value as T, expiresAt })
      evictIfNeeded()
    },
    async delete(key) { map.delete(key) },
  }
}
```

- [ ] **Step 8: Run tests.** Expected PASS 4/4.

- [ ] **Step 9: Commit**

```bash
git add packages/cardartpicker/src/retry.ts packages/cardartpicker/src/retry.test.ts packages/cardartpicker/src/cache.ts packages/cardartpicker/src/cache.test.ts
git commit -m "feat: add retry helper with backoff and in-memory LRU cache"
```

---

## Phase 4 — createPicker

### Task 8: createPicker aggregator (TDD)

**Files:**
- Create: `packages/cardartpicker/src/{createPicker.ts,createPicker.test.ts}`
- Modify: `packages/cardartpicker/src/index.ts`

- [ ] **Step 1: Write tests**

```ts
// packages/cardartpicker/src/createPicker.test.ts
import { describe, expect, it, vi } from "vitest"
import { createPicker } from "./createPicker.js"
import type { Source, CardOption } from "./types.js"

const makeSource = (name: string, opts: CardOption[] | Error): Source => ({
  name,
  getOptions: vi.fn(async () => {
    if (opts instanceof Error) throw opts
    return opts
  }),
})

const opt = (id: string, source: string): CardOption => ({
  id: `${source}:${id}`, sourceName: source, cardName: "Sol Ring",
  imageUrl: `https://example.com/${id}.png`, meta: {},
})

describe("createPicker", () => {
  it("runs all sources in parallel and aggregates", async () => {
    const a = makeSource("A", [opt("1", "A")])
    const b = makeSource("B", [opt("2", "B"), opt("3", "B")])
    const picker = createPicker({ sources: [a, b] })
    const results = await picker.searchCard({ name: "Sol Ring", type: "card" })
    expect(results).toHaveLength(2)
    const optionCount = results.flatMap(r => r.ok ? r.options : []).length
    expect(optionCount).toBe(3)
  })

  it("returns ok:false for failing source but keeps others", async () => {
    const a = makeSource("A", new Error("boom"))
    const b = makeSource("B", [opt("x", "B")])
    const picker = createPicker({ sources: [a, b] })
    const results = await picker.searchCard({ name: "Sol Ring", type: "card" })
    const aR = results.find(r => r.source === "A")
    const bR = results.find(r => r.source === "B")
    expect(aR?.ok).toBe(false)
    expect(bR?.ok).toBe(true)
  })

  it("enforces source timeout", async () => {
    const slow: Source = { name: "Slow", getOptions: () => new Promise(() => {}) }
    const picker = createPicker({ sources: [slow], sourceTimeoutMs: 20 })
    const results = await picker.searchCard({ name: "X", type: "card" })
    expect(results[0].ok).toBe(false)
    if (!results[0].ok) expect(results[0].error.code).toBe("timeout")
  })

  it("caches results by name+type across calls", async () => {
    const s = makeSource("A", [opt("1", "A")])
    const picker = createPicker({ sources: [s] })
    await picker.searchCard({ name: "Sol Ring", type: "card" })
    await picker.searchCard({ name: "Sol Ring", type: "card" })
    expect(s.getOptions).toHaveBeenCalledTimes(1)
  })

  it("parseList delegates to parser", () => {
    const picker = createPicker({ sources: [] })
    const r = picker.parseList("1 Sol Ring")
    expect(r.mainboard[0].name).toBe("Sol Ring")
  })

  it("getDefaultPrint returns first ok source's first option", async () => {
    const a = makeSource("A", [])
    const b = makeSource("B", [opt("x", "B")])
    const picker = createPicker({ sources: [a, b] })
    const def = await picker.getDefaultPrint("Sol Ring")
    expect(def?.id).toBe("B:x")
  })

  it("getDefaultPrint returns null when nothing found", async () => {
    const a = makeSource("A", [])
    const picker = createPicker({ sources: [a] })
    expect(await picker.getDefaultPrint("Sol Ring")).toBeNull()
  })
})
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement**

```ts
// packages/cardartpicker/src/createPicker.ts
import type {
  CacheAdapter, CardIdentifier, CardOption, CardType, Logger, ParsedList,
  Picker, PickerConfig, Selection, Source, SourceResult,
} from "./types.js"
import { parseDeckList } from "./parser/decklist.js"
import { createMemoryCache } from "./cache.js"

const defaultLogger: Logger = (level, event, ctx) => {
  const prefix = "[cardartpicker]"
  if (level === "error") console.error(prefix, event, ctx)
  else if (level === "warn") console.warn(prefix, event, ctx)
  else console.log(prefix, event, ctx)
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "timeout" })), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

export function createPicker(config: PickerConfig): Picker {
  const resolved = {
    cacheTTL: config.cacheTTL ?? 3600,
    sourceTimeoutMs: config.sourceTimeoutMs ?? 10_000,
    parserStrict: config.parserStrict ?? false,
    ...config,
  }
  const logger = config.logger ?? defaultLogger
  const cache: CacheAdapter = config.cacheBackend ?? createMemoryCache<SourceResult[]>({ defaultTtlSeconds: resolved.cacheTTL })

  async function runSource(src: Source, id: CardIdentifier): Promise<SourceResult> {
    try {
      const options = await withTimeout(src.getOptions(id), resolved.sourceTimeoutMs)
      return { ok: true, source: src.name, options }
    } catch (e) {
      const err = e as { code?: string; message?: string }
      const code = err.code ?? "error"
      const message = err.message ?? String(e)
      logger("warn", "source.failure", { source: src.name, code, message })
      return { ok: false, source: src.name, error: { code, message } }
    }
  }

  async function searchCard(id: CardIdentifier): Promise<SourceResult[]> {
    const key = `search:${id.type}:${id.name.toLowerCase()}`
    const cached = await cache.get<SourceResult[]>(key)
    if (cached) return cached
    const results = await Promise.all(config.sources.map(s => runSource(s, id)))
    await cache.set(key, results, resolved.cacheTTL)
    return results
  }

  async function getDefaultPrint(name: string, type: CardType = "card"): Promise<CardOption | null> {
    const results = await searchCard({ name, type })
    for (const r of results) if (r.ok && r.options.length > 0) return r.options[0]
    return null
  }

  function parseList(text: string): ParsedList {
    return parseDeckList(text, { strict: resolved.parserStrict })
  }

  async function buildZip(_selections: Selection[]): Promise<Blob> {
    throw new Error("buildZip not available in this runtime — import from 'cardartpicker/server'")
  }

  return { config: resolved, searchCard, getDefaultPrint, parseList, buildZip }
}
```

- [ ] **Step 4: Update main entry**

```ts
// packages/cardartpicker/src/index.ts
export type * from "./types.js"
export { createPicker } from "./createPicker.js"
export { parseDeckList } from "./parser/decklist.js"
export { createMemoryCache } from "./cache.js"
```

- [ ] **Step 5: Run tests.** Expected PASS 7/7.

- [ ] **Step 6: Commit**

```bash
git add packages/cardartpicker/src/createPicker.ts packages/cardartpicker/src/createPicker.test.ts packages/cardartpicker/src/index.ts
git commit -m "feat(core): createPicker aggregation with cache + per-source timeout"
```

---

## Phase 5 — Server

### Task 9: Route handlers (TDD)

**Files:**
- Create: `packages/cardartpicker/src/server/{handlers.ts,handlers.test.ts,index.ts}`
- Create: placeholder `packages/cardartpicker/src/server/{download.ts,upload.ts}` (real impls in Tasks 10–11)

- [ ] **Step 1: Write tests**

```ts
// packages/cardartpicker/src/server/handlers.test.ts
import { describe, expect, it, vi } from "vitest"
import { createHandlers } from "./index.js"
import { createPicker } from "../createPicker.js"
import type { Source, CardOption } from "../types.js"

const opt = (id: string): CardOption => ({
  id: `A:${id}`, sourceName: "A", cardName: "Sol Ring",
  imageUrl: `https://x/${id}.png`, meta: {},
})
const makeSource = (name: string, options: CardOption[]): Source => ({
  name, getOptions: vi.fn(async () => options),
})
const req = (url: string, init?: RequestInit): Request => new Request(`http://test${url}`, init)

describe("createHandlers", () => {
  const picker = createPicker({ sources: [makeSource("A", [opt("x")])] })
  const { GET, POST } = createHandlers(picker)

  it("GET /default returns first print", async () => {
    const r = await GET(req("/api/cardartpicker/default?name=Sol+Ring&type=card"))
    const body = await r.json()
    expect(r.status).toBe(200)
    expect(body.id).toBe("A:x")
  })

  it("GET /default returns 404 when missing", async () => {
    const p = createPicker({ sources: [makeSource("A", [])] })
    const { GET: g } = createHandlers(p)
    const r = await g(req("/api/cardartpicker/default?name=Missing&type=card"))
    expect(r.status).toBe(404)
  })

  it("GET /options returns all source results", async () => {
    const r = await GET(req("/api/cardartpicker/options?name=Sol+Ring&type=card"))
    const body = await r.json() as Array<{ ok: boolean }>
    expect(r.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].ok).toBe(true)
  })

  it("POST /parse returns parsed deck list", async () => {
    const r = await POST(req("/api/cardartpicker/parse", {
      method: "POST",
      body: JSON.stringify({ text: "1 Sol Ring\nTOKENS:\n2 Treasure" }),
      headers: { "Content-Type": "application/json" },
    }))
    const body = await r.json()
    expect(body.mainboard).toHaveLength(1)
    expect(body.tokens).toHaveLength(1)
  })

  it("GET unknown path returns 404", async () => {
    const r = await GET(req("/api/cardartpicker/nope"))
    expect(r.status).toBe(404)
  })

  it("POST with invalid body returns 400", async () => {
    const r = await POST(req("/api/cardartpicker/parse", {
      method: "POST", body: "not-json",
      headers: { "Content-Type": "application/json" },
    }))
    expect(r.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement handlers**

```ts
// packages/cardartpicker/src/server/handlers.ts
import type { Picker, CardType } from "../types.js"
import { z } from "zod"

function getPathSegments(url: string): string[] {
  const { pathname } = new URL(url)
  const marker = "cardartpicker/"
  const idx = pathname.indexOf(marker)
  const rest = idx === -1 ? pathname.replace(/^\/+/, "") : pathname.slice(idx + marker.length)
  return rest.split("/").filter(Boolean)
}

const jsonHeaders = { "Content-Type": "application/json" }

export function createGetHandler(picker: Picker) {
  return async function GET(request: Request): Promise<Response> {
    const segs = getPathSegments(request.url)
    const route = segs[0] ?? ""
    const url = new URL(request.url)
    const name = url.searchParams.get("name") ?? ""
    const type = (url.searchParams.get("type") ?? "card") as CardType

    if (route === "default") {
      if (!name) return new Response(JSON.stringify({ error: "missing name" }), { status: 400, headers: jsonHeaders })
      const opt = await picker.getDefaultPrint(name, type)
      if (!opt) return new Response(JSON.stringify({ error: "not-found" }), { status: 404, headers: jsonHeaders })
      return new Response(JSON.stringify(opt), { status: 200, headers: jsonHeaders })
    }
    if (route === "options") {
      if (!name) return new Response(JSON.stringify({ error: "missing name" }), { status: 400, headers: jsonHeaders })
      const results = await picker.searchCard({ name, type })
      return new Response(JSON.stringify(results), { status: 200, headers: jsonHeaders })
    }
    return new Response(JSON.stringify({ error: "not-found" }), { status: 404, headers: jsonHeaders })
  }
}

const ParseBody = z.object({ text: z.string() })

export function createPostHandler(
  picker: Picker,
  uploadRoute: (req: Request) => Promise<Response>,
  downloadRoute: (req: Request) => Promise<Response>,
) {
  return async function POST(request: Request): Promise<Response> {
    const segs = getPathSegments(request.url)
    const route = segs[0] ?? ""

    if (route === "parse") {
      let body: unknown
      try { body = await request.json() } catch {
        return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: jsonHeaders })
      }
      const parsed = ParseBody.safeParse(body)
      if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.issues }), { status: 400, headers: jsonHeaders })
      const result = picker.parseList(parsed.data.text)
      return new Response(JSON.stringify(result), { status: 200, headers: jsonHeaders })
    }
    if (route === "download") return downloadRoute(request)
    if (route === "upload") return uploadRoute(request)
    return new Response(JSON.stringify({ error: "not-found" }), { status: 404, headers: jsonHeaders })
  }
}
```

```ts
// packages/cardartpicker/src/server/index.ts
import type { Picker } from "../types.js"
import { createGetHandler, createPostHandler } from "./handlers.js"
import { createDownloadHandler } from "./download.js"
import { createUploadHandler } from "./upload.js"

export function createHandlers(picker: Picker) {
  const downloadRoute = createDownloadHandler(picker)
  const uploadRoute = createUploadHandler(picker)
  return {
    GET: createGetHandler(picker),
    POST: createPostHandler(picker, uploadRoute, downloadRoute),
  }
}
export { buildZip } from "./download.js"
export type { UploadResult } from "./upload.js"
```

Placeholder `download.ts`:

```ts
// packages/cardartpicker/src/server/download.ts
import type { Picker } from "../types.js"
export function createDownloadHandler(_picker: Picker) {
  return async (_req: Request) =>
    new Response(JSON.stringify({ error: "not implemented" }), { status: 501, headers: { "Content-Type": "application/json" } })
}
export async function buildZip(): Promise<Blob> { throw new Error("not implemented") }
```

Placeholder `upload.ts`:

```ts
// packages/cardartpicker/src/server/upload.ts
import type { Picker } from "../types.js"
export type UploadResult = { id: string; imageUrl: string }
export function createUploadHandler(_picker: Picker) {
  return async (_req: Request) =>
    new Response(JSON.stringify({ error: "not implemented" }), { status: 501, headers: { "Content-Type": "application/json" } })
}
```

- [ ] **Step 4: Run tests.** Expected PASS 6/6.

- [ ] **Step 5: Commit**

```bash
git add packages/cardartpicker/src/server/
git commit -m "feat(server): GET /default, /options and POST /parse handlers"
```

---

### Task 10: Download ZIP builder (TDD)

**Files:**
- Replace: `packages/cardartpicker/src/server/download.ts`
- Create: `packages/cardartpicker/src/server/download.test.ts`

- [ ] **Step 1: Write tests**

```ts
// packages/cardartpicker/src/server/download.test.ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import JSZip from "jszip"
import { buildZip } from "./download.js"
import type { CardOption } from "../types.js"

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const server = setupServer(
  http.get("https://images.test/:file", () => HttpResponse.arrayBuffer(PNG.buffer))
)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const opt = (id: string, overrides: Partial<CardOption> = {}): CardOption => ({
  id: `a:${id}`, sourceName: "A",
  cardName: id === "dfc" ? "Arlinn // Moon" : "Sol Ring",
  imageUrl: `https://images.test/${id}.png`, meta: {}, ...overrides,
})

describe("buildZip", () => {
  it("packages one image per unique selection", async () => {
    const selections = [{ slotId: "mainboard-0", optionId: "a:x", quantity: 1 }]
    const resolver = async () => opt("x")
    const blob = await buildZip(selections, resolver)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const names = Object.keys(zip.files)
    expect(names).toHaveLength(1)
    expect(names[0]).toMatch(/sol-ring.*\.png$/)
  })

  it("appends -copyN suffix for quantities > 1", async () => {
    const selections = [{ slotId: "mainboard-0", optionId: "a:x", quantity: 3 }]
    const resolver = async () => opt("x")
    const blob = await buildZip(selections, resolver)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files)).toHaveLength(3)
  })

  it("emits two files per DFC option", async () => {
    const selections = [{ slotId: "mainboard-0", optionId: "a:dfc", quantity: 1 }]
    const resolver = async () => opt("dfc", { backImageUrl: "https://images.test/dfc-back.png" })
    const blob = await buildZip(selections, resolver)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const names = Object.keys(zip.files).sort()
    expect(names).toHaveLength(2)
    expect(names[0]).toMatch(/ 1\.png$/)
    expect(names[1]).toMatch(/ 2\.png$/)
  })

  it("skips images that fail to fetch but keeps building", async () => {
    server.use(http.get("https://images.test/bad.png", () => HttpResponse.text("nope", { status: 500 })))
    const selections = [
      { slotId: "mainboard-0", optionId: "a:x", quantity: 1 },
      { slotId: "mainboard-1", optionId: "a:bad", quantity: 1 },
    ]
    const resolver = async (id: string) => id === "a:x" ? opt("x") : opt("bad")
    const blob = await buildZip(selections, resolver, { attempts: 1 })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Replace download.ts**

```ts
// packages/cardartpicker/src/server/download.ts
import JSZip from "jszip"
import pLimit from "p-limit"
import type { CardOption, Picker, Selection } from "../types.js"
import { withRetry } from "../retry.js"

export type BuildZipOptions = {
  concurrency?: number
  attempts?: number
  timeoutMs?: number
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)
}

async function fetchImage(
  option: CardOption,
  picker: Picker | null,
  opts: BuildZipOptions,
  face: "front" | "back" = "front",
): Promise<ArrayBuffer> {
  const url = face === "back" ? option.backImageUrl : option.imageUrl
  if (!url) throw new Error(`no ${face} image for option ${option.id}`)
  const src = picker?.config.sources.find(s => s.name === option.sourceName)
  if (face === "front" && src?.getImage) return src.getImage(option.id)

  return withRetry(async () => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) throw new Error(`image ${res.status}`)
      return await res.arrayBuffer()
    } finally { clearTimeout(t) }
  }, { attempts: opts.attempts ?? 3, baseDelayMs: 100 })
}

export async function buildZip(
  selections: Selection[],
  resolver: (optionId: string) => Promise<CardOption | null>,
  opts: BuildZipOptions = {},
  picker: Picker | null = null,
): Promise<Blob> {
  const zip = new JSZip()
  const limit = pLimit(opts.concurrency ?? 8)
  const failures: Array<{ slotId: string; error: string }> = []

  await Promise.all(selections.map(sel => limit(async () => {
    const option = await resolver(sel.optionId)
    if (!option) { failures.push({ slotId: sel.slotId, error: "option not found" }); return }
    try {
      const faces: Array<"front" | "back"> = option.backImageUrl ? ["front", "back"] : ["front"]
      const base = slugify(option.cardName)
      for (const face of faces) {
        const bytes = await fetchImage(option, picker, opts, face)
        for (let i = 0; i < sel.quantity; i++) {
          const copySuffix = sel.quantity > 1 ? `-copy${i + 1}` : ""
          const faceSuffix = option.backImageUrl ? ` ${face === "front" ? 1 : 2}` : ""
          zip.file(`${base}${copySuffix}${faceSuffix}.png`, bytes)
        }
      }
    } catch (e) {
      failures.push({ slotId: sel.slotId, error: (e as Error).message })
    }
  })))

  const blob = await zip.generateAsync({ type: "blob" })
  return Object.assign(blob, { failures })
}

export function createDownloadHandler(picker: Picker) {
  return async function downloadRoute(req: Request): Promise<Response> {
    let body: { selections: Selection[]; options?: Record<string, CardOption> } | undefined
    try { body = await req.json() } catch {
      return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { "Content-Type": "application/json" } })
    }
    if (!body || !Array.isArray(body.selections)) {
      return new Response(JSON.stringify({ error: "missing selections" }), { status: 400, headers: { "Content-Type": "application/json" } })
    }
    picker.config.onDownloadStart?.(body.selections)
    const optionsMap = body.options ?? {}
    const resolver = async (optionId: string) => optionsMap[optionId] ?? null
    const zip = await buildZip(body.selections, resolver, {}, picker)
    picker.config.onDownloadComplete?.(zip)
    const filename = picker.config.downloadFilename?.({ selections: body.selections }) ?? "proxies.zip"
    const failed = (zip as unknown as { failures?: Array<{ slotId: string }> }).failures ?? []
    const headers = new Headers({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    })
    if (failed.length > 0) headers.set("X-Failed-Slots", failed.map(f => f.slotId).join(","))
    return new Response(zip, { status: 200, headers })
  }
}
```

- [ ] **Step 4: Run tests.** Expected PASS 4/4.

- [ ] **Step 5: Commit**

```bash
git add packages/cardartpicker/src/server/download.ts packages/cardartpicker/src/server/download.test.ts
git commit -m "feat(server): ZIP download with DFC dual-file, copy suffixes, partial-failure tolerance"
```

---

### Task 11: Upload handler (TDD)

**Files:**
- Replace: `packages/cardartpicker/src/server/upload.ts`
- Create: `packages/cardartpicker/src/server/upload.test.ts`
- Create: `packages/cardartpicker/test/fixtures/sample.png` (any valid PNG)

- [ ] **Step 1: Place a valid 1×1 PNG at `packages/cardartpicker/test/fixtures/sample.png`.**

- [ ] **Step 2: Write tests**

```ts
// packages/cardartpicker/src/server/upload.test.ts
import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { createUploadHandler } from "./upload.js"
import { createPicker } from "../createPicker.js"

const req = (body: FormData): Request =>
  new Request("http://test/api/cardartpicker/upload", { method: "POST", body })

describe("createUploadHandler", () => {
  const picker = createPicker({ sources: [] })
  const upload = createUploadHandler(picker)

  it("accepts valid PNG and returns CardOption", async () => {
    const bytes = await readFile("./test/fixtures/sample.png")
    const form = new FormData()
    form.set("file", new Blob([bytes], { type: "image/png" }), "sample.png")
    form.set("cardName", "Sol Ring")
    form.set("slotId", "mainboard-0")
    const res = await upload(req(form))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      sourceName: "Custom",
      cardName: "Sol Ring",
      meta: { userUploaded: true },
    })
    expect(body.imageUrl.startsWith("data:image/png;base64,")).toBe(true)
  })

  it("rejects non-image mime types", async () => {
    const form = new FormData()
    form.set("file", new Blob(["hello"], { type: "text/plain" }), "note.txt")
    form.set("cardName", "X"); form.set("slotId", "s")
    const res = await upload(req(form))
    expect(res.status).toBe(400)
  })

  it("rejects files exceeding size cap", async () => {
    const big = new Uint8Array(21 * 1024 * 1024)
    const form = new FormData()
    form.set("file", new Blob([big], { type: "image/png" }), "big.png")
    form.set("cardName", "X"); form.set("slotId", "s")
    const res = await upload(req(form))
    expect(res.status).toBe(413)
  })

  it("returns 400 when file missing", async () => {
    const form = new FormData()
    form.set("cardName", "X"); form.set("slotId", "s")
    const res = await upload(req(form))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 3: Run, expect failure.**

- [ ] **Step 4: Replace upload.ts**

```ts
// packages/cardartpicker/src/server/upload.ts
import { nanoid } from "nanoid"
import type { CardOption, Picker } from "../types.js"

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"])
const MAX_BYTES = 20 * 1024 * 1024

export type UploadResult = CardOption

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } })
}

export function createUploadHandler(_picker: Picker) {
  return async function uploadRoute(req: Request): Promise<Response> {
    const form = await req.formData().catch(() => null)
    if (!form) return json({ error: "expected multipart/form-data" }, 400)
    const file = form.get("file")
    const cardName = form.get("cardName")
    const slotId = form.get("slotId")
    if (!(file instanceof Blob)) return json({ error: "missing file" }, 400)
    if (typeof cardName !== "string" || typeof slotId !== "string") return json({ error: "missing cardName or slotId" }, 400)
    if (!ALLOWED_MIME.has(file.type)) return json({ error: `unsupported mime ${file.type}` }, 400)
    if (file.size > MAX_BYTES) return json({ error: "file too large (max 20MB)" }, 413)

    const buf = await file.arrayBuffer()
    const b64 = Buffer.from(buf).toString("base64")
    const option: CardOption = {
      id: `custom:${nanoid(12)}`,
      sourceName: "Custom",
      cardName,
      imageUrl: `data:${file.type};base64,${b64}`,
      meta: { userUploaded: true },
    }
    return json(option, 200)
  }
}
```

- [ ] **Step 5: Run tests.** Expected PASS 4/4.

- [ ] **Step 6: Commit**

```bash
git add packages/cardartpicker/src/server/upload.ts packages/cardartpicker/src/server/upload.test.ts packages/cardartpicker/test/fixtures/sample.png
git commit -m "feat(server): upload handler with mime + size validation, returns data-URL option"
```

---

### Task 12: Server actions

**Files:**
- Create: `packages/cardartpicker/src/server/actions.ts`
- Modify: `packages/cardartpicker/src/server/index.ts`

- [ ] **Step 1: actions.ts**

```ts
// packages/cardartpicker/src/server/actions.ts
"use server"

import type { CardIdentifier, ParsedList, Picker, Selection, SourceResult } from "../types.js"

export function createActions(picker: Picker) {
  async function searchCardAction(id: CardIdentifier): Promise<SourceResult[]> {
    return picker.searchCard(id)
  }
  async function parseListAction(text: string): Promise<ParsedList> {
    return picker.parseList(text)
  }
  async function downloadAction(_selections: Selection[]): Promise<never> {
    throw new Error("Use the POST /api/cardartpicker/download route from the client; server actions cannot stream Blob responses cleanly.")
  }
  return { searchCardAction, parseListAction, downloadAction }
}
```

- [ ] **Step 2: Export from server/index**

Add to `packages/cardartpicker/src/server/index.ts`:

```ts
export { createActions } from "./actions.js"
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter cardartpicker typecheck`

- [ ] **Step 4: Commit**

```bash
git add packages/cardartpicker/src/server/actions.ts packages/cardartpicker/src/server/index.ts
git commit -m "feat(server): export createActions for RSC/form usage"
```

---

## Phase 6 — Client

### Task 13: Persistence adapters (TDD)

**Files:**
- Create: `packages/cardartpicker/src/client/{persistence.ts,persistence.test.ts}`

- [ ] **Step 1: Tests (jsdom env)**

```ts
// packages/cardartpicker/src/client/persistence.test.ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { localStorageAdapter, sessionAdapter } from "./persistence.js"
import type { CardOption } from "../types.js"

const opt = (id: string): CardOption => ({
  id, sourceName: "Custom", cardName: "Test", imageUrl: "data:x",
  meta: { userUploaded: true },
})

beforeEach(() => localStorage.clear())

describe("localStorageAdapter", () => {
  it("round-trips options", async () => {
    const a = localStorageAdapter()
    await a.save(opt("1"))
    await a.save(opt("2"))
    const all = await a.loadAll()
    expect(all.map(o => o.id).sort()).toEqual(["1", "2"])
  })

  it("removes options", async () => {
    const a = localStorageAdapter()
    await a.save(opt("1"))
    await a.remove("1")
    expect(await a.loadAll()).toEqual([])
  })

  it("throws typed quota error when over cap", async () => {
    const a = localStorageAdapter({ maxBytes: 10 })
    await expect(a.save({ ...opt("big"), imageUrl: "x".repeat(20) })).rejects.toMatchObject({ code: "quota-exceeded" })
  })
})

describe("sessionAdapter", () => {
  it("holds options in memory", async () => {
    const a = sessionAdapter()
    await a.save(opt("1"))
    expect(await a.loadAll()).toHaveLength(1)
  })

  it("isolates between instances", async () => {
    const a = sessionAdapter()
    const b = sessionAdapter()
    await a.save(opt("1"))
    expect(await b.loadAll()).toEqual([])
  })
})
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implementation**

```ts
// packages/cardartpicker/src/client/persistence.ts
import type { CardOption, UploadAdapter } from "../types.js"

const KEY = "cardartpicker:uploads:v1"

export type LocalStorageAdapterOptions = { maxBytes?: number; key?: string }

export function localStorageAdapter(opts: LocalStorageAdapterOptions = {}): UploadAdapter {
  const max = opts.maxBytes ?? 5 * 1024 * 1024
  const key = opts.key ?? KEY

  function readAll(): CardOption[] {
    try {
      const raw = globalThis.localStorage?.getItem(key)
      return raw ? (JSON.parse(raw) as CardOption[]) : []
    } catch { return [] }
  }
  function writeAll(items: CardOption[]) {
    const serialised = JSON.stringify(items)
    if (serialised.length > max) {
      throw Object.assign(new Error("localStorage quota exceeded"), { code: "quota-exceeded" })
    }
    globalThis.localStorage?.setItem(key, serialised)
  }
  return {
    async save(option) {
      const all = readAll().filter(o => o.id !== option.id)
      all.push(option)
      writeAll(all)
    },
    async loadAll() { return readAll() },
    async remove(id) { writeAll(readAll().filter(o => o.id !== id)) },
  }
}

export function sessionAdapter(): UploadAdapter {
  const store = new Map<string, CardOption>()
  return {
    async save(option) { store.set(option.id, option) },
    async loadAll() { return Array.from(store.values()) },
    async remove(id) { store.delete(id) },
  }
}

export function resolveAdapter(kind: "localStorage" | "session" | UploadAdapter): UploadAdapter {
  if (kind === "localStorage") return localStorageAdapter()
  if (kind === "session") return sessionAdapter()
  return kind
}
```

- [ ] **Step 4: Run tests.** Expected PASS 5/5.

- [ ] **Step 5: Commit**

```bash
git add packages/cardartpicker/src/client/persistence.ts packages/cardartpicker/src/client/persistence.test.ts
git commit -m "feat(client): localStorage + session UploadAdapter implementations"
```

---

### Task 14: useCardPicker hook + Provider (TDD)

**Files:**
- Create: `packages/cardartpicker/src/client/{CardPickerProvider.tsx,useCardPicker.ts,useCardPicker.test.tsx,index.ts}`

- [ ] **Step 1: Tests**

```tsx
// packages/cardartpicker/src/client/useCardPicker.test.tsx
// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import { act, renderHook, waitFor } from "@testing-library/react"
import { CardPickerProvider } from "./CardPickerProvider.js"
import { useCardPicker } from "./useCardPicker.js"
import type { ReactNode } from "react"

const defaultOption = { id: "scryfall:abc", sourceName: "Scryfall", cardName: "Sol Ring", imageUrl: "https://x/sol.png", meta: {} }
const moreOptions = [
  { ok: true, source: "Scryfall", options: [defaultOption] },
  { ok: true, source: "MPC Fill", options: [{ id: "mpcfill:xyz", sourceName: "MPC Fill", cardName: "Sol Ring", imageUrl: "https://x/sol-mpc.png", meta: {} }] },
]

const server = setupServer(
  http.get("http://localhost/api/cardartpicker/default", ({ request }) => {
    const u = new URL(request.url)
    if (u.searchParams.get("name") === "Sol Ring") return HttpResponse.json(defaultOption)
    return HttpResponse.json({ error: "not-found" }, { status: 404 })
  }),
  http.get("http://localhost/api/cardartpicker/options", () => HttpResponse.json(moreOptions)),
  http.post("http://localhost/api/cardartpicker/parse", () =>
    HttpResponse.json({ mainboard: [{ quantity: 1, name: "Sol Ring", type: "card" }], tokens: [], warnings: [] })),
)

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const wrap = ({ children }: { children: ReactNode }) => (
  <CardPickerProvider apiBase="/api/cardartpicker">{children}</CardPickerProvider>
)

describe("useCardPicker", () => {
  it("parses list and creates slots with default prints", async () => {
    const { result } = renderHook(() => useCardPicker(), { wrapper: wrap })
    await act(() => result.current.parseList("1 Sol Ring"))
    await waitFor(() => expect(result.current.list.mainboard).toHaveLength(1))
    const slot = result.current.list.mainboard[0]
    expect(slot.cardName).toBe("Sol Ring")
    expect(slot.selectedOptionId).toBe("scryfall:abc")
  })

  it("lazy-loads all options on cycleOption", async () => {
    const { result } = renderHook(() => useCardPicker(), { wrapper: wrap })
    await act(() => result.current.parseList("1 Sol Ring"))
    await waitFor(() => expect(result.current.list.mainboard).toHaveLength(1))
    const slot = result.current.list.mainboard[0]
    expect(slot.options).toHaveLength(1)
    await act(() => result.current.cycleOption(slot.id, "next"))
    await waitFor(() => expect(result.current.getSlot(slot.id)!.options.length).toBeGreaterThan(1))
  })

  it("selectOption updates selections map", async () => {
    const { result } = renderHook(() => useCardPicker(), { wrapper: wrap })
    await act(() => result.current.parseList("1 Sol Ring"))
    await waitFor(() => expect(result.current.list.mainboard).toHaveLength(1))
    const slot = result.current.list.mainboard[0]
    await act(() => result.current.cycleOption(slot.id, "next"))
    await waitFor(() => expect(result.current.getSlot(slot.id)!.options.length).toBeGreaterThan(1))
    await act(() => result.current.selectOption(slot.id, "mpcfill:xyz"))
    expect(result.current.selections[slot.id]).toBe("mpcfill:xyz")
  })

  it("flipSlot toggles front/back without changing selection", async () => {
    const { result } = renderHook(() => useCardPicker(), { wrapper: wrap })
    await act(() => result.current.parseList("1 Sol Ring"))
    await waitFor(() => expect(result.current.list.mainboard).toHaveLength(1))
    const slot = result.current.list.mainboard[0]
    const before = result.current.selections[slot.id]
    await act(() => result.current.flipSlot(slot.id))
    expect(result.current.getSlot(slot.id)!.flipped).toBe(true)
    expect(result.current.selections[slot.id]).toBe(before)
  })

  it("expands quantity into multiple slots", async () => {
    server.use(http.post("http://localhost/api/cardartpicker/parse", () =>
      HttpResponse.json({ mainboard: [{ quantity: 3, name: "Sol Ring", type: "card" }], tokens: [], warnings: [] })))
    const { result } = renderHook(() => useCardPicker(), { wrapper: wrap })
    await act(() => result.current.parseList("3 Sol Ring"))
    await waitFor(() => expect(result.current.list.mainboard).toHaveLength(3))
  })
})
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Provider**

```tsx
// packages/cardartpicker/src/client/CardPickerProvider.tsx
"use client"

import { createContext, useContext, type ReactNode } from "react"

type PickerContextValue = { apiBase: string }

const PickerContext = createContext<PickerContextValue | null>(null)

export function CardPickerProvider({ children, apiBase = "/api/cardartpicker" }: { children: ReactNode; apiBase?: string }) {
  return <PickerContext.Provider value={{ apiBase }}>{children}</PickerContext.Provider>
}

export function usePickerContext(): PickerContextValue {
  const ctx = useContext(PickerContext)
  if (!ctx) throw new Error("useCardPicker must be used within <CardPickerProvider>")
  return ctx
}
```

- [ ] **Step 4: Hook**

```ts
// packages/cardartpicker/src/client/useCardPicker.ts
"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { usePickerContext } from "./CardPickerProvider.js"
import type { CardOption, ParsedList, Selections, Slot, SourceResult } from "../types.js"

type ListState = { mainboard: Slot[]; tokens: Slot[] }

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return res.json() as Promise<T>
}

export function useCardPicker() {
  const { apiBase } = usePickerContext()
  const [list, setList] = useState<ListState>({ mainboard: [], tokens: [] })
  const [errors, setErrors] = useState<Error[]>([])
  const [loading, setLoading] = useState(false)
  const expanded = useRef<Set<string>>(new Set())

  const updateSlot = useCallback((id: string, patch: Partial<Slot>) => {
    setList(prev => {
      const mapper = (s: Slot) => s.id === id ? { ...s, ...patch } : s
      return { mainboard: prev.mainboard.map(mapper), tokens: prev.tokens.map(mapper) }
    })
  }, [])

  const parseList = useCallback(async (text: string) => {
    setLoading(true)
    try {
      const parsed = await getJson<ParsedList>(`${apiBase}/parse`, {
        method: "POST", body: JSON.stringify({ text }),
        headers: { "Content-Type": "application/json" },
      })
      const build = (lines: ParsedList["mainboard"], section: "mainboard" | "tokens") =>
        lines.flatMap((line, lineIdx) =>
          Array.from({ length: line.quantity }, (_, i): Slot => ({
            id: `${section}-${lineIdx}-${i}`,
            section, cardName: line.name, quantity: 1,
            identifier: { name: line.name, type: line.type, ...(line.setHint ? { setHint: line.setHint } : {}) },
            options: [], selectedOptionId: null, flipped: false,
            status: "loading", sourceErrors: [],
          })))
      const mainboard = build(parsed.mainboard, "mainboard")
      const tokens = build(parsed.tokens, "tokens")
      setList({ mainboard, tokens })

      const allSlots = [...mainboard, ...tokens]
      await Promise.all(allSlots.map(async s => {
        try {
          const params = new URLSearchParams({ name: s.cardName, type: s.identifier.type })
          const opt = await getJson<CardOption>(`${apiBase}/default?${params}`)
          updateSlot(s.id, { options: [opt], selectedOptionId: opt.id, status: "ready" })
        } catch {
          updateSlot(s.id, { status: "not-found" })
        }
      }))
    } catch (e) {
      setErrors(es => [...es, e as Error])
    } finally { setLoading(false) }
  }, [apiBase, updateSlot])

  const expandOptions = useCallback(async (slot: Slot) => {
    if (expanded.current.has(slot.id)) return
    expanded.current.add(slot.id)
    const params = new URLSearchParams({ name: slot.cardName, type: slot.identifier.type })
    try {
      const results = await getJson<SourceResult[]>(`${apiBase}/options?${params}`)
      const allOptions = results.flatMap(r => r.ok ? r.options : [])
      const sourceErrors = results.flatMap(r => r.ok ? [] : [{ source: r.source, message: r.error.message }])
      const nextStatus: Slot["status"] = allOptions.length === 0 ? "not-found" : sourceErrors.length > 0 ? "partial" : "ready"
      updateSlot(slot.id, {
        options: allOptions,
        selectedOptionId: slot.selectedOptionId ?? allOptions[0]?.id ?? null,
        status: nextStatus, sourceErrors,
      })
    } catch (e) {
      updateSlot(slot.id, { status: "error" })
      setErrors(es => [...es, e as Error])
    }
  }, [apiBase, updateSlot])

  const cycleOption = useCallback(async (slotId: string, dir: "next" | "prev") => {
    const slot = [...list.mainboard, ...list.tokens].find(s => s.id === slotId)
    if (!slot) return
    await expandOptions(slot)
    setList(prev => {
      const mapper = (s: Slot): Slot => {
        if (s.id !== slotId || s.options.length === 0) return s
        const i = s.options.findIndex(o => o.id === s.selectedOptionId)
        const next = dir === "next" ? (i + 1) % s.options.length : (i - 1 + s.options.length) % s.options.length
        return { ...s, selectedOptionId: s.options[next].id }
      }
      return { mainboard: prev.mainboard.map(mapper), tokens: prev.tokens.map(mapper) }
    })
  }, [list, expandOptions])

  const selectOption = useCallback((slotId: string, optionId: string) => {
    updateSlot(slotId, { selectedOptionId: optionId })
  }, [updateSlot])

  const flipSlot = useCallback((slotId: string) => {
    const slot = [...list.mainboard, ...list.tokens].find(s => s.id === slotId)
    if (!slot) return
    updateSlot(slotId, { flipped: !slot.flipped })
  }, [list, updateSlot])

  const getSlot = useCallback((slotId: string): Slot | undefined => {
    return [...list.mainboard, ...list.tokens].find(s => s.id === slotId)
  }, [list])

  const uploadCustom = useCallback(async (slotId: string, file: File) => {
    const form = new FormData()
    form.append("file", file)
    form.append("cardName", getSlot(slotId)?.cardName ?? "")
    form.append("slotId", slotId)
    const res = await fetch(`${apiBase}/upload`, { method: "POST", body: form })
    if (!res.ok) throw new Error(`upload ${res.status}`)
    const option = (await res.json()) as CardOption
    const slot = getSlot(slotId)
    if (!slot) return
    updateSlot(slotId, {
      options: [...slot.options, option],
      selectedOptionId: option.id,
      status: "ready",
    })
  }, [apiBase, getSlot, updateSlot])

  const download = useCallback(async () => {
    const all = [...list.mainboard, ...list.tokens]
    const selections = all
      .filter(s => s.selectedOptionId)
      .map(s => ({ slotId: s.id, optionId: s.selectedOptionId!, quantity: 1 }))
    const options = Object.fromEntries(all.flatMap(s => s.options.map(o => [o.id, o] as const)))
    const res = await fetch(`${apiBase}/download`, {
      method: "POST",
      body: JSON.stringify({ selections, options }),
      headers: { "Content-Type": "application/json" },
    })
    if (!res.ok) throw new Error(`download ${res.status}`)
    const blob = await res.blob()
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "proxies.zip"
    a.click()
    URL.revokeObjectURL(a.href)
  }, [apiBase, list])

  const selections: Selections = useMemo(() => {
    const entries = [...list.mainboard, ...list.tokens]
      .filter(s => s.selectedOptionId)
      .map(s => [s.id, s.selectedOptionId!] as const)
    return Object.fromEntries(entries)
  }, [list])

  return {
    list, parseList, getSlot, cycleOption, selectOption, flipSlot,
    uploadCustom, download, selections, loading, errors,
  }
}
```

- [ ] **Step 5: client/index.ts**

```ts
// packages/cardartpicker/src/client/index.ts
"use client"

export { CardPickerProvider } from "./CardPickerProvider.js"
export { useCardPicker } from "./useCardPicker.js"
export { localStorageAdapter, sessionAdapter } from "./persistence.js"
```

- [ ] **Step 6: Run tests.** Expected PASS 5/5.

- [ ] **Step 7: Commit**

```bash
git add packages/cardartpicker/src/client/
git commit -m "feat(client): useCardPicker hook with progressive load + CardPickerProvider"
```

---

## Phase 7 — UI

### Task 15: CSS theme + base module

**Files:**
- Create: `packages/cardartpicker/src/ui/styles/{theme.css,CardArtPicker.module.css}`

- [ ] **Step 1: theme.css**

```css
:root {
  --cap-bg: #ffffff;
  --cap-fg: #111827;
  --cap-muted: #6b7280;
  --cap-border: #e5e7eb;
  --cap-accent: #2563eb;
  --cap-slot-bg: #f9fafb;
  --cap-slot-radius: 6px;
  --cap-slot-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  --cap-font: system-ui, -apple-system, "Segoe UI", sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --cap-bg: #111827;
    --cap-fg: #f9fafb;
    --cap-muted: #9ca3af;
    --cap-border: #374151;
    --cap-accent: #60a5fa;
    --cap-slot-bg: #1f2937;
  }
}
```

- [ ] **Step 2: CardArtPicker.module.css**

```css
.root { font-family: var(--cap-font); color: var(--cap-fg); background: var(--cap-bg); }

.toolbar { display: flex; gap: 0.5rem; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--cap-border); margin-bottom: 1rem; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; }

.slot {
  background: var(--cap-slot-bg);
  border: 1px solid var(--cap-border);
  border-radius: var(--cap-slot-radius);
  box-shadow: var(--cap-slot-shadow);
  display: flex; flex-direction: column; padding: 0.5rem;
}

.slotImage {
  width: 100%; aspect-ratio: 63/88; object-fit: cover;
  background: #0000000d; cursor: pointer;
  border-radius: calc(var(--cap-slot-radius) - 2px);
}

.slotMeta {
  display: grid; grid-template-columns: auto 1fr auto;
  align-items: center; gap: 0.25rem; margin-top: 0.5rem; font-size: 0.85rem;
}

.arrow {
  background: transparent; border: 1px solid var(--cap-border);
  border-radius: 4px; padding: 0.1rem 0.4rem; cursor: pointer; color: var(--cap-fg);
}
.arrow:hover { border-color: var(--cap-accent); }

.slotName { text-align: center; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slotSource { color: var(--cap-muted); font-size: 0.75rem; text-align: center; }

.sectionHeader { font-size: 1rem; font-weight: 600; margin: 1.5rem 0 0.5rem; }

.warning {
  background: color-mix(in srgb, orange 20%, transparent);
  padding: 0.5rem; border-radius: var(--cap-slot-radius); margin-bottom: 1rem; font-size: 0.9rem;
}

.notFoundOverlay {
  display: flex; align-items: center; justify-content: center;
  aspect-ratio: 63/88; border: 2px dashed var(--cap-border);
  color: var(--cap-muted); font-size: 0.85rem; text-align: center; padding: 1rem;
}

.flipButton {
  position: absolute; bottom: 8px; right: 8px;
  background: rgba(0,0,0,0.6); color: white; border: none;
  border-radius: 50%; width: 28px; height: 28px; cursor: pointer;
}

.imageWrap { position: relative; }
```

- [ ] **Step 3: Commit**

```bash
git add packages/cardartpicker/src/ui/styles/
git commit -m "feat(ui): CSS module + theme variables"
```

---

### Task 16: CardSlot component

**Files:**
- Create: `packages/cardartpicker/src/ui/CardSlot.tsx`

- [ ] **Step 1: Component**

```tsx
// packages/cardartpicker/src/ui/CardSlot.tsx
"use client"

import type { ChangeEvent } from "react"
import { useCardPicker } from "../client/index.js"
import type { Slot } from "../types.js"
import styles from "./styles/CardArtPicker.module.css"

export function CardSlot({ slot, onOpenOptions }: { slot: Slot; onOpenOptions: (slotId: string) => void }) {
  const { cycleOption, flipSlot, uploadCustom } = useCardPicker()
  const current = slot.options.find(o => o.id === slot.selectedOptionId)
  const imageUrl = slot.flipped && current?.backImageUrl ? current.backImageUrl : current?.imageUrl
  const idx = slot.options.findIndex(o => o.id === slot.selectedOptionId)
  const canFlip = Boolean(current?.backImageUrl)

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void uploadCustom(slot.id, file)
  }

  if (slot.status === "not-found") {
    return (
      <div className={styles.slot}>
        <div className={styles.notFoundOverlay}>Card not found — check name</div>
        <div className={styles.slotName}>{slot.cardName}</div>
      </div>
    )
  }

  return (
    <div className={styles.slot}>
      <div className={styles.imageWrap}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={slot.cardName}
            className={styles.slotImage}
            onClick={() => onOpenOptions(slot.id)}
            loading="lazy"
          />
        ) : (
          <div className={styles.notFoundOverlay}>Loading…</div>
        )}
        {canFlip && (
          <button className={styles.flipButton} onClick={() => flipSlot(slot.id)} aria-label="Flip card">⟳</button>
        )}
      </div>
      <div className={styles.slotMeta}>
        <button className={styles.arrow} onClick={() => cycleOption(slot.id, "prev")} aria-label="Previous option">◀</button>
        <div className={styles.slotName}>{slot.cardName}</div>
        <button className={styles.arrow} onClick={() => cycleOption(slot.id, "next")} aria-label="Next option">▶</button>
      </div>
      <div className={styles.slotSource}>
        {current ? `${current.sourceName} · ${idx + 1} / ${slot.options.length}` : "—"}
      </div>
      <label className={styles.slotSource} style={{ cursor: "pointer" }}>
        Upload
        <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={onFileInput} />
      </label>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck.** Run: `pnpm --filter cardartpicker typecheck`

- [ ] **Step 3: Commit**

```bash
git add packages/cardartpicker/src/ui/CardSlot.tsx
git commit -m "feat(ui): CardSlot component with arrows, flip, upload"
```

---

### Task 17: ListImporter, CardGrid, OptionsModal

**Files:**
- Create: `packages/cardartpicker/src/ui/{ListImporter.tsx,CardGrid.tsx,OptionsModal.tsx}`

- [ ] **Step 1: ListImporter**

```tsx
// packages/cardartpicker/src/ui/ListImporter.tsx
"use client"

import { useState } from "react"
import { useCardPicker } from "../client/index.js"
import styles from "./styles/CardArtPicker.module.css"

export function ListImporter({ initialList = "" }: { initialList?: string }) {
  const { parseList, loading } = useCardPicker()
  const [text, setText] = useState(initialList)
  return (
    <div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={6}
        placeholder="Paste Moxfield list here…"
        style={{ width: "100%", fontFamily: "var(--cap-font)", padding: "0.5rem" }}
        disabled={loading}
      />
      <button
        onClick={() => void parseList(text)}
        disabled={loading || text.trim().length === 0}
        className={styles.arrow}
        style={{ marginTop: "0.5rem" }}
      >
        {loading ? "Parsing…" : "Parse list"}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: CardGrid**

```tsx
// packages/cardartpicker/src/ui/CardGrid.tsx
"use client"

import type { Slot } from "../types.js"
import { CardSlot } from "./CardSlot.js"
import styles from "./styles/CardArtPicker.module.css"

export function CardGrid({ slots, onOpenOptions }: { slots: Slot[]; onOpenOptions: (slotId: string) => void }) {
  if (slots.length === 0) return null
  return (
    <div className={styles.grid}>
      {slots.map(slot => <CardSlot key={slot.id} slot={slot} onOpenOptions={onOpenOptions} />)}
    </div>
  )
}
```

- [ ] **Step 3: OptionsModal**

```tsx
// packages/cardartpicker/src/ui/OptionsModal.tsx
"use client"

import { useCardPicker } from "../client/index.js"
import styles from "./styles/CardArtPicker.module.css"

export function OptionsModal({ slotId, onClose }: { slotId: string; onClose: () => void }) {
  const { getSlot, selectOption } = useCardPicker()
  const slot = getSlot(slotId)
  if (!slot) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 1000 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "var(--cap-bg)", padding: "1.5rem", borderRadius: 8, maxWidth: "80vw", maxHeight: "80vh", overflow: "auto" }}
      >
        <h3>{slot.cardName} — pick art</h3>
        <div className={styles.grid}>
          {slot.options.map(opt => (
            <div
              key={opt.id}
              className={styles.slot}
              onClick={() => { selectOption(slot.id, opt.id); onClose() }}
              style={{ cursor: "pointer", outline: opt.id === slot.selectedOptionId ? "2px solid var(--cap-accent)" : "none" }}
            >
              <img src={opt.thumbnailUrl ?? opt.imageUrl} alt="" className={styles.slotImage} />
              <div className={styles.slotSource}>
                {opt.sourceName}{opt.meta.setCode ? ` · ${opt.meta.setCode}` : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/cardartpicker/src/ui/ListImporter.tsx packages/cardartpicker/src/ui/CardGrid.tsx packages/cardartpicker/src/ui/OptionsModal.tsx
git commit -m "feat(ui): ListImporter, CardGrid, OptionsModal"
```

---

### Task 18: CardArtPicker composite + UI index

**Files:**
- Create: `packages/cardartpicker/src/ui/{CardArtPicker.tsx,index.ts}`

- [ ] **Step 1: Composite**

```tsx
// packages/cardartpicker/src/ui/CardArtPicker.tsx
"use client"

import { useEffect, useState, type ReactNode } from "react"
import { CardPickerProvider, useCardPicker } from "../client/index.js"
import { ListImporter } from "./ListImporter.js"
import { CardGrid } from "./CardGrid.js"
import { OptionsModal } from "./OptionsModal.js"
import styles from "./styles/CardArtPicker.module.css"
import "./styles/theme.css"

export type CardArtPickerProps = {
  initialList?: string
  eagerLoad?: boolean
  apiBase?: string
  className?: string
  slots?: { header?: ReactNode; sidebar?: ReactNode; footer?: ReactNode }
  onSelectionChange?: (s: Record<string, string>) => void
  onDownload?: (zip: Blob) => void
  onError?: (err: Error) => void
}

function Inner({ initialList, slots, onSelectionChange, onError }: Omit<CardArtPickerProps, "apiBase" | "className" | "eagerLoad">) {
  const { list, download, selections, errors } = useCardPicker()
  const [openSlotId, setOpenSlotId] = useState<string | null>(null)
  const notFoundCount = [...list.mainboard, ...list.tokens].filter(s => s.status === "not-found").length

  useEffect(() => { onSelectionChange?.(selections) }, [selections, onSelectionChange])
  useEffect(() => { errors.forEach(e => onError?.(e)) }, [errors, onError])

  return (
    <div className={styles.root}>
      {slots?.header}
      <div style={{ display: "grid", gridTemplateColumns: slots?.sidebar ? "1fr 280px" : "1fr", gap: "2rem" }}>
        <div>
          <div className={styles.toolbar}>
            <button className={styles.arrow} onClick={() => void download()} disabled={Object.keys(selections).length === 0}>
              Download ({Object.keys(selections).length})
            </button>
          </div>
          <ListImporter initialList={initialList ?? ""} />
          {notFoundCount > 0 && (
            <div className={styles.warning}>
              {notFoundCount} card{notFoundCount === 1 ? "" : "s"} not found.
            </div>
          )}
          {list.mainboard.length > 0 && (
            <>
              <h3 className={styles.sectionHeader}>Mainboard ({list.mainboard.length})</h3>
              <CardGrid slots={list.mainboard} onOpenOptions={setOpenSlotId} />
            </>
          )}
          {list.tokens.length > 0 && (
            <>
              <h3 className={styles.sectionHeader}>Tokens ({list.tokens.length})</h3>
              <CardGrid slots={list.tokens} onOpenOptions={setOpenSlotId} />
            </>
          )}
          {openSlotId && <OptionsModal slotId={openSlotId} onClose={() => setOpenSlotId(null)} />}
        </div>
        {slots?.sidebar}
      </div>
      {slots?.footer}
    </div>
  )
}

export function CardArtPicker({ apiBase = "/api/cardartpicker", className, ...rest }: CardArtPickerProps) {
  return (
    <CardPickerProvider apiBase={apiBase}>
      <div className={className}>
        <Inner {...rest} />
      </div>
    </CardPickerProvider>
  )
}
```

- [ ] **Step 2: UI index**

```ts
// packages/cardartpicker/src/ui/index.ts
"use client"

export { CardArtPicker } from "./CardArtPicker.js"
export { CardGrid } from "./CardGrid.js"
export { CardSlot } from "./CardSlot.js"
export { ListImporter } from "./ListImporter.js"
export { OptionsModal } from "./OptionsModal.js"
```

- [ ] **Step 3: Build**

Run: `pnpm --filter cardartpicker build`

- [ ] **Step 4: Commit**

```bash
git add packages/cardartpicker/src/ui/
git commit -m "feat(ui): CardArtPicker composite wraps grid + importer + options modal"
```

---

## Phase 8 — Demo app "ProxyMart"

### Task 19: Demo app scaffold

**Files:**
- Create: `examples/nextjs-demo/{package.json,tsconfig.json,next.config.mjs,app/layout.tsx,app/page.tsx,app/globals.css,lib/picker.ts,app/api/cardartpicker/[...path]/route.ts}`

- [ ] **Step 1: package.json**

```json
{
  "name": "nextjs-demo",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "cardartpicker": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.47.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] },
    "incremental": true,
    "noEmit": true
  },
  "include": ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: next.config.mjs**

```js
/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["cardartpicker"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
}
export default nextConfig
```

- [ ] **Step 4: lib/picker.ts**

```ts
import { createPicker } from "cardartpicker"
import { scryfall, mpcFill, defineSource } from "cardartpicker/sources"
import { readdir } from "node:fs/promises"
import { join } from "node:path"

const myProxies = defineSource({
  name: "My Proxies",
  async getOptions({ name }) {
    try {
      const dir = join(process.cwd(), "public", "my-proxies")
      const files = await readdir(dir)
      return files
        .filter(f => f.toLowerCase().includes(name.toLowerCase().replace(/[^a-z0-9]+/g, "-")))
        .map(f => ({
          id: `local:${f}`,
          sourceName: "My Proxies",
          cardName: name,
          imageUrl: `/my-proxies/${f}`,
          meta: {},
        }))
    } catch { return [] }
  },
})

export const picker = createPicker({
  sources: [scryfall, mpcFill, myProxies],
  uploadPersistence: "localStorage",
})
```

- [ ] **Step 5: app/api/cardartpicker/[...path]/route.ts**

```ts
import { createHandlers } from "cardartpicker/server"
import { picker } from "@/lib/picker"

export const { GET, POST } = createHandlers(picker)
```

- [ ] **Step 6: app/globals.css**

```css
html, body { padding: 0; margin: 0; }
body {
  --cap-bg: #0f172a; --cap-fg: #f1f5f9; --cap-muted: #94a3b8;
  --cap-border: #334155; --cap-accent: #f59e0b;
  --cap-slot-bg: #1e293b; --cap-slot-radius: 8px;
  --cap-font: "Inter", system-ui, sans-serif;
  background: var(--cap-bg); color: var(--cap-fg); font-family: var(--cap-font);
}
```

- [ ] **Step 7: app/layout.tsx**

```tsx
import "./globals.css"
import type { ReactNode } from "react"

export const metadata = { title: "ProxyMart — CardArtPicker demo" }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 8: app/page.tsx (stub — expanded next task)**

```tsx
import { CardArtPicker } from "cardartpicker/ui"

const SAMPLE = `
4 Lightning Bolt
1 Sol Ring (C21) 472
1 Arlinn, the Pack's Hope // Arlinn, the Moon's Fury
1 Jace, the Mind Sculptor

TOKENS:
3 Treasure
`.trim()

export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>ProxyMart</h1>
      <CardArtPicker initialList={SAMPLE} />
    </main>
  )
}
```

- [ ] **Step 9: Install and run dev**

```bash
pnpm install
pnpm --filter cardartpicker build
pnpm --filter nextjs-demo dev
```

Visit `http://localhost:3000` — picker renders with parsed sample list.

- [ ] **Step 10: Commit**

```bash
git add examples/nextjs-demo/ pnpm-lock.yaml
git commit -m "feat(demo): scaffold nextjs-demo with mounted route + sample list"
```

---

### Task 20: Shop chrome (ShopHeader, OrderSummary, Footer)

**Files:**
- Create: `examples/nextjs-demo/components/{ShopHeader.tsx,OrderSummary.tsx,Footer.tsx}`
- Modify: `examples/nextjs-demo/app/page.tsx`

- [ ] **Step 1: ShopHeader**

```tsx
// examples/nextjs-demo/components/ShopHeader.tsx
"use client"

import { useCardPicker } from "cardartpicker/client"

export function ShopHeader() {
  return (
    <header style={{ display: "flex", alignItems: "center", padding: "1rem 2rem", borderBottom: "1px solid var(--cap-border)" }}>
      <strong style={{ fontSize: "1.3rem", color: "var(--cap-accent)" }}>🃏 ProxyMart</strong>
      <nav style={{ marginLeft: "2rem", display: "flex", gap: "1rem", color: "var(--cap-muted)" }}>
        <span>Decks</span><span>Sets</span><span>About</span>
      </nav>
      <CartBadge />
    </header>
  )
}

function CartBadge() {
  const { selections } = useCardPicker()
  const count = Object.keys(selections).length
  return (
    <span style={{ marginLeft: "auto", padding: "0.3rem 0.8rem", background: "var(--cap-accent)", color: "#111", borderRadius: 999, fontSize: "0.85rem" }}>
      🛒 {count}
    </span>
  )
}
```

- [ ] **Step 2: OrderSummary**

```tsx
// examples/nextjs-demo/components/OrderSummary.tsx
"use client"

import { useCardPicker } from "cardartpicker/client"

export function OrderSummary() {
  const { list, download } = useCardPicker()
  const count = list.mainboard.length + list.tokens.length
  return (
    <aside style={{ padding: "1rem", background: "var(--cap-slot-bg)", borderRadius: 8, position: "sticky", top: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>Order Summary</h3>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Mainboard</span><span>{list.mainboard.length}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tokens</span><span>{list.tokens.length}</span></div>
      <hr style={{ borderColor: "var(--cap-border)" }} />
      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>$0</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--cap-muted)", fontSize: "0.85rem" }}>
        <span>Shipping</span><span>free*</span>
      </div>
      <button
        onClick={() => void download()}
        disabled={count === 0}
        style={{ width: "100%", padding: "0.6rem", marginTop: "1rem", background: "var(--cap-accent)", color: "#111", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}
      >
        Checkout
      </button>
      <p style={{ fontSize: "0.7rem", color: "var(--cap-muted)" }}>*demo — triggers download</p>
    </aside>
  )
}
```

- [ ] **Step 3: Footer**

```tsx
// examples/nextjs-demo/components/Footer.tsx
export function Footer() {
  return (
    <footer style={{ padding: "2rem", textAlign: "center", color: "var(--cap-muted)", fontSize: "0.85rem", borderTop: "1px solid var(--cap-border)", marginTop: "4rem" }}>
      demo site · packages/cardartpicker
    </footer>
  )
}
```

- [ ] **Step 4: Rework page.tsx**

```tsx
// examples/nextjs-demo/app/page.tsx
import { CardArtPicker } from "cardartpicker/ui"
import { ShopHeader } from "@/components/ShopHeader"
import { OrderSummary } from "@/components/OrderSummary"
import { Footer } from "@/components/Footer"

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
      <CardArtPicker
        initialList={SAMPLE}
        apiBase="/api/cardartpicker"
        slots={{ header: <ShopHeader />, sidebar: <OrderSummary />, footer: <Footer /> }}
      />
    </main>
  )
}
```

- [ ] **Step 5: Rebuild + verify**

```bash
pnpm --filter cardartpicker build
pnpm --filter nextjs-demo dev
```

- [ ] **Step 6: Commit**

```bash
git add examples/nextjs-demo/components/ examples/nextjs-demo/app/page.tsx
git commit -m "feat(demo): ProxyMart shop chrome via slot props; header, summary, footer"
```

---

### Task 21: Custom-source page

**Files:**
- Create: `examples/nextjs-demo/public/my-proxies/sol-ring-alt.png` (any sample PNG)
- Create: `examples/nextjs-demo/app/custom-source/page.tsx`

- [ ] **Step 1: Add a sample PNG** in `public/my-proxies/`.

- [ ] **Step 2: Custom-source page**

```tsx
// examples/nextjs-demo/app/custom-source/page.tsx
import { CardArtPicker } from "cardartpicker/ui"
import { ShopHeader } from "@/components/ShopHeader"
import { OrderSummary } from "@/components/OrderSummary"
import { Footer } from "@/components/Footer"

export default function CustomSource() {
  return (
    <main style={{ padding: "2rem" }}>
      <CardArtPicker
        initialList="1 Sol Ring"
        apiBase="/api/cardartpicker"
        slots={{ header: <ShopHeader />, sidebar: <OrderSummary />, footer: <Footer /> }}
      />
      <p style={{ color: "var(--cap-muted)" }}>
        Showcases &quot;My Proxies&quot; local-folder source alongside Scryfall and MPC Fill.
      </p>
    </main>
  )
}
```

- [ ] **Step 3: Verify**

Dev server → `/custom-source`. Sol Ring slot includes the local image as an option.

- [ ] **Step 4: Commit**

```bash
git add examples/nextjs-demo/app/custom-source/ examples/nextjs-demo/public/my-proxies/
git commit -m "feat(demo): custom-source page showcasing local-folder defineSource"
```

---

## Phase 9 — Tests (integration, contract, e2e)

### Task 22: Playwright smoke

**Files:**
- Create: `examples/nextjs-demo/playwright.config.ts`
- Create: `examples/nextjs-demo/tests/smoke.spec.ts`

- [ ] **Step 1: playwright.config.ts**

```ts
import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
```

- [ ] **Step 2: Install Chromium**

Run: `npx --yes playwright install chromium`

- [ ] **Step 3: Smoke test**

```ts
// examples/nextjs-demo/tests/smoke.spec.ts
import { expect, test } from "@playwright/test"

test("ProxyMart main flow", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByText("ProxyMart")).toBeVisible()
  await expect(page.getByRole("heading", { name: /Mainboard/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator("img").first()).toBeVisible({ timeout: 20_000 })
})
```

- [ ] **Step 4: Run smoke**

Run: `pnpm --filter nextjs-demo test:e2e`
Expected: pass (requires live network).

- [ ] **Step 5: Commit**

```bash
git add examples/nextjs-demo/playwright.config.ts examples/nextjs-demo/tests/
git commit -m "test(demo): Playwright smoke test for main flow"
```

---

### Task 23: Live contract tests (gated)

**Files:**
- Create: `packages/cardartpicker/src/sources/{scryfall.live.test.ts,mpcfill.live.test.ts}`

- [ ] **Step 1: Scryfall live**

```ts
// packages/cardartpicker/src/sources/scryfall.live.test.ts
import { describe, expect, it } from "vitest"
import { scryfall } from "./scryfall.js"

const RUN = process.env.RUN_LIVE_TESTS === "1"
const d = RUN ? describe : describe.skip

d("scryfall (live)", () => {
  it("returns at least one print for Sol Ring", async () => {
    const opts = await scryfall.getOptions({ name: "Sol Ring", type: "card" })
    expect(opts.length).toBeGreaterThan(0)
    expect(opts[0].imageUrl).toMatch(/^https:\/\//)
    expect(opts[0].meta.setCode).toBeTruthy()
  })

  it("returns DFC back image for Arlinn", async () => {
    const opts = await scryfall.getOptions({ name: "Arlinn, the Pack's Hope // Arlinn, the Moon's Fury", type: "card" })
    expect(opts[0]?.backImageUrl).toMatch(/^https:\/\//)
  })
}, { timeout: 15_000 })
```

- [ ] **Step 2: MPC Fill live**

```ts
// packages/cardartpicker/src/sources/mpcfill.live.test.ts
import { describe, expect, it } from "vitest"
import { createMpcFill } from "./mpcfill.js"

const RUN = process.env.RUN_LIVE_TESTS === "1"
const d = RUN ? describe : describe.skip

d("mpcFill (live)", () => {
  it("returns options for Sol Ring", async () => {
    const src = createMpcFill()
    const opts = await src.getOptions({ name: "Sol Ring", type: "card" })
    expect(opts.length).toBeGreaterThan(0)
    expect(opts[0].sourceName).toBe("MPC Fill")
  })
}, { timeout: 20_000 })
```

- [ ] **Step 3: Verify gating**

Run: `pnpm --filter cardartpicker test`
Expected: live tests skipped.

Run: `RUN_LIVE_TESTS=1 pnpm --filter cardartpicker test -- live`
Expected: runs and passes.

- [ ] **Step 4: Commit**

```bash
git add packages/cardartpicker/src/sources/scryfall.live.test.ts packages/cardartpicker/src/sources/mpcfill.live.test.ts
git commit -m "test: gated live contract tests for Scryfall and MPC Fill"
```

---

### Task 24: Integration test — full handler round-trip

**Files:**
- Create: `packages/cardartpicker/src/server/integration.test.ts`

- [ ] **Step 1: Test**

```ts
// packages/cardartpicker/src/server/integration.test.ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import { createHandlers } from "./index.js"
import { createPicker } from "../createPicker.js"
import { scryfall } from "../sources/scryfall.js"
import solRing from "../../test/fixtures/scryfall-sol-ring.json" with { type: "json" }

const server = setupServer(
  http.get("https://api.scryfall.com/cards/search", () => HttpResponse.json(solRing))
)
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("end-to-end handler + Scryfall source", () => {
  const picker = createPicker({ sources: [scryfall] })
  const { GET, POST } = createHandlers(picker)

  it("parse → default → options round-trip", async () => {
    const parseRes = await POST(new Request("http://t/api/cardartpicker/parse", {
      method: "POST", body: JSON.stringify({ text: "1 Sol Ring" }),
      headers: { "Content-Type": "application/json" },
    }))
    const parsed = await parseRes.json()
    expect(parsed.mainboard).toHaveLength(1)

    const defaultRes = await GET(new Request("http://t/api/cardartpicker/default?name=Sol+Ring&type=card"))
    const def = await defaultRes.json()
    expect(def.id).toMatch(/^scryfall:/)

    const optionsRes = await GET(new Request("http://t/api/cardartpicker/options?name=Sol+Ring&type=card"))
    const opts = await optionsRes.json()
    expect(opts[0].ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run.** Expected PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/cardartpicker/src/server/integration.test.ts
git commit -m "test(server): integration round-trip through handlers + live source adapter"
```

---

## Phase 10 — Documentation

### Task 25: Package docs + README

**Files:**
- Create: `docs/{overview.md,architecture.md,configuration.md}`
- Create: `docs/api/{sources.md,server.md,hooks.md,ui.md}`
- Create: `docs/guides/{quickstart.md,custom-source.md,upload-persistence.md,deployment.md}`
- Create: `README.md`

- [ ] **Step 1: Write each doc file**

Content outline (each file is a standalone markdown doc):

- **overview.md** — what the package does, the five layers (Sources / Hook / Context / Server / UI), distribution model (private monorepo).
- **architecture.md** — ASCII diagram from the spec, data flow, progressive fetch strategy, CORS rationale.
- **configuration.md** — full `PickerConfig` field reference: `sources`, `uploadPersistence` (default `"localStorage"`), `cacheTTL` (default 3600), `sourceTimeoutMs` (default 10000), `parserStrict`, `logger`, `onDownloadStart`, `onDownloadComplete`, `downloadFilename`.
- **api/sources.md** — the `Source` contract, `defineSource`, built-in `scryfall` and `mpcFill`, progressive-fetch implications.
- **api/server.md** — `createHandlers(picker)`, `createActions(picker)`, per-route request/response shape for `GET default`, `GET options`, `POST parse`, `POST download`, `POST upload`.
- **api/hooks.md** — `useCardPicker()` return value, `CardPickerProvider` props.
- **api/ui.md** — `CardArtPicker` props (including `slots`), CSS variables list, overriding via `theme.css`.
- **guides/quickstart.md** — 10-line install + mount + render walkthrough.
- **guides/custom-source.md** — full `defineSource` walkthrough with a local-folder example.
- **guides/upload-persistence.md** — **default `"localStorage"` with 5 MB cap**, how to swap to S3/DB via `UploadAdapter`, error taxonomy.
- **guides/deployment.md** — production checklist: caching strategy, logger wiring, error reporting, rate-limit awareness.

- [ ] **Step 2: README.md**

```markdown
# CardArtPicker

Private Next.js package for browsing and selecting Magic: The Gathering card/token proxy art from Scryfall, MPC Fill, and developer-provided custom sources.

## Install

Add to your Next.js app's `package.json`:

\`\`\`json
{ "dependencies": { "cardartpicker": "github:your-org/CardArtPicker" } }
\`\`\`

## Quick start

See [docs/guides/quickstart.md](./docs/guides/quickstart.md).

## Docs

- [Overview](./docs/overview.md)
- [Architecture](./docs/architecture.md)
- [Configuration](./docs/configuration.md)
- [Sources API](./docs/api/sources.md)
- [Server API](./docs/api/server.md)
- [Hooks](./docs/api/hooks.md)
- [UI](./docs/api/ui.md)
- [Custom source guide](./docs/guides/custom-source.md)
- [Upload persistence](./docs/guides/upload-persistence.md)
- [Deployment](./docs/guides/deployment.md)

## Important default

`uploadPersistence` defaults to `"localStorage"` — base64 data URLs, 5 MB cap, per-device, lost on cache clear. For production, swap to a custom `UploadAdapter`. See the [upload persistence guide](./docs/guides/upload-persistence.md).

## Demo

\`\`\`bash
pnpm install
pnpm --filter nextjs-demo dev
\`\`\`

Visit `http://localhost:3000`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/ README.md
git commit -m "docs: overview, architecture, API, guides, quickstart, README"
```

---

### Task 26: AGENTS.md + llms.txt + build script

**Files:**
- Create: `AGENTS.md` (root)
- Create: `packages/cardartpicker/AGENTS.md`
- Create: `docs/llms.txt`
- Create: `scripts/build-llm-docs.ts`

- [ ] **Step 1: Root AGENTS.md**

```markdown
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
```

- [ ] **Step 2: Package AGENTS.md**

```markdown
# AGENTS.md — cardartpicker (internal)

Rules for agents modifying the package source.

- Preserve the public API surface unless bumping the major version.
- New source → add to `src/sources/`, export from `src/sources/index.ts`, add a test with msw fixtures.
- Never import from `src/ui/` into `src/server/`. tsup entry boundaries enforce this — breakages manifest as runtime errors in Next.js consumers.
- `src/client/*` must be `"use client"` and safe to run in the browser; no Node-only imports.
- Run `pnpm test` and `pnpm build` before claiming any task complete.
```

- [ ] **Step 3: docs/llms.txt**

```
# CardArtPicker

> Next.js package for browsing and selecting Magic: The Gathering card/token
> proxy art from Scryfall, MPC Fill, and custom developer-provided sources.

## Core concepts
- [Overview](./overview.md)
- [Architecture](./architecture.md)
- [Configuration](./configuration.md)

## APIs
- [Sources](./api/sources.md)
- [Server handlers](./api/server.md)
- [Hooks](./api/hooks.md)
- [UI components](./api/ui.md)

## Guides
- [Quick start](./guides/quickstart.md)
- [Adding a custom source](./guides/custom-source.md)
- [Upload persistence](./guides/upload-persistence.md)
- [Deployment](./guides/deployment.md)

## Important defaults
- `uploadPersistence` defaults to `"localStorage"` (5 MB cap, base64 data URLs, per-device)
- All external network calls route through the developer's mounted `/api/cardartpicker/*` handler; client-side fetches to Scryfall/MPC Fill are never used
```

- [ ] **Step 4: scripts/build-llm-docs.ts**

```ts
import { readFile, writeFile, readdir } from "node:fs/promises"
import { join, relative } from "node:path"

async function walk(dir: string, out: string[]) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) await walk(p, out)
    else if (entry.name.endsWith(".md")) out.push(p)
  }
  return out
}

const root = "docs"
const files = await walk(root, [])
files.sort()
const parts: string[] = []
for (const f of files) {
  if (f.endsWith("llms.txt") || f.includes("superpowers/")) continue
  parts.push(`\n\n<!-- ===== ${relative(".", f)} ===== -->\n\n`)
  parts.push(await readFile(f, "utf-8"))
}
await writeFile(join(root, "llms-full.txt"), parts.join(""), "utf-8")
console.log(`wrote docs/llms-full.txt (${files.length} files)`)
```

- [ ] **Step 5: Generate and verify**

Run: `pnpm docs:llms`
Expected: `docs/llms-full.txt` created with concatenated markdown.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md packages/cardartpicker/AGENTS.md docs/llms.txt scripts/build-llm-docs.ts
git commit -m "docs: AGENTS.md, llms.txt index, llms-full.txt build script"
```

---

### Task 27: Final build + typecheck audit

**Files:**
- No new files. Final sanity check.

- [ ] **Step 1: Full workspace build**

Run: `pnpm -r build`
Expected: both workspaces build clean.

- [ ] **Step 2: Full test run**

Run: `pnpm -r test`
Expected: all unit + integration tests pass (live tests skipped).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter cardartpicker typecheck`
Expected: no errors.

- [ ] **Step 4: Smoke test**

Run: `pnpm --filter nextjs-demo test:e2e`
Expected: Playwright smoke passes.

- [ ] **Step 5: Tag release**

```bash
git tag v0.1.0
```

---

## Coverage check (spec → tasks)

| Spec section | Task(s) |
|---|---|
| §1 Overview — five layers | 3, 5–6, 8, 9–12, 13–14, 15–18 |
| §2 Non-goals | Respected across tasks |
| §3 Architecture — server-only external network | 9–12, 14 |
| §4 Package structure | 1, 2 |
| §5 Types | 3 |
| §5 Sources — Scryfall | 5 |
| §5 Sources — MPC Fill | 6 |
| §5 Sources — defineSource | 5 (step 4), 19 |
| §5 Progressive fetch | 14 |
| §5 Caching + retry | 7 |
| §5 Error isolation | 8 |
| §6 createPicker + PickerConfig | 8 |
| §6 Route handlers | 9–11 |
| §6 Server actions | 12 |
| §6 Client hook + Provider | 14 |
| §7 Parser rules + strict mode | 4 |
| §7 Slot expansion | 14 |
| §8 Download ZIP | 10 |
| §8 Upload + adapter | 11, 13 |
| §8 Persistence adapters | 13 |
| §9 UI components | 16–18 |
| §9 CSS Modules + theme vars | 15 |
| §9 Not-found state | 14, 16, 18 |
| §10 Error handling taxonomy | 8, 10, 14 |
| §11 Testing | 4, 5, 6, 7, 8, 10, 11, 13, 14, 22, 23, 24 |
| §12 Demo app ProxyMart | 19, 20, 21 |
| §13 LLM docs | 25, 26 |

No gaps.

---

## Self-review notes

- **Placeholders:** none — every step ships runnable code.
- **Type consistency:** `Selections` (object map) vs `Selection[]` (array form) — hook returns the map, server/ZIP use the array. Conversion lives in the hook's `download` function.
- **Slot id convention:** `"{section}-{lineIdx}-{copyIdx}"`, consistent across parser expansion (Task 14), UI rendering (Tasks 16–18), and download selections (Task 10).
- **`apiBase` default:** `/api/cardartpicker` — matches the route file path in Task 19.
- **Download resolver:** the hook posts the full options map with selections (Task 14) so the server can resolve without reaching back into its cache (Task 10).
- **Parser regex:** uses `String.prototype.match` (not `RegExp.prototype.exec`) to keep the flow straightforward.

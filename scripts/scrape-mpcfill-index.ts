/**
 * One-shot scraper that builds an MPC Fill index JSON.
 *
 *   pnpm tsx scripts/scrape-mpcfill-index.ts
 *
 * Process:
 *   1. Fetch Scryfall bulk-data (default-cards) → unique card + token names.
 *   2. Fetch MPC Fill /2/sources/ → list of source PKs.
 *   3. Batch-call /2/editorSearch/ for ALL names → name → drive-id list.
 *   4. Hydrate unique drive IDs via /2/cards/ → metadata.
 *   5. Write scripts/mpcfill-index.json + .gz copy.
 *
 * Resume: state in scripts/.mpcfill-scrape-state.json. Re-run picks up where
 * it left off. Delete the state file to start fresh.
 *
 * Be polite. MPC Fill is volunteer-run. Default sleep = 1500ms between
 * requests. Increase if you see 429s.
 */

import { writeFile, readFile, mkdir } from "node:fs/promises"
import { gzip } from "node:zlib"
import { promisify } from "node:util"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const OUT_DIR = process.env.MPC_OUT_DIR ?? join(ROOT, "scripts")
const OUTPUT = join(OUT_DIR, "mpcfill-index.json")
const STATE = process.env.MPC_STATE_FILE ?? join(OUT_DIR, ".mpcfill-scrape-state.json")
const PROGRESS_FILE = process.env.MPC_PROGRESS_FILE ?? join(OUT_DIR, ".mpcfill-scrape-progress.json")

const BASE = process.env.MPC_BASE ?? "https://mpcfill.com"
const SLEEP_MS = Number(process.env.MPC_SLEEP_MS ?? 1500)
const QUERY_BATCH = Number(process.env.MPC_QUERY_BATCH ?? 30)
const HYDRATE_BATCH = Number(process.env.MPC_HYDRATE_BATCH ?? 800)
const MAX_RETRIES = 5

const gzipP = promisify(gzip)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

type ScryfallBulk = { object: "list"; data: Array<{ type: string; download_uri: string }> }
type ScryfallCard = { name: string; layout?: string; type_line?: string }

type SearchResp = { results: Record<string, Record<string, string[]>> }
type CardsResp = {
  results: Record<string, {
    identifier: string; name: string; priority: number; source: number
    source_name: string; source_verbose: string; dpi: number; language: string; tags: string[]
  }>
}

type Step = "names" | "sources" | "search" | "hydrate" | "write"
type State = {
  step: Step
  names?: { card: string[]; token: string[] }
  sources?: Array<{ pk: number; name: string; verbose: string }>
  searchProgress?: number
  ids?: Record<string, Record<string, string[]>>  // type → name → ids
  hydrateProgress?: number
  hydrated?: Record<string, CardsResp["results"][string]>
}

async function loadState(): Promise<State | null> {
  try { return JSON.parse(await readFile(STATE, "utf8")) }
  catch { return null }
}

async function saveState(s: State) {
  await mkdir(dirname(STATE), { recursive: true })
  await writeFile(STATE, JSON.stringify(s))
}

async function reportProgress(p: { step: Step; cursor?: number; total?: number; message?: string }) {
  try {
    await mkdir(dirname(PROGRESS_FILE), { recursive: true })
    await writeFile(PROGRESS_FILE, JSON.stringify({ ...p, ts: new Date().toISOString() }))
  } catch {}
}

const UA = "cardartpicker-scraper/0.1 (+https://github.com/cucapcosta/CardArtPicker)"

async function politeFetch(url: string, init?: RequestInit, retry = 0): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (!headers.has("User-Agent")) headers.set("User-Agent", UA)
  if (!headers.has("Accept")) headers.set("Accept", "application/json")
  try {
    const res = await fetch(url, { ...init, headers })
    if (res.status === 429 || res.status === 503) {
      if (retry >= MAX_RETRIES) throw new Error(`${url} ${res.status} (retries exhausted)`)
      const ra = Number(res.headers.get("Retry-After"))
      const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(60_000, 2_000 * 2 ** retry)
      console.warn(`  ${res.status} → sleeping ${wait}ms (retry ${retry + 1})`)
      await sleep(wait)
      return politeFetch(url, init, retry + 1)
    }
    return res
  } catch (e) {
    if (retry >= MAX_RETRIES) throw e
    const wait = Math.min(30_000, 1_000 * 2 ** retry)
    console.warn(`  network error (${(e as Error).message.slice(0, 60)}) → retry in ${wait}ms`)
    await sleep(wait)
    return politeFetch(url, init, retry + 1)
  }
}

async function fetchScryfallNames(): Promise<{ card: string[]; token: string[] }> {
  console.log("→ Scryfall bulk-data")
  const meta = (await (await politeFetch("https://api.scryfall.com/bulk-data")).json()) as ScryfallBulk
  const oracle = meta.data.find(d => d.type === "oracle_cards")
  if (!oracle) throw new Error("no oracle_cards bulk")
  console.log(`  download ${oracle.download_uri}`)
  const all = (await (await politeFetch(oracle.download_uri)).json()) as ScryfallCard[]
  const cards = new Set<string>()
  const tokens = new Set<string>()
  for (const c of all) {
    if (!c.name) continue
    const layout = c.layout ?? ""
    const isToken = layout === "token" || layout === "double_faced_token" || layout === "emblem"
    if (isToken) tokens.add(c.name)
    else cards.add(c.name)
  }
  console.log(`  ${cards.size} cards, ${tokens.size} tokens`)
  return { card: [...cards].sort(), token: [...tokens].sort() }
}

async function fetchSources(): Promise<Array<{ pk: number; name: string; verbose: string }>> {
  console.log("→ MPC Fill /2/sources/")
  const res = await politeFetch(`${BASE}/2/sources/`, { headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error(`sources ${res.status}`)
  const body = (await res.json()) as { results: Record<string, { pk: number; name: string; description: string }> }
  return Object.values(body.results).map(s => ({ pk: s.pk, name: s.name, verbose: s.description }))
}

async function searchBatch(
  queries: Array<{ query: string; cardType: "CARD" | "TOKEN" }>,
  sourcePks: number[],
): Promise<SearchResp["results"]> {
  const res = await politeFetch(`${BASE}/2/editorSearch/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      searchSettings: {
        searchTypeSettings: { fuzzySearch: false, filterCardbacks: false },
        sourceSettings: { sources: sourcePks.map(pk => [pk, true]) },
        filterSettings: { minimumDPI: 0, maximumDPI: 1500, maximumSize: 30, languages: [], includesTags: [], excludesTags: [] },
      },
      queries,
    }),
  })
  if (!res.ok) throw new Error(`search ${res.status}: ${await res.text().catch(() => "")}`)
  return ((await res.json()) as SearchResp).results
}

async function hydrateBatch(ids: string[]): Promise<CardsResp["results"]> {
  const res = await politeFetch(`${BASE}/2/cards/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardIdentifiers: ids }),
  })
  if (!res.ok) throw new Error(`hydrate ${res.status}: ${await res.text().catch(() => "")}`)
  return ((await res.json()) as CardsResp).results
}

async function writeOutput(state: State) {
  const card: Record<string, unknown[]> = {}
  const token: Record<string, unknown[]> = {}
  const sourcesOut: Record<string, { name: string; verbose: string }> = {}
  for (const s of state.sources ?? []) sourcesOut[s.pk] = { name: s.name, verbose: s.verbose }

  const buckets = [
    ["card", state.ids?.card ?? {}, card],
    ["token", state.ids?.token ?? {}, token],
  ] as const
  for (const [, idMap, out] of buckets) {
    for (const [name, ids] of Object.entries(idMap)) {
      const entries: unknown[] = []
      for (const id of ids) {
        const c = state.hydrated?.[id]
        if (!c) continue
        const e: Record<string, unknown> = { i: c.identifier, n: c.name }
        if (c.source) e.s = c.source
        if (c.source_name) e.sn = c.source_name
        if (c.dpi) e.d = c.dpi
        if (c.language) e.l = c.language
        if (c.tags && c.tags.length) e.t = c.tags
        entries.push(e)
      }
      if (entries.length) out[name] = entries
    }
  }

  const file = {
    v: new Date().toISOString().slice(0, 10),
    sources: sourcesOut,
    card,
    token,
  }
  const json = JSON.stringify(file)
  await mkdir(dirname(OUTPUT), { recursive: true })
  const tmp = `${OUTPUT}.tmp`
  await writeFile(tmp, json)
  const { rename } = await import("node:fs/promises")
  await rename(tmp, OUTPUT)
  const gz = await gzipP(Buffer.from(json))
  const tmpGz = `${OUTPUT}.gz.tmp`
  await writeFile(tmpGz, gz)
  await rename(tmpGz, `${OUTPUT}.gz`)
  const cardCount = Object.values(card).reduce((n, v) => n + (v as unknown[]).length, 0)
  const tokenCount = Object.values(token).reduce((n, v) => n + (v as unknown[]).length, 0)
  console.log(`✓ wrote ${OUTPUT}`)
  console.log(`  ${(json.length / 1e6).toFixed(1)} MB raw, ${(gz.length / 1e6).toFixed(1)} MB gz`)
  console.log(`  ${cardCount} card entries, ${tokenCount} token entries`)
  console.log(`  ${Object.keys(card).length} unique card names, ${Object.keys(token).length} unique token names`)
}

async function main() {
  let state = (await loadState()) ?? { step: "names" as Step }
  console.log(`Resuming from step: ${state.step}`)

  if (state.step === "names") {
    state.names = await fetchScryfallNames()
    state.step = "sources"
    await saveState(state)
  }

  if (state.step === "sources") {
    state.sources = await fetchSources()
    console.log(`  ${state.sources.length} sources`)
    state.step = "search"
    state.searchProgress = 0
    state.ids = { card: {}, token: {} }
    await saveState(state)
  }

  if (state.step === "search") {
    const sourcePks = (state.sources ?? []).map(s => s.pk)
    const cardNames = state.names?.card ?? []
    const tokenNames = state.names?.token ?? []
    const total = cardNames.length + tokenNames.length
    let cursor = state.searchProgress ?? 0

    const all: Array<{ name: string; cardType: "CARD" | "TOKEN" }> = [
      ...cardNames.map(name => ({ name, cardType: "CARD" as const })),
      ...tokenNames.map(name => ({ name, cardType: "TOKEN" as const })),
    ]

    while (cursor < all.length) {
      const slice = all.slice(cursor, cursor + QUERY_BATCH)
      const queries = slice.map(s => ({ query: s.name.toLowerCase(), cardType: s.cardType }))
      try {
        const results = await searchBatch(queries, sourcePks)
        for (const s of slice) {
          const byType = results[s.name.toLowerCase()] ?? {}
          const ids = byType[s.cardType] ?? []
          if (ids.length === 0) continue
          const bucket = state.ids![s.cardType === "TOKEN" ? "token" : "card"]
          bucket[s.name.toLowerCase()] = ids
        }
      } catch (e) {
        console.warn(`  search batch failed: ${(e as Error).message}`)
      }
      cursor += slice.length
      state.searchProgress = cursor
      if (cursor % (QUERY_BATCH * 5) === 0 || cursor >= all.length) {
        await saveState(state)
        const pct = ((cursor / total) * 100).toFixed(1)
        console.log(`  search ${cursor}/${total} (${pct}%)`)
        await reportProgress({ step: "search", cursor, total })
      }
      await sleep(SLEEP_MS)
    }

    state.step = "hydrate"
    state.hydrateProgress = 0
    state.hydrated = {}
    await saveState(state)
  }

  if (state.step === "hydrate") {
    const allIds = new Set<string>()
    for (const m of [state.ids?.card ?? {}, state.ids?.token ?? {}]) {
      for (const ids of Object.values(m)) for (const id of ids) allIds.add(id)
    }
    const idArr = [...allIds]
    let cursor = state.hydrateProgress ?? 0
    console.log(`→ hydrate ${idArr.length} unique drive ids`)

    while (cursor < idArr.length) {
      const slice = idArr.slice(cursor, cursor + HYDRATE_BATCH)
      try {
        const results = await hydrateBatch(slice)
        Object.assign(state.hydrated!, results)
      } catch (e) {
        console.warn(`  hydrate batch failed: ${(e as Error).message}`)
      }
      cursor += slice.length
      state.hydrateProgress = cursor
      if (cursor % (HYDRATE_BATCH * 2) === 0 || cursor >= idArr.length) {
        await saveState(state)
        const pct = ((cursor / idArr.length) * 100).toFixed(1)
        console.log(`  hydrate ${cursor}/${idArr.length} (${pct}%)`)
        await reportProgress({ step: "hydrate", cursor, total: idArr.length })
      }
      await sleep(SLEEP_MS)
    }

    state.step = "write"
    await saveState(state)
  }

  if (state.step === "write") {
    await writeOutput(state)
    await reportProgress({ step: "write", message: "done" })
  }
}

main().catch(e => {
  console.error("scrape failed:", e)
  process.exit(1)
})

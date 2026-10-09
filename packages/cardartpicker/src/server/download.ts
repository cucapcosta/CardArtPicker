import JSZip from "jszip"
import pLimit from "p-limit"
import type { CardOption, Picker, Selection } from "../types.js"
import { withRetry } from "../retry.js"
import { USER_AGENT } from "../sources/fetch.js"

export type BuildZipOptions = {
  concurrency?: number
  attempts?: number
  timeoutMs?: number
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)
}

function unwrapProxiedUrl(url: string): string {
  const marker = "/img?u="
  const idx = url.indexOf(marker)
  if (idx === -1) return url
  const enc = url.slice(idx + marker.length).split("&")[0]
  if (!enc) return url
  try { return decodeURIComponent(enc) } catch { return url }
}

async function fetchImage(
  option: CardOption,
  picker: Picker | null,
  opts: BuildZipOptions,
  face: "front" | "back" = "front",
): Promise<ArrayBuffer> {
  const rawUrl = face === "back" ? option.backImageUrl : option.imageUrl
  if (!rawUrl) throw new Error(`no ${face} image for option ${option.id}`)
  const src = picker?.config.sources.find(s => s.name === option.sourceName)
  if (face === "front" && src?.getImage) return src.getImage(option.id)
  const url = unwrapProxiedUrl(rawUrl)

  return withRetry(async () => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000)
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": USER_AGENT } })
      if (!res.ok) throw Object.assign(new Error(`image ${res.status}`), { status: res.status })
      // Google Drive answers throttled/blocked requests with a 200 HTML page.
      const type = res.headers.get("content-type") ?? ""
      if (type.startsWith("text/")) throw new Error(`image not returned (${type.split(";")[0]})`)
      return await res.arrayBuffer()
    } finally { clearTimeout(t) }
  }, {
    attempts: opts.attempts ?? 4,
    baseDelayMs: 250,
    // A 4xx other than timeout/throttling won't change on retry.
    shouldRetry: e => {
      const status = (e as { status?: number }).status
      return status === undefined || status >= 500 || status === 408 || status === 429
    },
  })
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

  // Fetch concurrently, but name files afterwards in selection order: the client sends
  // one selection per copy, so several selections share a card name and must not
  // overwrite each other in the archive.
  type Fetched = { base: string; dfc: boolean; quantity: number; faces: Array<{ face: "front" | "back"; bytes: ArrayBuffer }> }
  const fetched: Array<Fetched | null> = new Array(selections.length).fill(null)

  await Promise.all(selections.map((sel, idx) => limit(async () => {
    const option = await resolver(sel.optionId)
    if (!option) { failures.push({ slotId: sel.slotId, error: "option not found" }); return }
    try {
      const faceNames: Array<"front" | "back"> = option.backImageUrl ? ["front", "back"] : ["front"]
      const faces = []
      for (const face of faceNames) faces.push({ face, bytes: await fetchImage(option, picker, opts, face) })
      fetched[idx] = { base: slugify(option.cardName) || "card", dfc: Boolean(option.backImageUrl), quantity: sel.quantity, faces }
    } catch (e) {
      failures.push({ slotId: sel.slotId, error: (e as Error).message })
    }
  })))

  const totals = new Map<string, number>()
  for (const f of fetched) if (f) totals.set(f.base, (totals.get(f.base) ?? 0) + f.quantity)
  const used = new Map<string, number>()
  for (const f of fetched) {
    if (!f) continue
    for (let i = 0; i < f.quantity; i++) {
      const n = (used.get(f.base) ?? 0) + 1
      used.set(f.base, n)
      const copySuffix = (totals.get(f.base) ?? 0) > 1 ? `-copy${n}` : ""
      for (const { face, bytes } of f.faces) {
        const faceSuffix = f.dfc ? ` ${face === "front" ? 1 : 2}` : ""
        zip.file(`${f.base}${copySuffix}${faceSuffix}.png`, bytes)
      }
    }
  }

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

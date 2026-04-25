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

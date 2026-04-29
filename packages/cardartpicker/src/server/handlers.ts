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

export function createGetHandler(
  picker: Picker,
  imageRoute?: (req: Request) => Promise<Response>,
) {
  return async function GET(request: Request): Promise<Response> {
    const segs = getPathSegments(request.url)
    const route = segs[0] ?? ""
    const url = new URL(request.url)
    const name = url.searchParams.get("name") ?? ""
    const type = (url.searchParams.get("type") ?? "card") as CardType

    if (route === "img" && imageRoute) return imageRoute(request)

    if (route === "default") {
      if (!name) return new Response(JSON.stringify({ error: "missing name" }), { status: 400, headers: jsonHeaders })
      const opt = await picker.getDefaultPrint(name, type)
      if (!opt) return new Response(JSON.stringify({ error: "not-found" }), { status: 404, headers: jsonHeaders })
      return new Response(JSON.stringify(opt), { status: 200, headers: jsonHeaders })
    }
    if (route === "options") {
      if (!name) return new Response(JSON.stringify({ error: "missing name" }), { status: 400, headers: jsonHeaders })
      const offsetRaw = url.searchParams.get("offset")
      const limitRaw = url.searchParams.get("limit")
      const offset = offsetRaw !== null && Number.isFinite(Number(offsetRaw)) ? Math.max(0, Number(offsetRaw)) : 0
      const limit = limitRaw !== null && Number.isFinite(Number(limitRaw)) ? Math.max(1, Math.min(500, Number(limitRaw))) : undefined
      const results = await picker.searchCard({ name, type }, limit !== undefined ? { offset, limit } : { offset })
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

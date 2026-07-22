import { NextResponse } from "next/server"
import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { Readable } from "node:stream"
import { paths } from "@/lib/scrape-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: Request) {
  let s
  try { s = await stat(paths.INDEX_FILE) }
  catch { return NextResponse.json({ error: "index not found" }, { status: 404 }) }

  const ims = req.headers.get("if-modified-since")
  if (ims && new Date(ims).getTime() >= Math.floor(s.mtime.getTime() / 1000) * 1000) {
    return new NextResponse(null, { status: 304 })
  }

  const stream = createReadStream(paths.INDEX_FILE)
  const webStream = Readable.toWeb(stream) as ReadableStream
  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(s.size),
      "Last-Modified": s.mtime.toUTCString(),
      "Cache-Control": "public, max-age=300",
    },
  })
}

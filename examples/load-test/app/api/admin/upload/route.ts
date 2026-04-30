import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/admin-auth"
import { applyUpload } from "@/lib/scrape-runner"
import { picker } from "@/lib/picker"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.res

  const ct = req.headers.get("content-type") ?? ""
  let buf: Buffer
  if (ct.startsWith("multipart/form-data")) {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "missing 'file' field" }, { status: 400 })
    }
    buf = Buffer.from(await file.arrayBuffer())
  } else {
    buf = Buffer.from(await req.arrayBuffer())
  }

  if (buf.length === 0) return NextResponse.json({ error: "empty body" }, { status: 400 })

  const r = await applyUpload(buf)
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
  await picker.clearCache().catch(() => {})
  return NextResponse.json({ ok: true, bytes: buf.length })
}

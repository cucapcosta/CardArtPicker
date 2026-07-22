import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/admin-auth"
import { startReindex } from "@/lib/scrape-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.res
  const r = await startReindex()
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 409 })
  return NextResponse.json({ ok: true }, { status: 202 })
}

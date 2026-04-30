import { NextResponse } from "next/server"
import { getStatus } from "@/lib/scrape-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const status = await getStatus()
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } })
}

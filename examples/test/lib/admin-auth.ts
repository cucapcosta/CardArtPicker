import { NextResponse } from "next/server"

const SECRET = process.env.REINDEX_SECRET

export type AuthFail = { ok: false; res: NextResponse }
export type AuthPass = { ok: true }

export function requireAuth(req: Request): AuthFail | AuthPass {
  if (!SECRET) {
    return {
      ok: false,
      res: NextResponse.json({ error: "REINDEX_SECRET not configured" }, { status: 503 }),
    }
  }
  const header = req.headers.get("authorization") ?? ""
  const [scheme, token] = header.split(" ")
  if (scheme?.toLowerCase() !== "bearer" || token !== SECRET) {
    return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  }
  return { ok: true }
}

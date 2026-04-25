import type { Picker } from "../types.js"
export type UploadResult = { id: string; imageUrl: string }
export function createUploadHandler(_picker: Picker) {
  return async (_req: Request) =>
    new Response(JSON.stringify({ error: "not implemented" }), { status: 501, headers: { "Content-Type": "application/json" } })
}

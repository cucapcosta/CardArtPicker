import type { Picker } from "../types.js"
export function createDownloadHandler(_picker: Picker) {
  return async (_req: Request) =>
    new Response(JSON.stringify({ error: "not implemented" }), { status: 501, headers: { "Content-Type": "application/json" } })
}
export async function buildZip(): Promise<Blob> { throw new Error("not implemented") }

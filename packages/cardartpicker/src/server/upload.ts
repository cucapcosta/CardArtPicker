import { nanoid } from "nanoid"
import type { CardOption, Picker } from "../types.js"

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"])
const MAX_BYTES = 20 * 1024 * 1024

export type UploadResult = CardOption

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } })
}

export function createUploadHandler(_picker: Picker) {
  return async function uploadRoute(req: Request): Promise<Response> {
    const form = await req.formData().catch(() => null)
    if (!form) return json({ error: "expected multipart/form-data" }, 400)
    const file = form.get("file")
    const cardName = form.get("cardName")
    const slotId = form.get("slotId")
    if (!(file instanceof Blob)) return json({ error: "missing file" }, 400)
    if (typeof cardName !== "string" || typeof slotId !== "string") return json({ error: "missing cardName or slotId" }, 400)
    if (!ALLOWED_MIME.has(file.type)) return json({ error: `unsupported mime ${file.type}` }, 400)
    if (file.size > MAX_BYTES) return json({ error: "file too large (max 20MB)" }, 413)

    const buf = await file.arrayBuffer()
    const b64 = Buffer.from(buf).toString("base64")
    const option: CardOption = {
      id: `custom:${nanoid(12)}`,
      sourceName: "Custom",
      cardName,
      imageUrl: `data:${file.type};base64,${b64}`,
      meta: { userUploaded: true },
    }
    return json(option, 200)
  }
}

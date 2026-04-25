import type { Picker } from "../types.js"
import { createGetHandler, createPostHandler } from "./handlers.js"
import { createDownloadHandler } from "./download.js"
import { createUploadHandler } from "./upload.js"

export function createHandlers(picker: Picker) {
  const downloadRoute = createDownloadHandler(picker)
  const uploadRoute = createUploadHandler(picker)
  return {
    GET: createGetHandler(picker),
    POST: createPostHandler(picker, uploadRoute, downloadRoute),
  }
}
export { buildZip } from "./download.js"
export type { UploadResult } from "./upload.js"

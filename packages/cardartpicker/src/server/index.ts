import type { Picker } from "../types.js"
import { createGetHandler, createPostHandler } from "./handlers.js"
import { createDownloadHandler } from "./download.js"
import { createUploadHandler } from "./upload.js"
import { createImageProxy, type ImageProxyOptions } from "./imageProxy.js"

export type CreateHandlersOptions = {
  imageProxy?: ImageProxyOptions | false
}

export function createHandlers(picker: Picker, opts: CreateHandlersOptions = {}) {
  const downloadRoute = createDownloadHandler(picker)
  const uploadRoute = createUploadHandler(picker)
  const imageRoute = opts.imageProxy === false ? undefined : createImageProxy(opts.imageProxy)
  return {
    GET: createGetHandler(picker, imageRoute),
    POST: createPostHandler(picker, uploadRoute, downloadRoute),
  }
}
export { buildZip } from "./download.js"
export { createImageProxy } from "./imageProxy.js"
export type { UploadResult } from "./upload.js"
export type { ImageProxyOptions } from "./imageProxy.js"
export { createActions } from "./actions.js"

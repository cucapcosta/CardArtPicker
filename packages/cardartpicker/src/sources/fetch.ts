export const FETCH_TIMEOUT_MS = 15_000

/** Scryfall (API and image CDN) rejects generic user agents like Node's default with a 400. */
export const USER_AGENT = "cardartpicker/0.1 (+https://github.com/cucapcosta/CardArtPicker)"

/** fetch with a hard abort timeout so a hung socket can never wedge an in-flight cache entry. */
export function fetchWithTimeout(url: string, init: RequestInit = {}, ms = FETCH_TIMEOUT_MS): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) })
}

export const FETCH_TIMEOUT_MS = 15_000

/** fetch with a hard abort timeout so a hung socket can never wedge an in-flight cache entry. */
export function fetchWithTimeout(url: string, init: RequestInit = {}, ms = FETCH_TIMEOUT_MS): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) })
}

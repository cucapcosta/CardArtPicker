type CacheEntry = { bytes: Uint8Array; contentType: string; lastAccess: number }

const ALLOWED_HOSTS: RegExp[] = [
  /^lh\d+\.googleusercontent\.com$/,
  /^drive\.google\.com$/,
  /^drive\.usercontent\.google\.com$/,
  /^cards\.scryfall\.io$/,
  /^c\d+\.scryfall\.com$/,
  /^api\.scryfall\.com$/,
  /^img\.scryfall\.com$/,
]

export type ImageProxyOptions = {
  maxBytes?: number
  fetchTimeoutMs?: number
  allowedHosts?: RegExp[]
  upstreamConcurrency?: number
}

export function createImageProxy(opts: ImageProxyOptions = {}) {
  const max = opts.maxBytes ?? 200 * 1024 * 1024
  const timeout = opts.fetchTimeoutMs ?? 15_000
  const hosts = opts.allowedHosts ?? ALLOWED_HOSTS
  const upstreamMax = opts.upstreamConcurrency ?? 6
  const cache = new Map<string, CacheEntry>()
  const inflight = new Map<string, Promise<CacheEntry>>()
  let totalBytes = 0
  let active = 0
  const waiters: (() => void)[] = []
  async function acquire(): Promise<void> {
    if (active < upstreamMax) { active++; return }
    await new Promise<void>(resolve => waiters.push(resolve))
    active++
  }
  function release(): void {
    active--
    const next = waiters.shift()
    next?.()
  }

  function evictUntil(target: number) {
    const sorted = [...cache.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess)
    for (const [k, v] of sorted) {
      if (totalBytes <= target) break
      cache.delete(k)
      totalBytes -= v.bytes.byteLength
    }
  }

  async function fetchAndCache(target: URL, key: string): Promise<CacheEntry> {
    const existing = inflight.get(key)
    if (existing) return existing
    const promise = (async () => {
      await acquire()
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), timeout)
      try {
        const res = await fetch(target, { redirect: "follow", signal: ctrl.signal })
        if (!res.ok) throw new Error(`upstream ${res.status}`)
        const bytes = new Uint8Array(await res.arrayBuffer())
        const contentType = res.headers.get("Content-Type") ?? "image/jpeg"
        const entry: CacheEntry = { bytes, contentType, lastAccess: Date.now() }
        if (bytes.byteLength <= max) {
          cache.set(key, entry)
          totalBytes += bytes.byteLength
          if (totalBytes > max) evictUntil(Math.floor(max * 0.8))
        }
        return entry
      } finally {
        clearTimeout(t)
        release()
        inflight.delete(key)
      }
    })()
    inflight.set(key, promise)
    return promise
  }

  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const target = url.searchParams.get("u")
    if (!target) return new Response("missing u", { status: 400 })
    let parsed: URL
    try { parsed = new URL(target) } catch { return new Response("invalid u", { status: 400 }) }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return new Response("scheme not allowed", { status: 403 })
    }
    if (!hosts.some(re => re.test(parsed.hostname))) {
      return new Response("host not allowed", { status: 403 })
    }
    const key = parsed.toString()
    const hit = cache.get(key)
    if (hit) {
      hit.lastAccess = Date.now()
      return new Response(hit.bytes as unknown as BodyInit, {
        headers: { "Content-Type": hit.contentType, "Cache-Control": "public, max-age=86400, immutable", "X-Image-Cache": "HIT" },
      })
    }
    try {
      const entry = await fetchAndCache(parsed, key)
      return new Response(entry.bytes as unknown as BodyInit, {
        headers: { "Content-Type": entry.contentType, "Cache-Control": "public, max-age=86400, immutable", "X-Image-Cache": "MISS" },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fetch failed"
      return new Response(msg, { status: 502 })
    }
  }
}

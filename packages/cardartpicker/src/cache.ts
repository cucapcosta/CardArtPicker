import type { CacheAdapter } from "./types.js"

type Entry<T> = { value: T; expiresAt: number | null }

export type MemoryCacheOptions = { max?: number; defaultTtlSeconds?: number }

export function createMemoryCache<T = unknown>(opts: MemoryCacheOptions = {}): CacheAdapter {
  const max = opts.max ?? 500
  const defaultTtl = opts.defaultTtlSeconds ?? 3600
  const map = new Map<string, Entry<T>>()

  function evictIfNeeded() {
    while (map.size > max) {
      const first = map.keys().next().value
      if (first === undefined) break
      map.delete(first)
    }
  }

  return {
    async get(key) {
      const entry = map.get(key) as Entry<T> | undefined
      if (!entry) return undefined
      if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
        map.delete(key)
        return undefined
      }
      map.delete(key); map.set(key, entry)
      return entry.value as never
    },
    async set(key, value, ttlSeconds) {
      const ttl = ttlSeconds ?? defaultTtl
      const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null
      map.set(key, { value: value as unknown as T, expiresAt })
      evictIfNeeded()
    },
    async delete(key) { map.delete(key) },
  }
}

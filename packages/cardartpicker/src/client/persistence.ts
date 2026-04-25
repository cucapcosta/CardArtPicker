import type { CardOption, UploadAdapter } from "../types.js"

const KEY = "cardartpicker:uploads:v1"

export type LocalStorageAdapterOptions = { maxBytes?: number; key?: string }

export function localStorageAdapter(opts: LocalStorageAdapterOptions = {}): UploadAdapter {
  const max = opts.maxBytes ?? 5 * 1024 * 1024
  const key = opts.key ?? KEY

  function readAll(): CardOption[] {
    try {
      const raw = globalThis.localStorage?.getItem(key)
      return raw ? (JSON.parse(raw) as CardOption[]) : []
    } catch { return [] }
  }
  function writeAll(items: CardOption[]) {
    const serialised = JSON.stringify(items)
    if (serialised.length > max) {
      throw Object.assign(new Error("localStorage quota exceeded"), { code: "quota-exceeded" })
    }
    globalThis.localStorage?.setItem(key, serialised)
  }
  return {
    async save(option) {
      const all = readAll().filter(o => o.id !== option.id)
      all.push(option)
      writeAll(all)
    },
    async loadAll() { return readAll() },
    async remove(id) { writeAll(readAll().filter(o => o.id !== id)) },
  }
}

export function sessionAdapter(): UploadAdapter {
  const store = new Map<string, CardOption>()
  return {
    async save(option) { store.set(option.id, option) },
    async loadAll() { return Array.from(store.values()) },
    async remove(id) { store.delete(id) },
  }
}

export function resolveAdapter(kind: "localStorage" | "session" | UploadAdapter): UploadAdapter {
  if (kind === "localStorage") return localStorageAdapter()
  if (kind === "session") return sessionAdapter()
  return kind
}

import { describe, expect, it, vi } from "vitest"
import { withRetry } from "./retry.js"

describe("withRetry", () => {
  it("returns value on first success", async () => {
    const fn = vi.fn().mockResolvedValue(42)
    const out = await withRetry(fn, { attempts: 3, baseDelayMs: 1 })
    expect(out).toBe(42)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retries on failure up to attempts", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("flaky 1"))
      .mockRejectedValueOnce(new Error("flaky 2"))
      .mockResolvedValue(42)
    const out = await withRetry(fn, { attempts: 3, baseDelayMs: 1, jitter: false })
    expect(out).toBe(42)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it("throws after attempts exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"))
    await expect(withRetry(fn, { attempts: 2, baseDelayMs: 1 })).rejects.toThrow("always fails")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("respects shouldRetry predicate", async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error("400"), { status: 400 }))
    await expect(withRetry(fn, {
      attempts: 3, baseDelayMs: 1,
      shouldRetry: (e) => (e as { status?: number }).status !== 400,
    })).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

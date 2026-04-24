export type RetryOptions = {
  attempts?: number
  baseDelayMs?: number
  jitter?: boolean
  shouldRetry?: (err: unknown, attempt: number) => boolean
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3
  const base = opts.baseDelayMs ?? 100
  const jitter = opts.jitter ?? true
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (opts.shouldRetry && !opts.shouldRetry(e, i)) throw e
      if (i === attempts - 1) break
      const jitterFactor = jitter ? 1 + (Math.random() * 0.4 - 0.2) : 1
      const delay = base * Math.pow(4, i) * jitterFactor
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

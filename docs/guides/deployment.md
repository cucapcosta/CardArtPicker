# Deployment

Production checklist for shipping CardArtPicker beyond a local dev box.

## 1. Cache backend

The default `createMemoryCache()` is per-process LRU. In a serverless or multi-instance setup it becomes useless: every cold start re-fetches everything.

Implement a `CacheAdapter` against Redis, KV, or your DB:

```ts
import type { CacheAdapter } from "cardartpicker"
import { Redis } from "ioredis"

const redis = new Redis(process.env.REDIS_URL!)

const redisCache: CacheAdapter = {
  async get(key) {
    const raw = await redis.get(`cap:${key}`)
    return raw ? JSON.parse(raw) : undefined
  },
  async set(key, value, ttlSeconds) {
    const data = JSON.stringify(value)
    if (ttlSeconds && ttlSeconds > 0) {
      await redis.set(`cap:${key}`, data, "EX", ttlSeconds)
    } else {
      await redis.set(`cap:${key}`, data)
    }
  },
  async delete(key) { await redis.del(`cap:${key}`) },
}

createPicker({
  sources: [...],
  cacheBackend: redisCache,
})
```

## 2. Logger

Replace the default `console` logger with your structured one:

```ts
import * as Sentry from "@sentry/nextjs"

createPicker({
  sources: [...],
  logger: (level, event, ctx) => {
    if (level === "warn") Sentry.captureMessage(event, { level: "warning", extra: ctx as Record<string, unknown> })
    if (level === "error") Sentry.captureException(new Error(event), { extra: ctx as Record<string, unknown> })
    pino[level]({ event, ...(ctx as object) })
  },
})
```

The package emits `source.failure` warnings out of the box; new events will follow the same shape.

## 3. Source timeout

Drop the default 10s to fail fast in production. A slow source already gets retried by upstream callers (the user clicks "retry") and the partial-failure model means it does not block other sources.

```ts
createPicker({
  sources: [...],
  sourceTimeoutMs: 5000,  // 5s
})
```

## 4. Upload persistence — DO NOT ship `localStorage`

The default `"localStorage"` is for personal/hobby use. In a shared deployment:

- 5 MB cap is per-user-per-browser, no sync
- Users lose uploads on cache clear
- One user's uploads cannot be shared

Implement a custom `UploadAdapter` against S3 / GCS / R2 / your DB. See [upload-persistence.md](./upload-persistence.md) for the full sketch.

```ts
createPicker({
  sources: [...],
  uploadPersistence: s3Adapter(currentUserId),
})
```

## 5. Respect Scryfall rate limits

[Scryfall asks](https://scryfall.com/docs/api) for ~50–100ms between requests. The package's server-side cache (1-hour TTL by default) already absorbs most repeats, so a busy picker rarely touches Scryfall directly. You should not need to add explicit throttling unless you have a script-driven crawl path.

If you write a custom source that calls Scryfall, add your own delay there.

## 6. MPC Fill is volunteer-run

`mpcfill.com` is a volunteer-operated community service. There is no published rate limit but the project has explicitly asked integrators to be polite:

- Cache aggressively (the default 1h TTL is conservative; consider 6h or 24h)
- Do not crawl
- Do not embed in apps that you advertise to non-MTG audiences
- Reach out to the MPC Fill maintainers before deploying anything that will materially increase traffic

If you are running a pet project for a small group of friends, the defaults are fine. Anything beyond that, get in touch with them first.

## 7. CORS

The architecture puts all source calls server-side specifically because MPC Fill does not send CORS headers. Do not try to call sources from the client — it will not work and is not the supported path. See [../architecture.md](../architecture.md).

## 8. Bundle size

The package's entry points are tree-split. Verify after build:

- Client bundle should not contain `jszip`, `p-limit`, `nanoid`, `node:fs`, `node:path`, or anything from `cardartpicker/server` or `cardartpicker/sources`
- Run `pnpm build` and inspect `.next/static/chunks/` for stray server modules

`transpilePackages: ["cardartpicker"]` in `next.config.mjs` is required for Next.js to apply its own client-server boundary checks to the package code.

## 9. Environment variables

The package reads no environment variables itself. Anything sensitive (Redis URL, S3 credentials, custom source API keys) flows through your `lib/picker.ts` and is naturally server-only — never imported into client code.

## See also

- [../configuration.md](../configuration.md)
- [upload-persistence.md](./upload-persistence.md)
- [custom-source.md](./custom-source.md)

# Upload persistence

End users can upload their own card art via `<UploadDialog>` per slot. The package needs to decide where those uploads live across reloads.

## Default: `"localStorage"`

**The default is `"localStorage"`.** Uploaded images are encoded as base64 data URLs and stored in the browser's `localStorage`.

Implications:

- **5 MB cap.** Browsers limit `localStorage` to ~5–10 MB per origin. The package enforces a 5 MB cap on the serialized JSON payload via `localStorageAdapter({ maxBytes: 5 * 1024 * 1024 })`. Hitting it throws `{ code: "quota-exceeded" }`.
- **Per-device.** No sync across browsers, devices, or users.
- **Lost on cache clear.** "Clear browsing data" wipes uploads.
- **Privacy.** Images never leave the user's machine. There is no upload to your server.

This is the right default for personal/hobby use. **It is not the right choice for production-shared apps.** Switch to a custom adapter before deploying to multi-user environments.

## Switching: `"session"`

```ts
createPicker({
  sources: [...],
  uploadPersistence: "session",
})
```

In-memory `Map` only. Cleared on every page reload. Useful for "I just want to test something" workflows where you don't want stale data lingering.

## Switching: custom `UploadAdapter`

Provide a `UploadAdapter` for production: store the uploaded blob in S3, GCS, R2, or your DB.

```ts
type UploadAdapter = {
  save(option: CardOption): Promise<void>
  loadAll(): Promise<CardOption[]>
  remove(id: string): Promise<void>
}
```

### Sketch: S3 adapter

```ts
import { createPicker } from "cardartpicker"
import type { UploadAdapter, CardOption } from "cardartpicker"

function s3Adapter(userId: string): UploadAdapter {
  return {
    async save(option) {
      // option.imageUrl is currently a data: URL — extract bytes
      const blob = await (await fetch(option.imageUrl)).blob()
      const key = `users/${userId}/${option.id}`
      await s3.putObject({ Bucket, Key: key, Body: blob })
      await db.uploads.insert({
        id: option.id,
        userId,
        cardName: option.cardName,
        s3Key: key,
      })
    },
    async loadAll() {
      const rows = await db.uploads.find({ userId })
      return rows.map((r): CardOption => ({
        id: r.id,
        sourceName: "Custom",
        cardName: r.cardName,
        imageUrl: `/api/uploads/${r.id}`,  // your route streams from S3
        meta: { userUploaded: true },
      }))
    },
    async remove(id) {
      const row = await db.uploads.findOne({ id, userId })
      if (!row) return
      await s3.deleteObject({ Bucket, Key: row.s3Key })
      await db.uploads.delete({ id })
    },
  }
}

const picker = createPicker({
  sources: [...],
  uploadPersistence: s3Adapter(currentUserId),
})
```

Built-in `localStorageAdapter` and `sessionAdapter` factories are also exported from `cardartpicker/client` if you want to wrap them.

## Server upload route

The server-side `POST /upload` route ([api/server.md](../api/server.md)) is independent of the persistence adapter. It validates and returns a `CardOption` with the file as a base64 data URL. The persistence adapter wraps that — server stays simple, persistence policy stays in the consumer's control.

If your `UploadAdapter.save()` does the actual S3 upload, the data URL on the returned `CardOption` becomes a temporary thing the client passes to `save()`, which then replaces `imageUrl` with the persistent URL. Your `loadAll()` rehydrates with the persistent URLs.

## Error taxonomy

| Error | Where | Recovery |
|---|---|---|
| `unsupported mime <type>` | Server upload route, 400 | Pick PNG/JPEG/WebP |
| `file too large (max 20MB)` | Server upload route, 413 | Compress or resize |
| `quota-exceeded` | `localStorageAdapter.save()` throws | Clear uploads, or switch adapter |
| Adapter `save()` rejects | Custom adapter | Surface to user via `errors[]` |

The server's 20 MB cap is independent of the client's 5 MB `localStorage` cap. A 15 MB image will succeed at the server but fail at `localStorage` save.

## See also

- [../api/server.md](../api/server.md) — `POST /upload` shape
- [../api/hooks.md](../api/hooks.md) — `uploadCustom` action
- [deployment.md](./deployment.md) — why you should not ship `localStorage` to production

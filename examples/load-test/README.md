# load-test

Minimal Next.js app for performance/load-testing `cardartpicker`. Single Railway service: picker UI + admin (reindex/upload) + index file server.

## Local

```sh
pnpm --filter load-test dev
# → http://localhost:3000
# → http://localhost:3000/admin
```

By default the picker reads the MPC Fill index from `../../scripts/mpcfill-index.json` (built via `pnpm scrape:mpcfill` from repo root). Override with `MPC_FILL_INDEX_FILE=/abs/path/mpcfill-index.json`.

## Admin page

`/admin` lets you:
- **Reindex** — runs the scraper as a child process, writing into `MPC_DATA_DIR`. Status + log tail polled live.
- **Upload** — accept a pre-built `mpcfill-index.json` file, atomic replace.

Auth via `Authorization: Bearer $REINDEX_SECRET`. UI prompts for the secret on load (sessionStorage). API routes return 503 if unset.

Reindex must run from a clean IP (Cloudflare 1015 ban risk). If Railway's egress IP is banned, use the Upload button with a JSON built locally instead.

## API

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/cardartpicker/*` | — | Picker server handler |
| `GET /api/index-json` | — | Serves current `mpcfill-index.json` (CDN-friendly, `Last-Modified`) |
| `GET /api/admin/status` | — | Run state + progress + log tail (no secrets) |
| `POST /api/admin/reindex` | bearer | Spawns scraper, returns 202 |
| `POST /api/admin/upload` | bearer | Accepts JSON file (multipart `file` or raw body), atomic replace |

## Env

| Var | Default | Purpose |
|---|---|---|
| `MPC_DATA_DIR` | `../../scripts` (dev) / `/data` (Docker) | Where index + state live |
| `MPC_FILL_INDEX_FILE` | `$MPC_DATA_DIR/mpcfill-index.json` | Picker reads this on demand (mtime-cached) |
| `MPC_FILL_INDEX_URL` | — | If set, picker fetches over HTTP instead of disk |
| `REINDEX_SECRET` | — | Required for admin POST routes |
| `MPC_SLEEP_MS` | `1500` | Scraper polite delay |

## Docker

```sh
docker build -t cap-loadtest .
docker run -p 3000:3000 -v cap-data:/data -e REINDEX_SECRET=changeme cap-loadtest

# build against published npm package instead
docker build --build-arg CAP_SOURCE=npm --build-arg CAP_VERSION=latest -t cap-loadtest:npm .
```

## Railway (single service)

1. New service from this repo. Railway picks `Dockerfile` automatically.
2. **Add a Volume**, mount path `/data` (any size; ~50MB usage).
3. **Variables**:
   - `REINDEX_SECRET=<long-random-string>` (required for admin)
   - `CAP_SOURCE=workspace` (default) or `CAP_SOURCE=npm` + `CAP_VERSION=0.1.0`
4. Open `/admin`, paste the secret, click **Reindex** — or upload a locally-built JSON if Railway's IP gets banned.

The package consumes the index at `https://<your-app>.up.railway.app/api/index-json`.

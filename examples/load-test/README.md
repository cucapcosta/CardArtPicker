# load-test

Minimal Next.js app for performance/load-testing `cardartpicker`. No auth, no rate limit, single page with prefilled decklist.

## Local

```sh
pnpm --filter load-test dev
# → http://localhost:3000
```

## Docker

```sh
# default: builds against local workspace source
docker build -t cap-loadtest .
docker run -p 3000:3000 cap-loadtest

# build against published npm package instead
docker build --build-arg CAP_SOURCE=npm --build-arg CAP_VERSION=latest -t cap-loadtest:npm .
```

## Railway

`railway.json` at repo root configures the Dockerfile build. Plug-and-play:

1. New service from this repo
2. Railway picks `Dockerfile` automatically
3. (optional) Build Variables:
   - `CAP_SOURCE=workspace` (default) — local source
   - `CAP_SOURCE=npm` + `CAP_VERSION=0.1.0` — published release

To compare local vs published under identical infra, deploy two services from the same repo with different `CAP_SOURCE` values.

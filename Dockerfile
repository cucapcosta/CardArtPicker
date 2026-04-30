# syntax=docker/dockerfile:1.7
#
# Build args:
#   CAP_SOURCE  = workspace | npm   (default: workspace)
#     workspace -> uses local packages/cardartpicker source (current branch)
#     npm       -> installs published cardartpicker@$CAP_VERSION from registry
#   CAP_VERSION = npm semver/tag    (default: latest)
#
# On Railway: set these as Build Variables. To compare local vs published
# under identical infra, deploy two services from this repo with different
# CAP_SOURCE values.

ARG CAP_SOURCE=workspace
ARG CAP_VERSION=latest

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS builder
ARG CAP_SOURCE
ARG CAP_VERSION
COPY . .
RUN if [ "$CAP_SOURCE" = "npm" ]; then \
      echo "[build] cardartpicker@${CAP_VERSION} from npm" && \
      node -e "const fs=require('fs');const p='examples/load-test/package.json';const j=JSON.parse(fs.readFileSync(p));j.dependencies.cardartpicker='${CAP_VERSION}';fs.writeFileSync(p,JSON.stringify(j,null,2));" && \
      printf 'link-workspace-packages=false\n' > .npmrc && \
      pnpm install --no-frozen-lockfile ; \
    else \
      echo "[build] cardartpicker from workspace source" && \
      pnpm install --frozen-lockfile && \
      pnpm --filter cardartpicker build ; \
    fi && \
    pnpm --filter load-test build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV MPC_DATA_DIR=/data
ENV MPC_FILL_INDEX_FILE=/data/mpcfill-index.json
ENV MPC_STATE_FILE=/data/.mpcfill-scrape-state.json
ENV MPC_PROGRESS_FILE=/data/.mpcfill-scrape-progress.json
ENV MPC_SCRAPER_SCRIPT=/app/scripts/scrape-mpcfill-index.ts

RUN npm i -g tsx@4 && mkdir -p /data

COPY --from=builder /app/examples/load-test/.next/standalone ./
COPY --from=builder /app/examples/load-test/.next/static ./examples/load-test/.next/static
COPY --from=builder /app/examples/load-test/public ./examples/load-test/public
COPY --from=builder /app/scripts ./scripts

VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "examples/load-test/server.js"]

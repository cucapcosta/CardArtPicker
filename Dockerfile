# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile && \
    pnpm --filter cardartpicker build && \
    pnpm --filter test build

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

COPY --from=builder /app/examples/test/.next/standalone ./
COPY --from=builder /app/examples/test/.next/static ./examples/test/.next/static
COPY --from=builder /app/examples/test/public ./examples/test/public
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000
CMD ["node", "examples/test/server.js"]

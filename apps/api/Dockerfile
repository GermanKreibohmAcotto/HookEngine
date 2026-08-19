# Build context is the repo root (see docker-compose.yml) because this is an
# npm workspaces monorepo — the lockfile at the root is the source of truth.

FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/webhooks/package.json packages/webhooks/package.json
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/webhooks packages/webhooks
COPY apps/api apps/api
# @hookengine/webhooks builds first — apps/api imports its compiled dist/
# output (via the workspace symlink in node_modules), not its TS source.
RUN npm run build -w @hookengine/webhooks
RUN npm run build -w @hookengine/api

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/webhooks/dist ./packages/webhooks/dist
COPY packages/webhooks/package.json ./packages/webhooks/package.json
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.http.js"]
